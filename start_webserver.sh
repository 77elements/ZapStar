#!/bin/bash
# Startet einen einfachen Python HTTP-Server für die lokale Entwicklung.

PORT=8000
echo "ZapStar Webserver wird gestartet auf http://localhost:$PORT"
echo "Drücke Strg+C, um den Server zu beenden."

# Prüfen, ob Python 3 verfügbar ist
if command -v python3 &> /dev/null
then
    python3 -m http.server $PORT
elif command -v python &> /dev/null
then
    python -m SimpleHTTPServer $PORT
else
    echo "Fehler: Python nicht gefunden. Bitte installiere Python, um den Webserver zu starten."
    exit 1
fi
