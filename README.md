<p align="center">
  <img src="./public/logo.png" alt="Logo" width="65" />
</p>

# MMedia

<p align="center">
  <a href="https://shirsendu-bairagi.betteruptime.com">
    <img src="https://uptime.betterstack.com/status-badges/v3/monitor/10aqw.svg" alt="Uptime Status">
  </a>
</p>

![Landing](public/previews/landing.webp)

> An open-source media backend platform for ingesting, transcoding, storing, and delivering video and image assets via a global CDN — with built-in live streaming support over SRT.

---

## Features

### Ingest

- SRT live stream ingest (per stream key, per device)
- HTTP multipart upload for video and image assets
- R2 / S3 direct upload with multipart support
- Webhook emission on ingest completion

### Transcode & Optimize

- Multi-rendition HLS output (360p, 480p, 720p, 1080p)
- Multi-codec support — H.264, H.265, AV1, VP9
- Per-codec master playlist generation
- Thumbnail extraction (by timestamp or percentage)
- Image resize and optimization (WebP, AVIF)
- Aspect ratio preservation with letterbox padding
- Original recording captured alongside HLS output

### Storage

- Cloudflare R2 as primary object store
- Live segment sync to R2 as segments close
- Automatic VOD packaging on stream end
- Asset deduplication via content hash / slug
- Structured paths: `/{slug}/{deviceId}/hls/`, `/original/`, `/thumbnails/`

### CDN & Delivery

- Signed URL generation with configurable TTL
- HTTP byte-range streaming support
- HLS manifest rewriting with CDN base URL injection
- Image dimension and metadata API
- Video metadata API (duration, resolution, codec info)
- Resolution negotiation per request

### API

- Asset CRUD — list, fetch, upload, delete
- Stream provisioning — start, stop, status
- Health endpoint for infrastructure monitoring
- Project-based folder auto-creation
- Anonymous share links with expiration

### Platform

- Analytics
- Adaptive Bitrate Streaming (ABR)
- Containerized via Docker
- CI/CD via GitHub Actions

---

## Roadmap

### v1 — Core Pipeline

- [x] SRT ingest with FFmpeg
- [x] Multi-rendition HLS transcoding
- [x] H.264 / AV1 / VP9 codec support
- [x] R2 storage sync
- [x] HLS master playlist generation
- [x] Thumbnail generation
- [x] Asset metadata API
- [x] Stream start / stop / status API
- [ ] VOD finalization on stream end
- [ ] Signed URL delivery
- [ ] Image optimization (WebP / AVIF)

### v2 — Platform

- [ ] OAuth 2.0 authentication
- [ ] Project-based organization
- [ ] Anonymous share links with TTL
- [ ] Analytics dashboard
- [ ] Push notifications
- [ ] PWA shell

### v3 — Scale & Ops

- [ ] Multi-node Docker Swarm deployment
- [ ] Horizontal FFmpeg worker scaling
- [ ] Segment purge and storage lifecycle policies
- [ ] End-to-end test suite
- [ ] Prometheus + Grafana observability

## License

Published under the [MIT](https://github.com/Modest-Human-Brands/mmedia/blob/main/LICENSE) license.
<br><br>
<a href="https://github.com/Modest-Human-Brands/mmedia/graphs/contributors">
<img src="https://contrib.rocks/image?repo=Modest-Human-Brands/mmedia" />
</a>
