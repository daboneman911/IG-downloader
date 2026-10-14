FROM node:22-bookworm-slim

# ffmpeg: merging + H.264/AAC re-encode + MP3. Debian's build includes libx264, aac and libmp3lame.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Deno: yt-dlp needs a JS runtime to solve YouTube's player challenges.
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Standalone yt-dlp release binary (not pip) so `yt-dlp -U` can self-update in place at runtime.
# Every image build also pulls the latest release.
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in arm64) asset=yt-dlp_linux_aarch64 ;; *) asset=yt-dlp_linux ;; esac; \
    mkdir -p /opt/yt-dlp; \
    curl -fsSL -o /opt/yt-dlp/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}"; \
    chmod 755 /opt/yt-dlp/yt-dlp; \
    chown -R node:node /opt/yt-dlp; \
    /opt/yt-dlp/yt-dlp --version

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit && npm cache clean --force
COPY src ./src

ENV NODE_ENV=production \
    PORT=8787 \
    YTDLP_PATH=/opt/yt-dlp/yt-dlp \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    TMP_DIR=/tmp/igdl \
    YTDLP_UPDATE_HOURS=24

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
