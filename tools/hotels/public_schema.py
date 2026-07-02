"""Transform internal hotel records into Sanga public JSON documents."""

from __future__ import annotations

from dataclasses import asdict

from models import HotelCandidate


def to_public_hotel_dict(candidate: HotelCandidate) -> dict:
    data = asdict(candidate)
    data.pop("distance_km", None)
    data.pop("tags", None)
    if not data.get("affiliate_url"):
        data.pop("affiliate_url", None)
    return data


def build_match_hotels_document(match_id: str, hotels: list[HotelCandidate]) -> dict:
    return {
        "match_id": match_id,
        "hotel_count": len(hotels),
        "hotels": [to_public_hotel_dict(hotel) for hotel in hotels],
    }


def build_hotel_index_entry(match_id: str, hotel_count: int) -> dict:
    return {
        "match_id": match_id,
        "hotel_count": hotel_count,
    }
