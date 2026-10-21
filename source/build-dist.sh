#!/usr/bin/env bash
# Builds the run-anywhere distribution: target/dist/GyaanSetu/ and target/GyaanSetu.zip
set -e
cd "$(dirname "$0")"
mvn -q -B package
D=target/dist/GyaanSetu
rm -rf target/dist && mkdir -p "$D/app" "$D/docs" "$D/source"
cp target/gyaansetu-app.jar "$D/app/gyaansetu.jar"
cp -r target/lib "$D/app/lib"
cp -r src/main/webapp "$D/app/web" && rm -rf "$D/app/web/WEB-INF" "$D/app/web/META-INF"
cp dist-files/README.txt dist-files/START-WINDOWS.bat dist-files/start-mac-linux.sh "dist-files/Start GyaanSetu (Mac).command" dist-files/Dockerfile "$D/"
chmod +x "$D/start-mac-linux.sh" "$D/Start GyaanSetu (Mac).command"
cp docs/GyaanSetu-Reference-Guide.md "$D/docs/"
tar --exclude=./target --exclude='./*.png' -cf - . | (cd "$D/source" && tar -xf -)
sed -i 's/$/\r/' "$D/START-WINDOWS.bat" "$D/README.txt"
cp dist-files/render.yaml "$D/" && printf 'runtime/\ngyaansetu-log.txt\nsource/target/\n' > "$D/.gitignore"
(cd target/dist && rm -f ../GyaanSetu.zip && zip -qr -X ../GyaanSetu.zip GyaanSetu)
echo "Built target/GyaanSetu.zip"
# Windows package with Java included: WIN_JRE=/path/to/extracted/jre ./build-dist.sh
if [ -n "$WIN_JRE" ] && [ -d "$WIN_JRE/bin" ]; then
  cp -r "$WIN_JRE" "$D/runtime"
  (cd target/dist && rm -f ../GyaanSetu-Windows.zip && zip -qr -X ../GyaanSetu-Windows.zip GyaanSetu)
  rm -rf "$D/runtime"
  echo "Built target/GyaanSetu-Windows.zip (includes Java)"
fi
