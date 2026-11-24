"""チェックイン日が今日以前の泊は取り直さず、前回の公開JSONを残すことを確かめる。

実APIは呼ばない。search() を差し替えて、呼ばれたチェックイン日を記録し、
tools/fixtures/hotels/vacant-hotel-search.sample.json の応答を返す。
書き出し先は一時ディレクトリ。公開中の public/data/hotels/ は上書きしない
（読むのは acl-md5 の写しを作るときだけ）。

前回のリストに使う宿（hotel_no 900001 など）は作り物。実在の宿ではない。

  python3 tools/hotels/check_keep_past_nights.py
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

import build_match_hotels as bmh  # noqa: E402

FIXTURE = CURRENT_DIR.parent / "fixtures" / "hotels" / "vacant-hotel-search.sample.json"
REAL_HOTELS_DIR = bmh.HOTELS_DIR
REAL_INDEX_PATH = bmh.HOTEL_INDEX_PATH

failures: list[str] = []
calls: list[str] = []


def expect(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


def fake_search(lat, lon, radius, checkin, response_file):
    calls.append(checkin.isoformat())
    return bmh.read_json(FIXTURE)


def made_up(no: int, name: str) -> dict:
    # 作り物の宿。前回のリストとして置き、そのまま残るかを見るだけ。
    return {"hotel_no": no, "hotel_name": name, "min_charge": 9000 + no % 100, "price_tier": "standard", "featured": no % 2 == 0}


def previous_document(match_id: str, before: str, day: str, pre: list[dict], same_day: list[dict] | None) -> dict:
    document = {
        "match_id": match_id,
        "hotel_count": len(pre),
        "hotels": pre,
        "meta": {"match_id": match_id, "checkin_date": before, "same_day_checkin_date": day, "updated_at": "2030-01-01 10:00"},
    }
    if same_day is not None:
        document["same_day_hotel_count"] = len(same_day)
        document["same_day_hotels"] = same_day
    return document


def setup(work: Path) -> None:
    bmh.HOTELS_DIR = work / "hotels"
    bmh.HOTEL_INDEX_PATH = work / "hotel-index.json"
    bmh.HOTELS_DIR.mkdir(parents=True, exist_ok=True)
    calls.clear()


def write_previous(match_id: str, document: dict) -> Path:
    path = bmh.HOTELS_DIR / f"{match_id}.json"
    bmh.save_json(document, path)
    return path


# 試合は作り物（2030年）。会場は実在の stadiums.json / home-guide.json から取る。
guide = bmh.load_home_guide()
stadiums = bmh.load_stadiums()
away_venue = next(name for name, s in stadiums.items() if s.get("latitude") and name not in guide.get("venues", []))
MATCH_DATE = "2030-05-11"
BEFORE = "2030-05-10"
cases = {
    "away": ({"id": "test-away", "venue": away_venue, "home_away": "A", "match_date": MATCH_DATE},
             lambda match, index, today: bmh.build_one(match, stadiums, index, None, today)),
    "home": ({"id": "test-home", "venue": guide["venues"][0], "home_away": "H", "match_date": MATCH_DATE},
             lambda match, index, today: bmh.build_home(match, guide, index, None, today)),
}

bmh.search = fake_search
expect(len(bmh.read_json(FIXTURE).get("hotels", [])) > 0, "前提: フィクスチャに宿がありません")

with tempfile.TemporaryDirectory() as tmp:
    for label, (match, build) in cases.items():
        mid = match["id"]
        pre = [made_up(900001, "作り物A"), made_up(900002, "作り物B")]
        same = [made_up(900003, "作り物C")]

        # --- 今日の泊は残る: 今日 = 前泊のチェックイン日。当日泊（翌日）だけ取り直す。
        setup(Path(tmp) / f"{label}-today")
        write_previous(mid, previous_document(mid, BEFORE, MATCH_DATE, pre, same))
        index = {"meta": {}, "matches": []}
        refetched = build(match, index, date.fromisoformat(BEFORE))
        out = bmh.read_json(bmh.HOTELS_DIR / f"{mid}.json")
        expect(refetched is True, f"{label}/今日: 当日泊は取り直すはず")
        expect(out["hotels"] == pre and out["hotel_count"] == 2, f"{label}/今日: 前泊が前回のままではない")
        expect(set(calls) == {MATCH_DATE}, f"{label}/今日: 取りに行ったのは当日泊だけのはず（{sorted(set(calls))}）")
        expect(out["same_day_hotels"] != same and out["same_day_hotel_count"] == len(out["same_day_hotels"]),
               f"{label}/今日: 当日泊は取り直した中身になるはず")
        expect(out["meta"]["updated_at"] != "2030-01-01 10:00", f"{label}/今日: 取り直したので時刻は進むはず")
        expect(index["matches"][0]["hotel_count"] == 2, f"{label}/今日: 索引の件数は前泊の前回件数のはず")

        # --- 過去の泊は残る: 2泊とも今日より前。API を呼ばず、ファイルも書き直さない。
        setup(Path(tmp) / f"{label}-past")
        path = write_previous(mid, previous_document(mid, BEFORE, MATCH_DATE, pre, same))
        original = path.read_bytes()
        index = {"meta": {"updated_at": "2030-01-01 10:00"}, "matches": [{"match_id": mid, "hotel_count": 2}]}
        refetched = build(match, index, date.fromisoformat("2030-05-12"))
        expect(refetched is False, f"{label}/過去: 取り直していないはず")
        expect(calls == [], f"{label}/過去: API を呼んではいけない（{calls}）")
        expect(path.read_bytes() == original, f"{label}/過去: ファイルが書き換わった")
        expect(index == {"meta": {"updated_at": "2030-01-01 10:00"}, "matches": [{"match_id": mid, "hotel_count": 2}]},
               f"{label}/過去: 索引が書き換わった")

        # --- 未来の泊は取り直す: 2泊とも今日より後。
        setup(Path(tmp) / f"{label}-future")
        write_previous(mid, previous_document(mid, BEFORE, MATCH_DATE, pre, same))
        refetched = build(match, {"meta": {}, "matches": []}, date.fromisoformat("2030-05-01"))
        out = bmh.read_json(bmh.HOTELS_DIR / f"{mid}.json")
        expect(refetched is True and set(calls) == {BEFORE, MATCH_DATE}, f"{label}/未来: 2泊とも取り直すはず（{sorted(set(calls))}）")
        expect(out["hotels"] != pre, f"{label}/未来: 前泊は取り直した中身になるはず")

        # --- 前回が無い: 今日以前の泊は空。宿を作らない。
        setup(Path(tmp) / f"{label}-none")
        build(match, {"meta": {}, "matches": []}, date.fromisoformat("2030-05-12"))
        out = bmh.read_json(bmh.HOTELS_DIR / f"{mid}.json")
        expect(calls == [], f"{label}/前回なし: API を呼んではいけない（{calls}）")
        expect(out["hotels"] == [] and out["hotel_count"] == 0 and out["same_day_hotels"] == [] and out["same_day_hotel_count"] == 0,
               f"{label}/前回なし: 空のはず")

        # --- 前回の日付が食い違う（試合日が動いた）: 前回の宿は使わない。
        setup(Path(tmp) / f"{label}-moved")
        write_previous(mid, previous_document(mid, "2030-04-30", "2030-05-01", pre, same))
        build(match, {"meta": {}, "matches": []}, date.fromisoformat("2030-05-12"))
        out = bmh.read_json(bmh.HOTELS_DIR / f"{mid}.json")
        expect(calls == [] and out["hotels"] == [] and out["same_day_hotels"] == [],
               f"{label}/日付ずれ: 前回の宿を使わず空のはず")

        # --- 前回が0件: 今日の泊が空でも、空のまま残し、取り直さない。
        setup(Path(tmp) / f"{label}-zero")
        write_previous(mid, previous_document(mid, BEFORE, MATCH_DATE, [], same))
        build(match, {"meta": {}, "matches": []}, date.fromisoformat(BEFORE))
        out = bmh.read_json(bmh.HOTELS_DIR / f"{mid}.json")
        expect(out["hotels"] == [] and out["hotel_count"] == 0, f"{label}/0件: 前泊は空のまま残るはず")
        expect(BEFORE not in calls, f"{label}/0件: 前泊を取り直してはいけない（{calls}）")

    # --- main() から: acl-md5（浦項戦、2026-11-24）。公開中のファイルの写しで試す。
    real = REAL_HOTELS_DIR / "acl-md5.json"
    if real.exists():
        previous = bmh.read_json(real)
        for today, expected_calls, note in (("2026-11-25", set(), "試合の翌日"), ("2026-11-23", {"2026-11-24"}, "前泊のチェックイン当日")):
            setup(Path(tmp) / f"main-{today}")
            shutil.copy(real, bmh.HOTELS_DIR / "acl-md5.json")
            shutil.copy(REAL_INDEX_PATH, bmh.HOTEL_INDEX_PATH)
            index_before = bmh.HOTEL_INDEX_PATH.read_bytes()
            code = bmh.main(["--match-id", "acl-md5", "--today", today, "--response-file", str(FIXTURE)])
            out = bmh.read_json(bmh.HOTELS_DIR / "acl-md5.json")
            expect(code == 0, f"main/{note}: 終了コードが0ではない（{code}）")
            # --response-file は fake_search に渡るだけ。呼ばれた日付で取り直しを見る。
            expect(set(calls) == expected_calls, f"main/{note}: 取りに行った日付が違う（{sorted(set(calls))}）")
            expect(out["hotels"] == previous["hotels"] and out["hotel_count"] == previous["hotel_count"],
                   f"main/{note}: 前泊が前回のままではない")
            if not expected_calls:
                expect(out == previous, f"main/{note}: 2泊とも残すのにファイルが変わった")
                expect(bmh.HOTEL_INDEX_PATH.read_bytes() == index_before, f"main/{note}: 取り直していないのに索引が変わった")
            else:
                index = bmh.read_json(bmh.HOTEL_INDEX_PATH)
                entry = next(m for m in index["matches"] if m["match_id"] == "acl-md5")
                expect(entry["hotel_count"] == previous["hotel_count"], f"main/{note}: 索引の件数が前泊の前回件数ではない")
    else:
        failures.append("前提: public/data/hotels/acl-md5.json がありません")

bmh.HOTELS_DIR = REAL_HOTELS_DIR
bmh.HOTEL_INDEX_PATH = REAL_INDEX_PATH

if failures:
    print(f"今日以前の泊を残す確認に失敗しました（{len(failures)}件）", file=sys.stderr)
    for line in failures:
        print(f"  {line}", file=sys.stderr)
    raise SystemExit(1)
print("今日以前の泊を残す確認OK: 今日・過去の泊は前回のまま（APIを呼ばない）、未来の泊だけ取り直す。前回が無ければ空。ホームとアウェイの両方。")
