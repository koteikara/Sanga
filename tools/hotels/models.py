"""Internal hotel data models shared by investigation and build scripts."""

from dataclasses import dataclass, field


class ParkingTag(str):
    AVAILABLE_FREE = "available_free"
    AVAILABLE_PAID = "available_paid"
    NONE = "none"
    UNKNOWN = "unknown"


class AccommodationTypeTag(str):
    HOTEL = "hotel"
    RYOKAN = "ryokan"
    UNKNOWN = "unknown"


class PriceTier(str):
    BUDGET = "budget"
    STANDARD = "standard"
    PREMIUM = "premium"


@dataclass(slots=True)
class SearchWindow:
    checkin_date: str
    checkout_date: str
    adult_num: int
    room_num: int = 1


@dataclass(slots=True)
class HotelCandidate:
    hotel_no: int
    hotel_name: str
    stadium_id: str = ""
    latitude: float | None = None
    longitude: float | None = None
    distance_km_from_stadium: float | None = None
    min_charge: int | None = None
    max_charge: int | None = None
    price_tier: str = PriceTier.STANDARD
    parking_tag: str = ParkingTag.UNKNOWN
    parking_raw_text: str | None = None
    accommodation_type_tag: str = AccommodationTypeTag.UNKNOWN
    hotel_class_code_raw: str | None = None
    affiliate_url: str = ""
    sightseeing_friendly: bool | None = None
    stadium_proximity: bool | None = None
    gourmet_area_note: str | None = None
    distance_km: float | None = None
    tags: list[str] = field(default_factory=list)
