# Tab engine as an AWS Lambda container image (arm64, no Java).
# music21 + Verovio + rsvg-convert + Leipzig. Build with:
#   docker buildx build --platform linux/arm64 -t guitar-chords-engine backend/engine
# The test suite runs inside the image:
#   docker run --rm --entrypoint python guitar-chords-engine -m pytest -q /var/task
FROM public.ecr.aws/lambda/python:3.12-arm64

# librsvg2-tools provides rsvg-convert on Amazon Linux 2023.
RUN dnf install -y librsvg2-tools fontconfig \
    && dnf clean all

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt pytest

# Verovio writes SMuFL text glyphs (e.g. the tempo's note) as <text> in its
# Leipzig font; rsvg-convert needs it installed or prints a missing-glyph box.
ARG LEIPZIG_VERSION=5.2.96
RUN mkdir -p /usr/share/fonts/leipzig \
    && python -c "import urllib.request as u; u.urlretrieve('https://raw.githubusercontent.com/rism-digital/leipzig/${LEIPZIG_VERSION}/Leipzig.otf', '/usr/share/fonts/leipzig/Leipzig.otf')" \
    && fc-cache -f

# Lambda's filesystem is read-only except /tmp; music21 and fontconfig write caches.
ENV HOME=/tmp XDG_CACHE_HOME=/tmp PYTHONUNBUFFERED=1

COPY tabify.py lambda_handler.py test_tabify.py test_operations.py test_lambda_handler.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_handler.handler"]
