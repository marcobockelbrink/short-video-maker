#!/bin/bash
# Startet/stoppt den Video-Server nur bei Bedarf (kein Autostart).
# Der Pixabay-Schlüssel liegt in .env neben diesem Skript (PIXABAY_API_KEY=...).
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-}" in
  start)
    [ -f .env ] || { echo "Fehlt: .env mit PIXABAY_API_KEY=..."; exit 1; }
    docker run -d --rm --restart no --name short-video-maker -p 127.0.0.1:3123:3123 \
      --env-file .env \
      -e TTS_ENGINE=piper -e WHISPER_MODEL=small -e WHISPER_LANGUAGE=de \
      short-video-maker:lokal >/dev/null
    for _ in $(seq 1 24); do
      curl -sf localhost:3123/health >/dev/null && { echo "läuft auf http://localhost:3123"; exit 0; }
      sleep 5
    done
    echo "startet nicht — docker logs short-video-maker"; exit 1 ;;
  stop)  docker stop short-video-maker ;;
  status) curl -sf localhost:3123/health || echo "aus" ;;
  *) echo "Aufruf: $0 start|stop|status"; exit 1 ;;
esac
