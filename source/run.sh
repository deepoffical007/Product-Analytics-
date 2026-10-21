#!/usr/bin/env bash
# Starts GyaanSetu on http://localhost:8080 (embedded Tomcat + H2 database).
# Optional: PORT=9090 ./run.sh   ANTHROPIC_API_KEY=... ./run.sh   DB_URL=jdbc:mysql://... ./run.sh
set -e
cd "$(dirname "$0")"
command -v java >/dev/null || { echo "Java 17+ is required: https://adoptium.net"; exit 1; }
command -v mvn >/dev/null || { echo "Maven 3.8+ is required: https://maven.apache.org/download.cgi"; exit 1; }
mvn -q -B compile exec:exec
