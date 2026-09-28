"""Extract each detector's WCS-WAVE lookup table from real Level 2 files.

The tables are detector calibrations (identical across weeks within a release), so a copy of one
per release and detector lets the service estimate the wavelength at a target from search results
alone, before reading any pixels. When a frame's pixels are read, its own table is used instead.

Usage: uv run python scripts/extract_wave_tables.py
Writes src/spherex_explorer/archive/wave_tables.json.
"""

import asyncio
import csv
import io
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx

from spherex_explorer.archive.fits_range import HttpRangeSource, read_header_at
from spherex_explorer.archive.level2 import _parse_wave
from spherex_explorer.config import get_settings

OUT = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "spherex_explorer"
    / "archive"
    / "wave_tables.json"
)
# M31 is covered by all six detectors in both releases.
RA, DEC = 10.6847, 41.2690


async def main() -> None:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=120) as client:
        params = [("COLLECTION", c) for c in settings.wide_collections]
        params += [("POS", f"circle {RA} {DEC} 0.0003"), ("RESPONSEFORMAT", "CSV")]
        rows = list(
            csv.DictReader(io.StringIO((await client.get(settings.sia_url, params=params)).text))
        )
        chosen: dict[tuple[str, int], str] = {}
        for row in rows:
            key = row["access_url"].split("/ibe/data/spherex/", 1)[1]
            release = key.split("/", 1)[0]
            detector = int(row["energy_bandpassname"][-1])
            chosen.setdefault((release, detector), key)

        tables: dict[str, dict[str, object]] = {}
        for (release, detector), key in sorted(chosen.items()):
            source = HttpRangeSource(client, settings.s3_url + key, "S3")
            table = _parse_wave(await source.read_suffix(2 * 2880))
            header, _ = await read_header_at(source, 2880)
            assert table is not None, key
            tables[f"{release}:D{detector}"] = {
                "source": key,
                "crpixW": [header.get("CRPIX1W"), header.get("CRPIX2W")],
                "crvalW": [header.get("CRVAL1W"), header.get("CRVAL2W")],
                **table.to_json(),
            }
            wl = table.wavelength
            print(
                f"{release} D{detector}: {wl.min():.3f}–{wl.max():.3f} µm, grid {wl.shape}, "
                f"CRPIXW {header.get('CRPIX1W')},{header.get('CRPIX2W')} from {key.split('/')[-1]}"
            )

    OUT.write_text(
        json.dumps(
            {
                "about": "WCS-WAVE tables per release and detector, from the files listed.",
                "extracted": datetime.now(UTC).strftime("%Y-%m-%d"),
                "tables": tables,
            },
            indent=1,
        )
        + "\n"
    )
    print("wrote", OUT)


if __name__ == "__main__":
    asyncio.run(main())
