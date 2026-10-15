FROM ubuntu:22.04 AS install-whisper
ENV DEBIAN_FRONTEND=noninteractive
RUN apt update
# whisper install dependencies
RUN apt install -y \
    git \
    build-essential \
    wget \
    cmake \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /whisper
RUN git clone https://github.com/ggml-org/whisper.cpp.git .
RUN git checkout v1.7.1
RUN make
WORKDIR /whisper/models
RUN sh ./download-ggml-model.sh tiny.en
# Abwandlung: mehrsprachiges Modell, damit deutsche Untertitel funktionieren
RUN sh ./download-ggml-model.sh small

FROM node:22-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app
RUN apt update
RUN apt install -y \
      # whisper dependencies
      git \
      wget \
      cmake \
      ffmpeg \
      curl \
      make \
      libsdl2-dev \
      # remotion dependencies
      libnss3 \
      libdbus-1-3 \
      libatk1.0-0 \
      libgbm-dev \
      libasound2 \
      libxrandr2 \
      libxkbcommon-dev \
      libxfixes3 \
      libxcomposite1 \
      libxdamage1 \
      libatk-bridge2.0-0 \
      libpango-1.0-0 \
      libcairo2 \
      libcups2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
# setup pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml* /app/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
RUN pnpm install --prefer-offline --no-cache --prod

FROM prod-deps AS build
COPY tsconfig.json /app
COPY tsconfig.build.json /app
COPY vite.config.ts /app
COPY src /app/src
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build

FROM base
# Abwandlung: Piper (offline) mit der deutschen Stimme Thorsten (CC0).
# Alles per Prüfsumme festgenagelt; gewählt wird sie mit TTS_ENGINE=piper.
ARG TARGETARCH
ARG PIPER_VERSION=2023.11.14-2
ARG VOICES_REV=c10ece1aade47bb51c153c893d14e5bf8e5b7117
RUN set -eux; \
    case "$TARGETARCH" in \
      arm64) ARCH=aarch64; SUM=fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb ;; \
      amd64) ARCH=x86_64;  SUM=a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992 ;; \
      *) echo "Architektur $TARGETARCH nicht vorgesehen"; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/piper.tgz "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_${ARCH}.tar.gz"; \
    echo "${SUM}  /tmp/piper.tgz" | sha256sum -c -; \
    tar -xzf /tmp/piper.tgz -C /opt; \
    mkdir -p /opt/piper/voices; \
    V="https://huggingface.co/rhasspy/piper-voices/resolve/${VOICES_REV}/de/de_DE/thorsten/medium/de_DE-thorsten-medium"; \
    curl -fsSL -o /opt/piper/voices/de_DE-thorsten-medium.onnx "${V}.onnx"; \
    curl -fsSL -o /opt/piper/voices/de_DE-thorsten-medium.onnx.json "${V}.onnx.json"; \
    echo "7e64762d8e5118bb578f2eea6207e1a35a8e0c30595010b666f983fc87bb7819  /opt/piper/voices/de_DE-thorsten-medium.onnx" | sha256sum -c -; \
    echo "974adee790533adb273a1ac88f49027d2a1b8f0f2cf4905954a4791e79264e85  /opt/piper/voices/de_DE-thorsten-medium.onnx.json" | sha256sum -c -; \
    rm /tmp/piper.tgz
COPY static /app/static
COPY --from=install-whisper /whisper /app/data/libs/whisper
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY package.json /app/

# app configuration via environment variables
ENV DATA_DIR_PATH=/app/data
ENV DOCKER=true
ENV WHISPER_MODEL=tiny.en
ENV KOKORO_MODEL_PRECISION=q4
# number of chrome tabs to use for rendering
ENV CONCURRENCY=1
# video cache - 2000MB
ENV VIDEO_CACHE_SIZE_IN_BYTES=2097152000

# install kokoro, headless chrome and ensure music files are present
RUN node dist/scripts/install.js

CMD ["pnpm", "start"]
