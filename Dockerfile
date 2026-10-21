# Run GyaanSetu in Docker (works on any machine or cloud host that runs containers):
#   docker build -t gyaansetu .
#   docker run -p 8080:8080 -v gyaansetu-data:/data gyaansetu
# Add -e ANTHROPIC_API_KEY=sk-ant-... to enable Claude.
FROM eclipse-temurin:21-jre
WORKDIR /opt/gyaansetu
COPY app/ ./app/
ENV PORT=8080 \
    NO_BROWSER=1 \
    DB_URL="jdbc:h2:file:/data/gyaansetu;MODE=MySQL;DATABASE_TO_LOWER=TRUE"
RUN mkdir -p /data
EXPOSE 8080
CMD ["java", "-Dfile.encoding=UTF-8", "-jar", "app/gyaansetu.jar"]
