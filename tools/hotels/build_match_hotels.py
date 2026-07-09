"""Generate public hotel JSON files for Sanga."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from models import HotelCandidate  # noqa: E402
from public_schema import build_hotel_index_entry, build_match_hotels_document  # noqa: E402

ROOT_DIR = CURRENT_DIR.parent.parent
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
HOTELS_DIR = PUBLIC_DATA_DIR / "hotels"
HOTEL_INDEX_PATH = PUBLIC_DATA_DIR / "hotel-index.json"
MATCHES_PATH = PUBLIC_DATA_DIR / "matches.json"


def load_matches() -> list[dict]:
    if not MATCHES_PATH.exists():
        return []
    data = json.loads(MATCHES_PATH.read_text(encoding="utf-8"))
    return data.get("matches", []) if isinstance(data, dict) else []


def find_match(match_id: str) -> dict:
    for match in load_matches():
        if match.get("id") == match_id:
            return match
    raise KeyError(f"Unknown match_id: {match_id}")


def load_match_hotels(match_id: str) -> list[HotelCandidate]:
    """Load hotel candidates for a match.

    This scaffold keeps generation deterministic until the real Rakuten ingest
    is wired in.
    """

    match = find_match(match_id)
    stadium_id = match.get("venue") or match_id
    return [
        HotelCandidate(
            hotel_no=12345,
            hotel_name="Sample Hotel Kyoto",
            stadium_id=stadium_id,
            distance_km_from_stadium=2.4,
            min_charge=9800,
            max_charge=15600,
            price_tier="standard",
            parking_tag="available_paid",
            parking_raw_text="paid parking available",
            accommodation_type_tag="hotel",
            hotel_class_code_raw="business",
            affiliate_url="https://example.com/hotel/12345",
            stadium_proximity=True,
        )
    ]


def load_hotel_index() -> dict:
    if HOTEL_INDEX_PATH.exists():
        return json.loads(HOTEL_INDEX_PATH.read_text(encoding="utf-8"))
    return {
        "meta": {
            "updated_at": "",
            "source": "Rakuten Travel API",
            "season": "",
        },
        "matches": [],
    }


def save_json(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def build_public_payload(match_id: str, hotels: list[HotelCandidate]) -> dict:
    match = find_match(match_id)
    now = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M")
    document = build_match_hotels_document(match_id, hotels)
    document["meta"] = {
        "match_id": match_id,
        "stadium_id": match.get("venue", ""),
        "match_date": match.get("match_date", ""),
        "checkin_date": match.get("match_date", ""),
        "checkout_date": match.get("match_date", ""),
        "updated_at": now,
        "source": "Rakuten Travel API",
        "search_conditions": {
            "adult_num": 2,
            "up_class_num": 0,
            "low_class_num": 0,
            "search_radius": 3,
        },
    }
    return document


def build_index_payload(match_id: str, hotels: list[HotelCandidate], data_path: str) -> dict:
    match = find_match(match_id)
    index = load_hotel_index()
    entry = build_hotel_index_entry(match_id, len(hotels))
    entry["stadium_id"] = match.get("venue", "")
    entry["checkin_date"] = match.get("match_date", "")
    entry["checkout_date"] = match.get("match_date", "")
    entry["data_path"] = data_path

    matches = [item for item in index.get("matches", []) if item.get("match_id") != match_id]
    matches.append(entry)
    index["matches"] = matches
    index.setdefault("meta", {})
    index["meta"]["updated_at"] = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M")
    index["meta"]["source"] = "Rakuten Travel API"
    return index


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--match-id", required=True)
    args = parser.parse_args(argv)

    hotels = load_match_hotels(args.match_id)
    document = build_public_payload(args.match_id, hotels)
    data_path = f"data/hotels/{args.match_id}.json"
    index = build_index_payload(args.match_id, hotels, data_path)

    save_json(document, HOTELS_DIR / f"{args.match_id}.json")
    save_json(index, HOTEL_INDEX_PATH)

    print(f"saved: {HOTELS_DIR / f'{args.match_id}.json'}")
    print(f"saved: {HOTEL_INDEX_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
