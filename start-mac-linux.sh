#!/usr/bin/env bash
# Starts GyaanSetu. Needs Java 17 or newer (https://adoptium.net).
cd "$(dirname "$0")"
if [ ! -f app/gyaansetu.jar ]; then
  echo "The app files were not found next to this script. Extract the whole zip and run it from the extracted folder."
  exit 1
fi
if ! command -v java >/dev/null 2>&1; then
  echo "Java is not installed. Install Java 17 or newer from https://adoptium.net (Temurin 21 LTS), then run this again."
  exit 1
fi
JV=$(java -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+).*/\1/')
if [ "${JV:-0}" -lt 17 ] 2>/dev/null; then
  echo "Java $JV found, but GyaanSetu needs Java 17 or newer. Install it from https://adoptium.net"
  exit 1
fi
echo "Starting GyaanSetu... your browser will open automatically."
exec java -Dfile.encoding=UTF-8 -jar app/gyaansetu.jar
