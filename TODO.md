# TODO

- [x] Motia event-driven media processing microservice setup
- [x] Service health diagnostics endpoint (`GET /health`)
- [x] Media technical metadata extraction via exifr and ffprobe (`GET /media/:mediaId/metadata`)
- [x] Synchronous on-demand image/video transformation (`POST /media/transform`)
- [x] Cloudflare R2 / S3 storage upload webhook ingestion (`POST /webhook/media/uploads`)
- [x] Background media processing and image transcoding worker pipeline
- [x] Background video transcoding with dimension and aspect ratio calculation
- [x] LiveKit live broadcast room start with WHIP and HLS egress (`POST /stream/start`)
- [x] Active broadcast room listing and status query (`GET /stream`)
- [x] Single stream status query by slug and deviceId (`GET /stream/:slug/:deviceId`)
- [x] Live broadcast termination and egress cleanup (`POST /stream/stop`)
- [ ] Native RTMP and SRT direct ingest server support (currently WHIP WebRTC only)
- [ ] Multi-bitrate adaptive HLS ladder configuration for custom resolution tiers
