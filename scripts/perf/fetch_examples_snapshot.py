#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from urllib.request import urlopen

SNAPSHOT_URL = "https://ai-generator.mix4.ru/api/v1/content/examples?sort=popular&limit=50"
SNAPSHOT_PATH = Path("output/perf/examples_snapshot.json")


def main() -> None:
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SNAPSHOT_PATH.exists():
        print(SNAPSHOT_PATH)
        return

    with urlopen(SNAPSHOT_URL) as response:
        payload = json.load(response)

    with SNAPSHOT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)

    print(SNAPSHOT_PATH)


if __name__ == "__main__":
    main()
