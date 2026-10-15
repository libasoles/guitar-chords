# PDF score -> MusicXML with Audiveris, as an ephemeral Fargate task (arm64).
# Audiveris only ships x86_64 Linux packages, so it is built from source here:
# the image is native on Graviton Fargate. Build with:
#   docker buildx build --platform linux/arm64 -t guitar-chords-ocr backend/ocr
ARG AUDIVERIS_VERSION=5.11.0

FROM eclipse-temurin:25-jdk AS audiveris
ARG AUDIVERIS_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${AUDIVERIS_VERSION}" \
      https://github.com/Audiveris/audiveris.git /src
WORKDIR /src
RUN ./gradlew --no-daemon :app:installDist \
    && mv app/build/install/app /opt/audiveris

FROM eclipse-temurin:25-jre
# Audiveris looks up its XDG folders through GTK, even in -batch mode.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      fonts-liberation \
      libgtk-3-0t64 \
      python3 \
      python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --break-system-packages boto3

COPY --from=audiveris /opt/audiveris /opt/audiveris
# Tesseract language data for titles/lyrics (notes do not need it)
ENV TESSDATA_PREFIX=/opt/tessdata
RUN mkdir -p /opt/tessdata \
    && curl -fsSL https://github.com/tesseract-ocr/tessdata/raw/4.1.0/eng.traineddata -o /opt/tessdata/eng.traineddata \
    && curl -fsSL https://github.com/tesseract-ocr/tessdata/raw/4.1.0/spa.traineddata -o /opt/tessdata/spa.traineddata

COPY run.py /opt/ocr/run.py

# Unprivileged user; Audiveris writes its config/cache under HOME.
RUN useradd --create-home --uid 10001 ocr
USER ocr
ENV PATH="/opt/audiveris/bin:${PATH}" PYTHONUNBUFFERED=1 HOME=/home/ocr
# JVM heap is bounded by run.py (OMR_MAX_HEAP_MB), not by the base image defaults.
ENTRYPOINT ["python3", "/opt/ocr/run.py"]
