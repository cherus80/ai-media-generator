#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageDraw, ImageFont


APP_BASE_URL_DEFAULT = "https://ai-generator.mix4.ru"
EXAMPLES_API_PATH = "/api/v1/content/examples"
HTTP = requests.Session()
# Не используем переменные окружения типа HTTP_PROXY/HTTPS_PROXY по умолчанию:
# они часто ломают доступ к публичному домену или дают 502 от прокси.
HTTP.trust_env = False


@dataclass(frozen=True)
class ExampleItem:
    id: int
    slug: str
    title: str
    image_url: str
    uses_count: int
    tags: list[str]


def run(cmd: list[str]) -> None:
    print("+", " ".join(shlex_quote(x) for x in cmd))
    subprocess.run(cmd, check=True)


def shlex_quote(s: str) -> str:
    if not s:
        return "''"
    if all(c.isalnum() or c in ("-", "_", ".", "/", ":", "@") for c in s):
        return s
    return "'" + s.replace("'", "'\"'\"'") + "'"


def require_bin(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"Не найден бинарник `{name}` в PATH.")
    return path


def fetch_examples(base_url: str, tags: list[str], limit: int, sort: str) -> list[ExampleItem]:
    url = base_url.rstrip("/") + EXAMPLES_API_PATH
    params = {"sort": sort, "limit": str(limit)}
    if tags:
        params["tags"] = ",".join(tags)
    r = HTTP.get(url, params=params, timeout=30)
    r.raise_for_status()
    payload = r.json()
    items = payload.get("items") or []
    out: list[ExampleItem] = []
    for it in items:
        try:
            out.append(
                ExampleItem(
                    id=int(it["id"]),
                    slug=str(it.get("slug") or ""),
                    title=str(it.get("title") or ""),
                    image_url=str(it.get("image_url") or ""),
                    uses_count=int(it.get("uses_count") or 0),
                    tags=[str(t) for t in (it.get("tags") or [])],
                )
            )
        except Exception:
            continue
    return out


def absolutize_image_url(base_url: str, image_url: str) -> str:
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return image_url
    return base_url.rstrip("/") + "/" + image_url.lstrip("/")


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with HTTP.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)


