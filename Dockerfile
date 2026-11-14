# Builder and runner share the same libc (glibc) so native modules such as sharp
# resolve to the same binaries in both stages.
FROM oven/bun:1-debian AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM debian:bookworm-slim AS iii-installer

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates jq && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://install.iii.dev/iii/main/install.sh | VERSION=0.10.0 bash

FROM oven/bun:1-debian AS runner

ARG VERSION
ARG BUILD_TIME

# ffmpeg/ffprobe are required for metadata extraction and video transcoding.
# NVENC is loaded at runtime from the host driver (NVIDIA Container Toolkit);
# QSV uses the Intel media driver with /dev/dri passed in. With neither, ffmpeg
# falls back to software encoders (libx264, libx265, libsvtav1, libvpx-vp9).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg intel-media-va-driver libva-drm2 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=iii-installer /root/.local/bin/iii /usr/local/bin/iii

COPY --from=builder /app/package.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY iii-config-production.yaml .

ENV NODE_ENV=production
ENV MOTIA_MMEDIA_APP_VERSION=$VERSION
ENV MOTIA_MMEDIA_APP_BUILD_TIME=$BUILD_TIME
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,video,utility

EXPOSE 3111
EXPOSE 3112
EXPOSE 49134

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3111/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["iii", "--config", "iii-config-production.yaml"]
