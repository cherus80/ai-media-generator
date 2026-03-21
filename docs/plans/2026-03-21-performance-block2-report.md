# Performance Block 2 Report

## Methodology

- Main benchmark: local production-like stand (`build` + local backend/frontend run in prod-like mode).
- Validation benchmark: short production spot-check with the same commands.
- API benchmark:
  - endpoint: `/api/v1/content/examples`
  - runs: minimum 10
  - metrics: `TTFB p50/p95`, `total p50/p95`
- Bundle benchmark:
  - build with Vite manifest
  - metrics:
    - initial JS for `/`
    - initial JS for `/login`
    - top largest JS chunks

## Local Benchmark

### Before

API:

```text
label=local-before
url=http://127.0.0.1:8000/api/v1/content/examples?sort=popular&limit=20&view=card
runs=12
response_bytes=52072
ttfb_p50_ms=17.80
ttfb_p95_ms=22.70
total_p50_ms=17.89
total_p95_ms=22.92
```

Bundle:

```text
{
  "label": "before",
  "entry_files": ["assets/index.BrD3lBJS.js"],
  "largest_js_chunks": [
    {
      "file": "assets/index.BrD3lBJS.js",
      "bytes": 1231334
    }
  ],
  "routes": [
    {
      "route": "/",
      "initial_js_bytes": 1231334
    },
    {
      "route": "/login",
      "initial_js_bytes": 1231334
    }
  ]
}
```

### After

API:

```text
label=local-after
url=http://127.0.0.1:8000/api/v1/content/examples?sort=popular&limit=20&view=card
runs=12
response_bytes=14758
ttfb_p50_ms=3.32
ttfb_p95_ms=3.70
total_p50_ms=3.38
total_p95_ms=3.80
```

Bundle:

```text
{
  "label": "after",
  "entry_files": ["assets/index.D6hUXvek.js"],
  "largest_js_chunks": [
    { "file": "assets/adminRoutes.C7PdAjgQ.js", "bytes": 441875 },
    { "file": "assets/appRoutes.dPJmWiEw.js", "bytes": 218572 },
    { "file": "assets/Layout.v3Zn9uvR.js", "bytes": 194233 },
    { "file": "assets/index.D6hUXvek.js", "bytes": 184250 },
    { "file": "assets/publicRoutes.B_w91HYe.js", "bytes": 73743 },
    { "file": "assets/FileUpload.N5izuIlZ.js", "bytes": 68040 },
    { "file": "assets/authRoutes.DtqTV1C9.js", "bytes": 43841 }
  ],
  "routes": [
    {
      "route": "/",
      "initial_js_bytes": 459387
    },
    {
      "route": "/login",
      "initial_js_bytes": 433516
    }
  ]
}
```

## Production Check

### Before

```text
Pending deploy confirmation.
```

### After

```text
Pending deploy confirmation.
```

## Summary Table

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| API response bytes | 52,072 B | 14,758 B | -37,314 B (-71.66%) |
| API TTFB p50 | 17.80 ms | 3.32 ms | -14.48 ms (-81.35%) |
| API TTFB p95 | 22.70 ms | 3.70 ms | -19.00 ms (-83.70%) |
| API total p50 | 17.89 ms | 3.38 ms | -14.51 ms (-81.11%) |
| API total p95 | 22.92 ms | 3.80 ms | -19.12 ms (-83.42%) |
| Initial JS `/` | 1,231,334 B | 459,387 B | -771,947 B (-62.69%) |
| Initial JS `/login` | 1,231,334 B | 433,516 B | -797,818 B (-64.79%) |

## Largest Chunks Before/After

### Before

```text
assets/index.BrD3lBJS.js  1,231,334 B
```

### After

```text
assets/adminRoutes.C7PdAjgQ.js  441,875 B
assets/appRoutes.dPJmWiEw.js    218,572 B
assets/Layout.v3Zn9uvR.js       194,233 B
assets/index.D6hUXvek.js        184,250 B
assets/publicRoutes.B_w91HYe.js  73,743 B
assets/FileUpload.N5izuIlZ.js    68,040 B
assets/authRoutes.DtqTV1C9.js    43,841 B
```

## Notes

- API benchmark intentionally used the same URL before/after: `?sort=popular&limit=20&view=card`.
- After optimization list payload contains only card fields:
  - `id`, `slug`, `seo_variant_index`, `title`, `description`, `image_url`, `thumbnail_url`, `uses_count`, `tags`
- JSON compression was already enabled in infra and re-verified:
  - [nginx/ai-image-bot.conf](/Users/ruslancernov/Documents/Боты%20на%20Python/ai-media-generator_1/ai-image-generator_antigravity/nginx/ai-image-bot.conf)
  - [frontend/nginx.conf](/Users/ruslancernov/Documents/Боты%20на%20Python/ai-media-generator_1/ai-image-generator_antigravity/frontend/nginx.conf)