def try_generate_qr_png(url: str, out_path: Path, size_px: int = 512) -> bool:
    """
    Prefer local QR generator if available; fallback to a hosted QR render.
    """
    try:
        import segno  # type: ignore

        qr = segno.make(url, error="m")
        qr.save(str(out_path), scale=max(1, size_px // 29), border=2)  # 29 ~= v3-ish
        return True
    except Exception:
        pass

    qr_api = "https://api.qrserver.com/v1/create-qr-code/"
    params = {"size": f"{size_px}x{size_px}", "data": url}
    qr_url = qr_api + "?" + urllib.parse.urlencode(params, safe=":/")
    try:
        download(qr_url, out_path)
        return True
    except Exception:
        return False


def write_text_file(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + "\n", encoding="utf-8")


def ffprobe_duration_seconds(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nk=1:nw=1",
        str(path),
    ]
    out = subprocess.check_output(cmd).decode("utf-8", errors="replace").strip()
    try:
        return float(out)
    except Exception:
        return 0.0


def tts_macos_say_to_wav(
    *,
    say_voice: str,
    say_rate: int,
    text: str,
    out_wav: Path,
    workdir: Path,
) -> None:
    require_bin("say")
    require_bin("ffmpeg")
    tts_aiff = workdir / "tts.aiff"
    run(["say", "-v", say_voice, "-r", str(say_rate), "-o", str(tts_aiff), text])
    run(["ffmpeg", "-y", "-i", str(tts_aiff), "-ar", "44100", "-ac", "2", str(out_wav)])


def tts_edge_to_wav(
    *,
    edge_voice: str,
    edge_rate: str,
    text: str,
    out_wav: Path,
    workdir: Path,
) -> None:
    """
    Требует установленный пакет edge-tts (CLI `edge-tts`).
    Удобный бесплатный нейронный TTS (качество RU обычно заметно лучше macOS `say`).
    """
    require_bin("ffmpeg")
    edge_cli = shutil.which("edge-tts")
    edge_cmd: list[str]
    if edge_cli:
        edge_cmd = [edge_cli]
    else:
        # Частый случай на macOS: `edge-tts` ставится в каталог bin не в PATH.
        # Надёжнее запускать через python module.
        edge_cmd = [sys.executable, "-m", "edge_tts"]

    mp3 = workdir / "tts.mp3"
    run(
        edge_cmd
        + [
            "--voice",
            edge_voice,
            "--rate",
            edge_rate,
            "--text",
            text,
            "--write-media",
            str(mp3),
        ]
    )
    run(["ffmpeg", "-y", "-i", str(mp3), "-ar", "44100", "-ac", "2", str(out_wav)])


def _load_font(font_path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(font_path), size=size)


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> str:
    words = text.replace("\n", " ").split()
    if not words:
        return ""
    lines: list[str] = []
    current: list[str] = []
    for w in words:
        trial = (" ".join(current + [w])).strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] <= max_width or not current:
            current.append(w)
            continue
        lines.append(" ".join(current))
        current = [w]
    if current:
        lines.append(" ".join(current))
    return "\n".join(lines)


def _draw_text_with_stroke(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
    stroke_fill: tuple[int, int, int, int],
    stroke_width: int,
) -> None:
    draw.multiline_text(
        xy,
        text,
        font=font,
        fill=fill,
        stroke_fill=stroke_fill,
        stroke_width=stroke_width,
        align="center",
        spacing=10,
    )


def make_fullscreen_overlay_png(
    *,
    out_path: Path,
    size: tuple[int, int],
    dim_alpha: int,
    font_bold: Path,
    main_text: str,
    main_font_size: int,
    main_y: int,
    left_text: str | None = None,
    left_font_size: int | None = None,
    left_xy: tuple[int, int] | None = None,
) -> None:
    w, h = size
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if dim_alpha > 0:
        draw.rectangle([0, 0, w, h], fill=(0, 0, 0, dim_alpha))

    font_main = _load_font(font_bold, main_font_size)
    wrapped = _wrap_text(draw, main_text, font_main, max_width=w - 140)
    bbox = draw.multiline_textbbox((0, 0), wrapped, font=font_main, spacing=10, align="center")
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (w - text_w) // 2
    y = max(0, main_y - text_h // 2)
    _draw_text_with_stroke(
        draw,
        (x, y),
        wrapped,
        font_main,
        fill=(255, 255, 255, 255),
        stroke_fill=(0, 0, 0, 170),
        stroke_width=8,
    )

    if left_text and left_font_size and left_xy:
        font_left = _load_font(font_bold, left_font_size)
        _draw_text_with_stroke(
            draw,
            left_xy,
            left_text,
            font_left,
            fill=(255, 255, 255, 255),
            stroke_fill=(0, 0, 0, 170),
            stroke_width=6,
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")


def make_caption_overlay_png(
    *,
    out_path: Path,
    size: tuple[int, int],
    font_bold: Path,
    text: str,
    y: int,
) -> None:
    w, h = size
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = _load_font(font_bold, 60)
    wrapped = _wrap_text(draw, text, font, max_width=w - 160)
    bbox = draw.multiline_textbbox((0, 0), wrapped, font=font, spacing=10, align="center")
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (w - text_w) // 2
    y0 = max(0, y - text_h // 2)
    _draw_text_with_stroke(
        draw,
        (x, y0),
        wrapped,
        font,
        fill=(255, 255, 255, 255),
        stroke_fill=(0, 0, 0, 170),
        stroke_width=7,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")


def build_segments(
    *,
    workdir: Path,
    images: list[Path],
    qr_png: Path,
    font_bold: Path,
    app_domain_text: str,
) -> list[Path]:
    require_bin("ffmpeg")

    seg_paths: list[Path] = []
    fps = 30
    w, h = 1080, 1920
    hook_frames = int(1.2 * fps)
    show_frames = int(1.25 * fps)
    cta_frames = int(3.2 * fps)

    # Segment 0: hook
    hook = workdir / "seg00_hook.mp4"
    hook_overlay = workdir / "assets" / "overlay_hook.png"
    hook_text = "ТВОЁ ФОТО → НЕЙРОФОТОСЕССИЯ"
    make_fullscreen_overlay_png(
        out_path=hook_overlay,
        size=(w, h),
        dim_alpha=90,
        font_bold=font_bold,
        main_text=hook_text,
        main_font_size=80,
        main_y=int(h * 0.43),
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(images[0]),
            "-loop",
            "1",
            "-i",
            str(hook_overlay),
            "-filter_complex",
            ";".join(
                [
                    f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},gblur=sigma=18,eq=contrast=1.05:saturation=1.05:brightness=-0.03,fps={fps},format=yuv420p[bg]",
                    "[1:v]format=rgba[ov]",
                    "[bg][ov]overlay=0:0:format=auto[vout]",
                ]
            ),
            "-map",
            "[vout]",
            "-frames:v",
            str(hook_frames),
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(hook),
        ]
    )
    seg_paths.append(hook)

    # Showcase segments
    for idx, img in enumerate(images[:6], start=1):
        out = workdir / f"seg{idx:02d}_show.mp4"
        # Simple ken-burns zoom-in
        vf = ",".join(
            [
                f"scale={w}:{h}:force_original_aspect_ratio=increase",
                f"crop={w}:{h}",
                (
                    "zoompan="
                    "z='min(zoom+0.0025,1.12)':"
                    "x='iw/2-(iw/zoom/2)':"
                    "y='ih/2-(ih/zoom/2)':"
                    f"d={show_frames}:"
                    f"s={w}x{h}:"
                    f"fps={fps}"
                ),
                "eq=contrast=1.06:saturation=1.06",
                "format=yuv420p",
            ]
        )
        run(
            [
                "ffmpeg",
                "-y",
                "-loop",
                "1",
                "-i",
                str(img),
                "-vf",
                vf,
                "-frames:v",
                str(show_frames),
                "-r",
                str(fps),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                str(out),
            ]
        )
        seg_paths.append(out)

    # CTA segment with QR + domain
    cta = workdir / "seg99_cta.mp4"
    cta_overlay = workdir / "assets" / "overlay_cta.png"
    cta_text = "Загрузи фото → выбери пример\nПолучишь фото в этом стиле"
    make_fullscreen_overlay_png(
        out_path=cta_overlay,
        size=(w, h),
        dim_alpha=90,
        font_bold=font_bold,
        main_text=cta_text,
        main_font_size=66,
        main_y=int(h * 0.45),
        left_text=app_domain_text,
        left_font_size=54,
        left_xy=(70, int(h * 0.78)),
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(images[0]),
            "-i",
            str(qr_png),
            "-loop",
            "1",
            "-i",
            str(cta_overlay),
            "-filter_complex",
            ";".join(
                [
                    f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},gblur=sigma=22,eq=brightness=-0.05:saturation=1.0,fps={fps},format=yuv420p[bg]",
                    "[1:v]scale=420:420:force_original_aspect_ratio=decrease,pad=460:460:(ow-iw)/2:(oh-ih)/2:color=white@1,format=rgba[qr]",
                    "[2:v]format=rgba[ov]",
                    "[bg][qr]overlay=x=W-w-70:y=H-h-120:format=auto[bgqr]",
                    "[bgqr][ov]overlay=0:0:format=auto[vout]",
                ]
            ),
            "-map",
            "[vout]",
            "-frames:v",
            str(cta_frames),
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(cta),
        ]
    )
    seg_paths.append(cta)

    return seg_paths


def concat_segments(workdir: Path, segments: list[Path]) -> Path:
    require_bin("ffmpeg")
    concat_txt = workdir / "concat.txt"
    concat_txt.write_text("".join([f"file '{p.as_posix()}'\n" for p in segments]), encoding="utf-8")
    out = workdir / "video_concat.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_txt),
            "-c",
            "copy",
            str(out),
        ]
    )
    return out


