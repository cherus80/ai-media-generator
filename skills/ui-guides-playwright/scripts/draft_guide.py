#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def _slugify(value: str) -> str:
    safe = []
    for ch in value.lower().strip():
        if ch.isalnum():
            safe.append(ch)
        elif ch in ("-", "_", " "):
            safe.append("-")
    out = "".join(safe)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-") or "guide"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a Markdown guide draft from Playwright screenshot manifest.json")
    parser.add_argument("--manifest", required=True, help="Path to manifest.json from capture script")
    parser.add_argument("--slug", required=True, help="Guide slug (used for headings/paths)")
    parser.add_argument("--title", required=True, help="Guide title")
    parser.add_argument("--out", required=True, help="Output Markdown path")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    data = json.loads(manifest_path.read_text("utf-8"))

    slug = _slugify(args.slug)
    title = args.title.strip()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    screenshots = data.get("screenshots", [])
    lines: list[str] = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append("> Черновик. Основан на реальных скриншотах интерфейса (prod).")
    lines.append("")
    lines.append("## Кому подойдёт")
    lines.append("- (заполнить) Например: новичкам, кто впервые зашёл в приложение")
    lines.append("")
    lines.append("## Что вы получите")
    lines.append("- (заполнить) Например: первую примерку и первое редактирование изображения")
    lines.append("")
    lines.append("## Шаги")
    lines.append("")

    for idx, shot in enumerate(screenshots, start=1):
        name = shot.get("name", f"step-{idx:02d}")
        file_path = shot.get("file", "")
        url = shot.get("url", "")
        lines.append(f"### Шаг {idx}. {name}")
        if url:
            lines.append(f"- Экран: `{url}`")
        if file_path:
            lines.append(f"- Скриншот: `{file_path}`")
        lines.append("- Что сделать: (описать действие пользователя)")
        lines.append("- Что увидеть: (описать ожидаемый результат)")
        lines.append("")

    lines.append("## Частые вопросы")
    lines.append("- (заполнить)")
    lines.append("")
    lines.append("## CTA")
    lines.append("- (заполнить) Призыв: зарегистрироваться/попробовать примерку/посмотреть примеры")
    lines.append("")

    out_path.write_text("\n".join(lines), "utf-8")
    print(f"OK: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

