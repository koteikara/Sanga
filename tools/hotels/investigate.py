"""CLI for Rakuten API investigation from the Sanga repo."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from rakuten_client import search_vacant_hotels  # noqa: E402

ADULT_PARAM_VARIANTS = [
    {"adult_num": 1, "up_class_num": 0, "low_class_num": 0},
    {"adult_num": 2, "up_class_num": 0, "low_class_num": 0},
    {"adult_num": 2, "up_class_num": 1, "low_class_num": 1},
]

REQUEST_INTERVAL_SECONDS = 1.0


def save_json(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def run_investigation(
    name: str,
    latitude: float,
    longitude: float,
    checkin_date: str,
    checkout_date: str,
    data_dir: Path,
    search_fn=search_vacant_hotels,
    sleep_fn=time.sleep,
) -> list[Path]:
    """Run three adult count variants and persist JSON responses."""

    saved_paths: list[Path] = []
    for i, variant in enumerate(ADULT_PARAM_VARIANTS):
        result = search_fn(
            latitude=latitude,
            longitude=longitude,
            checkin_date=checkin_date,
            checkout_date=checkout_date,
            **variant,
        )
        out_path = data_dir / f"{name}_variant{i}.json"
        save_json(result, out_path)
        saved_paths.append(out_path)
        if i < len(ADULT_PARAM_VARIANTS) - 1:
            sleep_fn(REQUEST_INTERVAL_SECONDS)

    return saved_paths


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="output file prefix")
    parser.add_argument("--lat", required=True, type=float)
    parser.add_argument("--lon", required=True, type=float)
    parser.add_argument("--checkin", required=True, help="YYYY-MM-DD")
    parser.add_argument("--checkout", required=True, help="YYYY-MM-DD")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=CURRENT_DIR.parent.parent / "data" / "api_samples",
        help="directory for raw API response JSON",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    saved_paths = run_investigation(
        name=args.name,
        latitude=args.lat,
        longitude=args.lon,
        checkin_date=args.checkin,
        checkout_date=args.checkout,
        data_dir=args.data_dir,
    )
    for path in saved_paths:
        print(f"saved: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
