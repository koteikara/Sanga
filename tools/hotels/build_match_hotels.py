"""アウェイ戦ごとのホテル候補 JSON を作る（楽天トラベル VacantHotelSearch）。

使い方:
  python tools/hotels/build_match_hotels.py --match-id sec14
  python tools/hotels/build_match_hotels.py --all-away          # これから行われる国内アウェイ戦すべて
  python tools/hotels/build_match_hotels.py --match-id sec14 --response-file FIXTURE.json  # APIを呼ばず検証

認証は環境変数 RAKUTEN_APP_ID / RAKUTEN_AFFILIATE_ID / RAKUTEN_ACCESS_KEY（GitHub Secrets 経由）。
値をログに出さず、リポジトリにも書かない。出力のリンクは楽天がアフィリエイトIDつきで返したURLのみ。
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from models import HotelCandidate, PriceTier  # noqa: E402
from public_schema import build_hotel_index_entry, build_match_hotels_document  # noqa: E402

ROOT_DIR = CURRENT_DIR.parent.parent
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
HOTELS_DIR = PUBLIC_DATA_DIR / "hotels"
HOTEL_INDEX_PATH = PUBLIC_DATA_DIR / "hotel-index.json"
MATCHES_PATH = PUBLIC_DATA_DIR / "matches.json"
STADIUMS_PATH = PUBLIC_DATA_DIR / "stadiums.json"

SEARCH_RADIUS_KM = 3
ADULT_NUM = 2
MAX_HOTELS = 10
JST = timezone(timedelta(hours=9))


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_matches() -> list[dict]:
    return read_json(MATCHES_PATH).get("matches", []) if MATCHES_PATH.exists() else []


def load_stadiums() -> dict[str, dict]:
    """matches.json の venue（略称）から引く。"""
    data = read_json(STADIUMS_PATH)
    return {item["venue"]: item for item in data.get("stadiums", [])}


def find_match(match_id: str) -> dict:
    for match in load_matches():
        if match.get("id") == match_id:
            return match
    raise KeyError(f"Unknown match_id: {match_id}")


def match_day(match: dict) -> str:
    """試合日。未定なら最初の候補日（宿泊は前日から取るので、候補日の早いほう）。"""
    return match.get("match_date") or (match.get("date_candidates") or [""])[0]


def upcoming_domestic_away(today: date) -> list[dict]:
    result = []
    for match in load_matches():
        if match.get("home_away") != "A" or match.get("competition") == "ACL":
            continue
        day = match_day(match)
        if day and date.fromisoformat(day) > today:
            result.append(match)
    return result


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def price_tier(charge: int | None) -> str:
    if charge is None:
        return PriceTier.STANDARD
    if charge < 8000:
        return PriceTier.BUDGET
    return PriceTier.PREMIUM if charge >= 16000 else PriceTier.STANDARD


RAKUTEN_IMAGE_HOST = "img.travel.rakuten.co.jp"


def rakuten_image(url: str | None) -> str | None:
    """楽天トラベルの画像URLだけを https にそろえて通す。ほかのホストは捨てる。"""
    url = (url or "").strip()
    for scheme in ("https://", "http://"):
        if url.startswith(scheme + RAKUTEN_IMAGE_HOST + "/"):
            return "https://" + url[len(scheme):]
    return None


def review(info: dict) -> tuple[float | None, int | None]:
    try:
        count = int(info.get("reviewCount") or 0)
        average = float(info.get("reviewAverage") or 0)
    except (TypeError, ValueError):
        return None, None
    if count <= 0 or not 0 < average <= 5:
        return None, None
    return round(average, 2), count


def meal_label(room: dict) -> str | None:
    breakfast, dinner = room.get("withBreakfastFlag"), room.get("withDinnerFlag")
    if breakfast is None and dinner is None:
        return None
    if breakfast == 1 and dinner == 1:
        return "朝夕食付き"
    if breakfast == 1:
        return "朝食付き"
    if dinner == 1:
        return "夕食付き"
    return "食事なし"


def cheapest_plan(parts: list) -> dict | None:
    """その日・その人数で空いているプランのうち、1泊の合計料金がいちばん安いもの。

    VacantHotelSearch（formatVersion 1）は hotel の配列に {"roomInfo": [{"roomBasicInfo"}, {"dailyCharge"}]}
    をプランの数だけ並べる。roomBasicInfo の直後の dailyCharge をそのプランの料金とみなす。
    """
    best = None
    for part in parts:
        items = part.get("roomInfo") if isinstance(part, dict) else None
        if not isinstance(items, list):
            continue
        room = None
        for item in items:
            if not isinstance(item, dict):
                continue
            if "roomBasicInfo" in item:
                room = item["roomBasicInfo"] or {}
            elif "dailyCharge" in item and room is not None:
                try:
                    total = int((item["dailyCharge"] or {}).get("total") or 0)
                except (TypeError, ValueError):
                    total = 0
                if total > 0 and (best is None or total < best["total"]):
                    daily = item["dailyCharge"] or {}
                    best = {"total": total, "rakuten": daily.get("rakutenCharge"), "flag": daily.get("chargeFlag"), "plan": (room.get("planName") or room.get("roomName") or "").strip() or None, "meal": meal_label(room)}
                room = None
    return best


def parse_hotels(payload: dict, stadium: dict, stadium_id: str) -> list[HotelCandidate]:
    """VacantHotelSearch の応答を内部モデルへ。hotelBasicInfo だけを使う。"""
    out: list[HotelCandidate] = []
    plans: list[dict | None] = []
    for entry in payload.get("hotels", []):
        info = next((part["hotelBasicInfo"] for part in entry.get("hotel", []) if "hotelBasicInfo" in part), None)
        if not info or not info.get("hotelInformationUrl"):
            continue
        lat, lon = info.get("latitude"), info.get("longitude")
        distance = None
        if lat and lon:
            distance = round(haversine_km(float(lat), float(lon), stadium["latitude"], stadium["longitude"]), 1)
        charge = info.get("hotelMinCharge")  # 1部屋1泊の最安値の目安（楽天の説明）。日付・人数に関係しない
        parking = (info.get("parkingInformation") or "").strip()
        review_average, review_count = review(info)
        plan = cheapest_plan(entry.get("hotel", []))
        plans.append(plan)
        out.append(HotelCandidate(
            hotel_no=int(info["hotelNo"]),
            hotel_name=info.get("hotelName", ""),
            stadium_id=stadium_id,
            latitude=float(lat) if lat else None,
            longitude=float(lon) if lon else None,
            distance_km_from_stadium=distance,
            min_charge=int(charge) if charge else None,
            price_tier=price_tier(int(charge) if charge else None),
            parking_raw_text=parking or None,
            hotel_class_code_raw=info.get("hotelClassCode"),
            affiliate_url=info["hotelInformationUrl"],
            stadium_proximity=(distance is not None and distance <= 1.5),
            hotel_image_url=rakuten_image(info.get("hotelImageUrl")),
            hotel_thumbnail_url=rakuten_image(info.get("hotelThumbnailUrl")),
            review_average=review_average,
            review_count=review_count,
            nearest_station=(info.get("nearestStation") or "").strip() or None,
            stay_charge_total=plan["total"] if plan else None,
            stay_plan_name=plan["plan"] if plan else None,
            stay_meal=plan["meal"] if plan else None,
        ))
    # その日の料金が取れた宿を先に、安い順。取れなかった宿は目安の最安料金で後ろへ
    # total が人数分の合計かを確かめるための記録（Actions のログに出る。認証情報は含まない）
    sample = next((p for p in plans if p), None)
    if sample:
        print(f"  料金の確認: total={sample['total']} rakutenCharge={sample['rakuten']} chargeFlag={sample['flag']} 大人{ADULT_NUM}名")
    out.sort(key=lambda h: (h.stay_charge_total is None, h.stay_charge_total or 0, h.min_charge is None, h.min_charge or 0))
    return out[:MAX_HOTELS]


def fetch_hotels(match: dict, stadium: dict, stadium_id: str, response_file: str | None) -> tuple[list[HotelCandidate], str, str]:
    checkout = date.fromisoformat(match_day(match))
    checkin = checkout - timedelta(days=1)  # 前泊（試合前日に泊まって当日に会場へ）
    if response_file:
        payload = read_json(Path(response_file))
    else:
        from rakuten_client import search_vacant_hotels  # 認証情報が要るのでここで読む
        import requests

        try:
            payload = search_vacant_hotels(
                stadium["latitude"], stadium["longitude"], checkin.isoformat(), checkout.isoformat(),
                adult_num=ADULT_NUM, search_radius=SEARCH_RADIUS_KM, hits=30,
            )
        except requests.HTTPError as error:
            # 404 は「条件に合う空室なし」。0件として扱う。URLにキーが入るので本文は出さない。
            if error.response is not None and error.response.status_code == 404:
                payload = {"hotels": []}
            else:
                code = error.response.status_code if error.response is not None else "?"
                raise RuntimeError(f"Rakuten API error HTTP {code}") from None
    return parse_hotels(payload, stadium, stadium_id), checkin.isoformat(), checkout.isoformat()


def save_json(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def now_jst() -> str:
    return datetime.now(JST).strftime("%Y-%m-%d %H:%M")


def build_one(match: dict, stadiums: dict[str, dict], index: dict, response_file: str | None) -> None:
    stadium = stadiums.get(match.get("venue", ""))
    if not stadium:
        raise KeyError(f"stadiums.json に venue がありません: {match.get('venue')}")
    stadium_id = stadium["id"]
    hotels, checkin, checkout = fetch_hotels(match, stadium, stadium_id, response_file)
    document = build_match_hotels_document(match["id"], hotels)
    document["meta"] = {
        "match_id": match["id"],
        "stadium_id": stadium_id,
        "match_date": match.get("match_date", ""),
        "checkin_date": checkin,
        "checkout_date": checkout,
        "updated_at": now_jst(),
        "source": "Rakuten Travel API",
        "search_conditions": {"adult_num": ADULT_NUM, "up_class_num": 0, "low_class_num": 0, "search_radius": SEARCH_RADIUS_KM},
    }
    save_json(document, HOTELS_DIR / f"{match['id']}.json")
    entry = build_hotel_index_entry(match["id"], len(hotels))
    entry.update(stadium_id=stadium_id, checkin_date=checkin, checkout_date=checkout, data_path=f"data/hotels/{match['id']}.json")
    index["matches"] = [m for m in index.get("matches", []) if m.get("match_id") != match["id"]] + [entry]
    print(f"{match['id']}: {len(hotels)}件 ({checkin} → {checkout})")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--match-id", action="append", default=[])
    parser.add_argument("--all-away", action="store_true")
    parser.add_argument("--response-file", help="API応答の保存ファイル（検証用。APIは呼ばない）")
    parser.add_argument("--today", help="YYYY-MM-DD（検証用）")
    args = parser.parse_args(argv)

    today = date.fromisoformat(args.today) if args.today else datetime.now(JST).date()
    matches = [find_match(i) for i in args.match_id]
    if args.all_away:
        matches += upcoming_domestic_away(today)
    if not matches:
        parser.error("--match-id か --all-away を指定してください")

    stadiums = load_stadiums()
    index = read_json(HOTEL_INDEX_PATH) if HOTEL_INDEX_PATH.exists() else {"meta": {}, "matches": []}
    failures = 0
    for match in matches:
        try:
            build_one(match, stadiums, index, args.response_file)
        except Exception as error:  # 1試合の失敗で全体を止めない。キーは例外文に入れていない
            failures += 1
            print(f"{match['id']}: 失敗 {error}", file=sys.stderr)
        time.sleep(1.1)  # 楽天APIは1秒1リクエストまで
    index["meta"].update(updated_at=now_jst(), source="Rakuten Travel API", season="2026-27")
    index["matches"].sort(key=lambda m: m["match_id"])
    save_json(index, HOTEL_INDEX_PATH)
    return 1 if failures == len(matches) else 0


if __name__ == "__main__":
    raise SystemExit(main())