def add_voice_and_captions(
    *,
    workdir: Path,
    video_in: Path,
    voice_wav: Path,
    font_bold: Path,
    captions: list[tuple[float, float, str]],
    out_path: Path,
) -> None:
    require_bin("ffmpeg")

    # Create caption text files (drawtext textfile is safer for Cyrillic).
    w, h = 1080, 1920
    caption_pngs: list[Path] = []
    for i, (_, _, text) in enumerate(captions, start=1):
        p = workdir / f"cap{i:02d}.png"
        make_caption_overlay_png(
            out_path=p,
            size=(w, h),
            font_bold=font_bold,
            text=text,
            y=int(h * 0.78),
        )
        caption_pngs.append(p)

    # Build overlay chain with enable windows.
    # Inputs: 0 video, 1 audio, then captions as images.
    cmd: list[str] = ["ffmpeg", "-y", "-i", str(video_in), "-i", str(voice_wav)]
    for p in caption_pngs:
        cmd += ["-loop", "1", "-i", str(p)]

    filter_parts: list[str] = ["[0:v]format=yuv420p[v0]"]
    last = "v0"
    for i, (t0, t1, _) in enumerate(captions, start=1):
        inp = f"{i+1}:v"  # 2.. inputs in ffmpeg indexing; i=1 => 2:v
        out = f"v{i}"
        filter_parts.append(
            f"[{last}][{inp}]overlay=0:0:format=auto:shortest=1:enable='between(t,{t0:.2f},{t1:.2f})'[{out}]"
        )
        last = out

    cmd += [
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        f"[{last}]",
        "-map",
        "1:a",
        "-af",
        "apad=pad_dur=60",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-shortest",
        str(out_path),
    ]
    run(cmd)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Генерация короткого рекламного ролика (слайд-шоу) из примеров приложения.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """
            Пример:
              python3 scripts/marketing/generate_slideshow_ad.py --tag нейрофотосессия --out output/ads/neuro.mp4
            """
        ),
    )
    parser.add_argument("--base-url", default=APP_BASE_URL_DEFAULT, help="Базовый URL приложения")
    parser.add_argument("--tag", default="нейрофотосессия", help="Тег примеров (как в приложении)")
    parser.add_argument("--limit", type=int, default=12, help="Сколько примеров загрузить (выберем первые 6)")
    parser.add_argument("--sort", default="popular", choices=["popular", "newest"], help="Сортировка примеров")
    parser.add_argument("--url", default=APP_BASE_URL_DEFAULT + "/", help="URL, который кодируем в QR")
    parser.add_argument("--out", required=True, help="Путь для итогового MP4")
    parser.add_argument(
        "--tts",
        default="edge",
        choices=["edge", "macos"],
        help="Движок озвучки (edge — нейронный, macos — встроенный `say`)",
    )
    parser.add_argument("--voice", default="Milena", help="macOS voice для `say` (например: Milena)")
    parser.add_argument("--rate", type=int, default=185, help="Скорость речи `say` (слов/мин примерно)")
    parser.add_argument(
        "--edge-voice",
        default="ru-RU-SvetlanaNeural",
        help="Голос для edge-tts (пример: ru-RU-SvetlanaNeural, ru-RU-DmitryNeural)",
    )
    parser.add_argument(
        "--edge-rate",
        default="+20%",
        help="Скорость edge-tts (например: +10%, +25%, -10%)",
    )
    args = parser.parse_args()

    require_bin("ffmpeg")
    require_bin("ffprobe")

    font_bold = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
    if not font_bold.exists():
        raise SystemExit(f"Не найден шрифт: {font_bold}")

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    tag = str(args.tag).strip().lower()
    examples = fetch_examples(args.base_url, [tag] if tag else [], args.limit, args.sort)
    examples = [e for e in examples if e.image_url]
    if len(examples) < 3:
        raise SystemExit("Недостаточно примеров с картинками для ролика.")

    # Choose top 6
    chosen = examples[:6]
    ts = time.strftime("%Y%m%d-%H%M%S")
    workdir = Path(tempfile.mkdtemp(prefix=f"slideshow-ad-{tag}-{ts}-"))
    print("workdir:", workdir)

    try:
        imgs: list[Path] = []
        for i, ex in enumerate(chosen, start=1):
            img_url = absolutize_image_url(args.base_url, ex.image_url)
            ext = Path(urllib.parse.urlparse(img_url).path).suffix or ".img"
            dest = workdir / "assets" / f"img{i:02d}{ext}"
            print(f"download: {img_url} -> {dest.name}")
            download(img_url, dest)
            imgs.append(dest)

        qr_png = workdir / "assets" / "qr.png"
        ok = try_generate_qr_png(args.url, qr_png)
        if not ok or not qr_png.exists():
            raise SystemExit("Не удалось сгенерировать QR-код (ни локально, ни через fallback).")

        voice_text = (
            "Хочешь такое фото? "
            "Загрузи своё. "
            "Выбери пример «Нейрофотосессия» — получишь фото в этом стиле. "
            "Сканируй QR: ai-generator.mix4.ru."
        )
        tts_wav = workdir / "tts.wav"
        if args.tts == "macos":
            tts_macos_say_to_wav(
                say_voice=str(args.voice),
                say_rate=int(args.rate),
                text=voice_text,
                out_wav=tts_wav,
                workdir=workdir,
            )
        else:
            tts_edge_to_wav(
                edge_voice=str(args.edge_voice),
                edge_rate=str(args.edge_rate),
                text=voice_text,
                out_wav=tts_wav,
                workdir=workdir,
            )

        segments = build_segments(
            workdir=workdir,
            images=imgs,
            qr_png=qr_png,
            font_bold=font_bold,
            app_domain_text="ai-generator.mix4.ru",
        )
        video_concat = concat_segments(workdir, segments)

        audio_dur = ffprobe_duration_seconds(tts_wav)
        video_dur = ffprobe_duration_seconds(video_concat)
        # Caption timings (simple, aligned to the approximate rhythm)
        total = max(video_dur, audio_dur + 0.4)
        # Cap windows in the cut (hook+6*1.25+cta≈11.9s). Use measured duration.
        captions = [
            (0.0, 2.6, "Хочешь такое фото?"),
            (2.6, 8.8, "Загрузи фото → выбери пример «Нейрофотосессия»"),
            (8.8, min(12.5, max(9.8, video_dur - 0.2)), "Получишь фото в этом стиле • ai-generator.mix4.ru"),
        ]

        final_mp4 = out_path
        add_voice_and_captions(
            workdir=workdir,
            video_in=video_concat,
            voice_wav=tts_wav,
            font_bold=font_bold,
            captions=captions,
            out_path=final_mp4,
        )

        print("OK:", final_mp4)
        print(f"(audio_dur={audio_dur:.2f}s, video_dur={video_dur:.2f}s, target_total~{total:.2f}s)")
        return 0
    finally:
        # Keep workdir for debugging if desired:
        # print("Keeping workdir:", workdir)
        pass


if __name__ == "__main__":
    raise SystemExit(main())
