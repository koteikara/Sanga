"""Rakuten Travel API client for Sanga hotel tooling."""

from __future__ import annotations

import os

import requests
from dotenv import load_dotenv


VACANT_HOTEL_SEARCH_URL = "https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426"


class RakutenCredentialsMissingError(RuntimeError):
    """Raised when the Rakuten credentials are not configured."""


def load_rakuten_credentials() -> dict[str, str]:
    load_dotenv()

    credentials = {
        "applicationId": os.getenv("RAKUTEN_APP_ID", ""),
        "affiliateId": os.getenv("RAKUTEN_AFFILIATE_ID", ""),
        "accessKey": os.getenv("RAKUTEN_ACCESS_KEY", ""),
    }
    missing = [key for key, value in credentials.items() if not value and key != "affiliateId"]
    if missing:
        raise RakutenCredentialsMissingError(
            "RAKUTEN_APP_ID, RAKUTEN_AFFILIATE_ID and RAKUTEN_ACCESS_KEY must be set"
        )
    return credentials


def build_base_params() -> dict[str, str]:
    return {
        **load_rakuten_credentials(),
        "format": "json",
    }


def search_vacant_hotels(
    latitude: float,
    longitude: float,
    checkin_date: str,
    checkout_date: str,
    adult_num: int = 1,
    up_class_num: int = 0,
    low_class_num: int = 0,
    squeeze_condition: int | None = None,
    search_radius: int = 3,
    hits: int = 30,
    referer: str | None = None,
) -> dict:
    """Call Rakuten Vacant Hotel Search API and return JSON payload."""

    params = {
        **build_base_params(),
        "latitude": latitude,
        "longitude": longitude,
        "searchRadius": search_radius,
        "checkinDate": checkin_date,
        "checkoutDate": checkout_date,
        "adultNum": adult_num,
        "upClassNum": up_class_num,
        "lowClassNum": low_class_num,
        "hits": hits,
    }
    if squeeze_condition is not None:
        params["squeezeCondition"] = squeeze_condition

    if referer is None:
        referer = os.getenv("RAKUTEN_REFERER")
    headers = {"Referer": referer} if referer else {}

    response = requests.get(VACANT_HOTEL_SEARCH_URL, params=params, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()
