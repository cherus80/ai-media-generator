# CapCut Web: импорт субтитров (SRT) для рекламных роликов

Цель: генерировать короткий ролик (MP4 9:16) из примеров приложения **без озвучки и без “вшитых” субтитров**, но с **QR‑кодом в конце**; субтитры накладывать и стилизовать в **CapCut Web** через импорт `.srt`.

## Генерация MP4 + SRT

Скрипт: `scripts/marketing/generate_slideshow_ad.py`

Пример (тег `нейрофотосессия`):

```bash
python3 scripts/marketing/generate_slideshow_ad.py \
  --capcut-web \
  --tag нейрофотосессия \
  --out output/ads/neurophotosession_capcut_web.mp4
```

Результат:
- `output/ads/neurophotosession_capcut_web.mp4` — видео (без аудио), QR‑код в конце “вшит”.
- `output/ads/neurophotosession_capcut_web.srt` — субтитры UTF‑8 с таймкодами под это видео.

Если нужно указать другой путь для SRT:

```bash
python3 scripts/marketing/generate_slideshow_ad.py \
  --capcut-web \
  --tag нейрофотосессия \
  --out output/ads/neurophotosession_capcut_web.mp4 \
  --srt-out output/ads/neurophotosession_capcut_web.srt
```

## Импорт SRT в CapCut Web

1. Откройте CapCut Web и создайте/откройте проект.
2. Импортируйте `*.mp4` на таймлайн.
3. Откройте раздел **Captions/Subtitles** и выберите **Upload caption file**.
4. Загрузите `*.srt`.
5. Настройте стиль/анимацию/шрифт субтитров внутри CapCut.

Справка CapCut (официально): https://www.capcut.com/help/how-to-import-subtitles

