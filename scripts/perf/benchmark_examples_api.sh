#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <label> <url> [runs]" >&2
  exit 1
fi

label="$1"
url="$2"
runs="${3:-12}"
curl_args=(-sS -o /dev/null -w "%{time_starttransfer} %{time_total} %{size_download}\n")

if [[ "$url" == http://127.0.0.1* || "$url" == http://localhost* || "$url" == https://127.0.0.1* || "$url" == https://localhost* ]]; then
  curl_args+=(--noproxy '*')
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

for i in $(seq 1 "$runs"); do
  curl "${curl_args[@]}" "$url" >> "$tmp_file"
done

python3 - "$label" "$url" "$runs" "$tmp_file" <<'PY'
import statistics
import sys

label, url, runs, path = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]

ttfb = []
total = []
sizes = []

with open(path, "r", encoding="utf-8") as fh:
    for line in fh:
        starttransfer, total_time, size_download = line.strip().split()
        ttfb.append(float(starttransfer) * 1000)
        total.append(float(total_time) * 1000)
        sizes.append(int(size_download))

def percentile(values, p):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((p / 100) * (len(ordered) - 1))))
    return ordered[index]

print(f"label={label}")
print(f"url={url}")
print(f"runs={runs}")
print(f"response_bytes={statistics.median(sizes):.0f}")
print(f"ttfb_p50_ms={statistics.median(ttfb):.2f}")
print(f"ttfb_p95_ms={percentile(ttfb, 95):.2f}")
print(f"total_p50_ms={statistics.median(total):.2f}")
print(f"total_p95_ms={percentile(total, 95):.2f}")
PY
