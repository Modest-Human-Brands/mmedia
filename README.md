<h1 align="center">mmedia</h1>

<p align="center">
  <strong>Event-driven media processing microservice & live streaming engine built on Motia, Bun, FFmpeg, and LiveKit.</strong>
</p>

<p align="center">
  <a href="https://shirsendu-bairagi.betteruptime.com">
    <img src="https://uptime.betterstack.com/status-badges/v3/monitor/10aqw.svg" alt="Uptime Status" />
  </a>
  <a href="https://github.com/Modest-Human-Brands/mmedia/releases">
    <img src="https://img.shields.io/github/v/release/Modest-Human-Brands/mmedia?color=blue&label=version" alt="Latest Version" />
  </a>
  <a href="https://github.com/Modest-Human-Brands/mmedia/actions/workflows/integrate.yml">
    <img src="https://github.com/Modest-Human-Brands/mmedia/actions/workflows/integrate.yml/badge.svg" alt="Motia CI" />
  </a>
  <a href="https://github.com/Modest-Human-Brands/mmedia/pkgs/container/mmedia">
    <img src="https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker" alt="Docker Container" />
  </a>
  <a href="https://bun.sh">
    <img src="https://img.shields.io/badge/runtime-Bun%20%5E1.2.9-fbf0df?logo=bun" alt="Bun Runtime" />
  </a>
  <a href="https://github.com/Modest-Human-Brands/mmedia/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT" />
  </a>
</p>

---

## Overview

**mmedia** is a containerized, event-driven media processing and streaming microservice. It provides automated cloud storage ingestion (Cloudflare R2 / AWS S3), on-demand image optimization and video thumbnailing via IPX and Sharp, hardware-accelerated multi-codec DASH transcoding via FFmpeg, and scalable WebRTC-to-HLS live broadcasting powered by LiveKit SFU.

Built on the **Motia** step-orchestration framework and the **III** distributed engine, mmedia pairs persistent state storage and background worker queues with built-in OpenTelemetry instrumentation and health diagnostics.

### Features

- 🚀 **Hardware-Accelerated Transcoding**: Multi-codec DASH segmentation (AV1, HEVC, VP9, H.264) with runtime auto-detection for NVIDIA NVENC and Intel QSV hardware encoders, plus robust software fallbacks (`libsvtav1`, `libx265`, `libx264`).
- 📡 **WebRTC & LiveKit Live Ingestion**: Single-call orchestration for WHIP WebRTC ingress, real-time multi-bitrate HLS egress (1080p, 720p, 480p), automated master playlist (`master.m3u8`) assembly, and raw MP4 cloud archival.
- 🖼️ **On-the-Fly Image Optimization**: Fast image transformations (resizing, format conversion to WebP/AVIF, quality tuning) powered by IPX, with automatic frame extraction for video assets.
- ⚡ **Event-Driven Task Orchestration**: Reactive step execution with background queue processing (`media.process`, `media.transform`), concurrency controls, automatic retry policies, and state tracking.
- ☁️ **Cloud Native S3/R2 Streaming**: Direct stream-based uploads and downloads via `aws4fetch` and `unstorage`, integrated with Cloudflare Worker edge webhook forwarding.
- 🔍 **Deep Media Metadata & EXIF**: Automated technical format extraction (resolution, aspect ratio, codecs, bit depth, camera make/model, lens, GPS coordinates) via `exifr`, `image-meta`, and `ffprobe`.

---

## Architecture

```mermaid
flowchart TD
    Client(["Client / CDN / Broadcaster"])

    subgraph MMedia ["mmedia Microservice (Motia & III Engine :3111)"]
        direction TB
        Health["GET /health"]
        Metadata["GET /media/:mediaId/metadata"]
        TransformAPI["POST /media/transform"]
        Webhook["POST /webhook/media/uploads"]
        StreamAPI["LiveKit Routes (/stream, /stream/start, /stream/stop)"]

        subgraph Queues ["Background Task Queues"]
            QProcess["Queue: media.process"]
            QTransform["Queue: media.transform"]
            QStream["Queue: stream.processed"]
        end

        StateStore[("KvStore / State Store (media.result)")]
    end

    subgraph Transcoders ["Media Processing Engines"]
        IPX["IPX / Sharp (Images & Thumbnails)"]
        FFmpeg["FFmpeg (Hardware NVENC/QSV + DASH)"]
    end

    subgraph External ["Cloud Infrastructure"]
        LiveKitSFU["LiveKit SFU (WHIP / Egress Workers)"]
        R2Storage[("Cloudflare R2 / AWS S3 (Drive & CDN)")]
        DriveWebhook["Central Drive Status Webhook"]
    end

    Client -->|HTTP REST| Health
    Client -->|Metadata Query| Metadata
    Client -->|Transcode Request| TransformAPI
    Client -->|WHIP WebRTC Ingest| LiveKitSFU
    Client -->|HLS Stream Consumption| R2Storage

    Webhook -->|Queue Task| QProcess
    TransformAPI -->|Queue & Poll| QTransform
    TransformAPI <-->|State Polling (30s)| StateStore

    QProcess -->|Extract Metadata & Standardize| R2Storage
    QProcess -->|Progress Reports| DriveWebhook

    QTransform -->|Process Image| IPX
    QTransform -->|Process DASH Video| FFmpeg
    QTransform -->|Update Result| StateStore

    StreamAPI -->|Manage Rooms & Ingress/Egress| LiveKitSFU
    LiveKitSFU -->|Egress MP4 & HLS Chunks| R2Storage
```

---

## Quickstart

### Prerequisites

- [Bun](https://bun.sh) (`^1.2.9` or higher, repo pinned to `1.4.2`) or [Node.js](https://nodejs.org) (`^22.11.0 || ^24.14.0`)
- [FFmpeg](https://ffmpeg.org) and `ffprobe` installed and present in your system `PATH`
- [III Engine](https://install.iii.dev) CLI binary installed
- Cloudflare R2 or AWS S3 credentials (and LiveKit server credentials for streaming)

### Running with Docker

Pre-built Docker images are published to the GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/modest-human-brands/mmedia:latest

# Run container with environment configuration
docker run -d \
  --name mmedia \
  --env-file .env.prod \
  -p 3111:3111 \
  -p 3114:3114 \
  ghcr.io/modest-human-brands/mmedia:latest
```

### Local Development Setup

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/Modest-Human-Brands/mmedia.git
   cd mmedia
   bun install --frozen-lockfile
   ```

2. **Configure environment variables:**

   Copy `.env.prod` or create `.env`:

   ```bash
   cp .env.prod .env
   ```

3. **Start the development server:**

   ```bash
   bun run dev
   ```

   This launches the `iii` engine runtime with `iii-config.yaml` and starts Motia in watch mode on port `3111`.

---

## REST API Reference

The REST API runs on port `3111` by default (configurable via `iii-config.yaml`).

| Method | Endpoint                   | Handler Step       | Description                                                          |
| ------ | -------------------------- | ------------------ | -------------------------------------------------------------------- |
| `GET`  | `/health`                  | `HealthCheck`      | Health and node verification                                         |
| `GET`  | `/media/:mediaId/metadata` | `MediaGet`         | Retrieve technical EXIF/ffprobe metadata for an asset                |
| `POST` | `/media/transform`         | `MediaTransformer` | On-demand image/video transformation with synchronous wait           |
| `POST` | `/webhook/media/uploads`   | `WebhookHandler`   | Bucket upload notification receiver (R2/S3)                          |
| `GET`  | `/stream`                  | `StreamAllStatus`  | List all active LiveKit broadcast rooms and statuses                 |
| `GET`  | `/stream/:slug/:deviceId`  | `StreamStatus`     | Query status and playback URLs for a specific stream                 |
| `POST` | `/stream/start`            | `StreamStart`      | Provision WHIP ingress, multi-quality HLS egress, and raw MP4 egress |
| `POST` | `/stream/stop`             | `StreamStop`       | Terminate a live broadcast session and clean up LiveKit room         |

---

### Core & Health Layer

#### `GET /health`

Returns service health, version, build time, and host node name.

**Request:**

```bash
curl -X GET http://localhost:3111/health
```

**Response (`200 OK`):**

```json
{
  "status": "OK",
  "version": "0.1.8",
  "buildTime": "2026-10-16T12:00:00.000Z",
  "node": "worker-node-01"
}
```

---

### Media Metadata Layer

#### `GET /media/:mediaId/metadata`

Resolves a media file path using the drive synchronization registry and extracts technical metadata using `exifr` (images) or `ffprobe` (audio and video).

**Request:**

```bash
curl -X GET http://localhost:3111/media/sample-video/metadata
```

**Path Parameters:**

- `mediaId` (`string`, required): Asset slug or file identifier.

**Response (`200 OK`):**

```json
{
  "slug": "sample-video",
  "type": "video",
  "title": "sample-video",
  "metadata": {
    "kind": "video",
    "format": {
      "filename": "storage/uploads/sample-video.mp4",
      "formatName": "mov,mp4,m4a,3gp,3g2,mj2",
      "duration": 12.4,
      "size": 4829104,
      "bitRate": 3115550,
      "resolution": "1080p",
      "aspectRatio": "16:9",
      "bitDepth": "8 bit",
      "camera": "Apple iPhone 15 Pro",
      "location": {
        "lat": 37.7749,
        "lng": -122.4194
      }
    },
    "stream": {
      "codecName": "h264",
      "codecType": "video",
      "resolution": "1080p",
      "aspectRatio": "16:9",
      "bitRate": 3110000,
      "duration": 12.4,
      "frameRate": 30
    }
  }
}
```

**Error Responses:**

- `404 Not Found`: `{"error": "Media not found: <mediaId>"}`
- `500 Internal Server Error`: `{"error": "Internal Server Error while extracting metadata"}`

---

### Media Transformation Layer

#### `POST /media/transform`

Dispatches a synchronous-wait media transformation task. The handler stores a pending record in `stateManager`, enqueues a `media.transform` worker job, and polls for completion up to 30 seconds.

**Request:**

```bash
curl -X POST http://localhost:3111/media/transform \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "transform:image",
    "payload": {
      "cacheKey": "cache/images/product-thumb.webp",
      "mediaOriginId": "uploads/org_1/prj_2/product.jpg",
      "modifiers": {
        "format": "webp",
        "width": "800",
        "quality": "80"
      }
    }
  }'
```

**Request Body Schema:**

| Field                   | Type                                       | Required | Description                                                                                   |
| ----------------------- | ------------------------------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `taskType`              | `"transform:image"` \| `"transform:video"` | Yes      | Target transformation pipeline.                                                               |
| `payload.cacheKey`      | `string`                                   | Yes      | Storage cache path/key where processed artifact is written.                                   |
| `payload.mediaOriginId` | `string`                                   | Yes      | Source object key in cloud storage.                                                           |
| `payload.modifiers`     | `Record<string, string>`                   | Yes      | Key-value modifier map passed to IPX or FFmpeg (e.g. `format`, `width`, `height`, `quality`). |

**Response (`200 OK`):**

```json
{
  "streamPath": "./static/cache/images/product-thumb.webp",
  "contentType": "image/webp",
  "byteLength": 45120
}
```

**Error Responses:**

- `500 Internal Server Error`: `{"error": "Media transform failed"}`
- `504 Gateway Timeout`: `{"error": "Timed out waiting for media transform"}` (exceeded 30,000ms deadline)

---

### Storage Webhook Ingestion Layer

#### `POST /webhook/media/uploads`

Receives S3/R2 bucket object-creation event notifications. Parses object metadata, notifies the central drive status webhook that processing has started, and dispatches a background task to the `media.process` queue.

**Request:**

```bash
curl -X POST http://localhost:3111/webhook/media/uploads \
  -H "Content-Type: application/json" \
  -d '{
    "Records": [
      {
        "s3": {
          "bucket": { "name": "production-media-vault" },
          "object": {
            "key": "upload/org_1/prj_8f92a1b/photo-batch123-up456.jpg",
            "size": 5242880
          }
        }
      }
    ]
  }'
```

**Response (`202 Accepted`):**

```json
{
  "success": true,
  "message": "Dispatched optimization request"
}
```

**Edge Integration (Cloudflare Workers):**
`worker/r2-event.js` provides an out-of-the-box Cloudflare Queue consumer to forward R2 notifications to this endpoint:

```javascript
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      await fetch('https://mmedia.example.com/webhook/media/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.body),
      })
      message.ack()
    }
  },
}
```

---

### Live Streaming Pipeline (LiveKit Core)

mmedia integrates directly with LiveKit SFU (`livekit-server-sdk`) to handle WebRTC ingest, multi-quality adaptive HLS egress, and raw archival.

#### `POST /stream/start`

Initiates an end-to-end streaming session for a given stream slug and device:

1. Creates a LiveKit WHIP Ingress (`IngressInput.WHIP_INPUT`).
2. Starts composite raw MP4 recording egress directly to S3/R2 (`recordings/<slug>/raw_<timestamp>.mp4`).
3. Starts 3 parallel room composite HLS egresses (480p, 720p, 1080p) sliced into 4-second segments.
4. Generates a multi-bitrate HLS master playlist (`master.m3u8`) and uploads it to S3/R2 with `Cache-Control: no-cache`.

**Request:**

```bash
curl -X POST http://localhost:3111/stream/start \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "event-main",
    "deviceId": "cam-01"
  }'
```

**Response (`200 OK`):**

```json
{
  "slug": "event-main",
  "deviceId": "cam-01",
  "status": "starting",
  "streamUrl": "https://livekit.example.com/whip",
  "streamKey": "ing_live_key_sample123",
  "token": "",
  "media": "https://cdn.example.com/live/event-main/hls/master.m3u8"
}
```

**HLS Quality Profiles Configured:**

| Quality   | Resolution | Framerate | Video Bitrate | Audio Bitrate | Output Path                        |
| --------- | ---------- | --------- | ------------- | ------------- | ---------------------------------- |
| **480p**  | 854x480    | 30 fps    | 1,500 kbps    | 128 kbps      | `live/<slug>/hls/480p/index.m3u8`  |
| **720p**  | 1280x720   | 30 fps    | 3,000 kbps    | 128 kbps      | `live/<slug>/hls/720p/index.m3u8`  |
| **1080p** | 1920x1080  | 30 fps    | 4,500 kbps    | 128 kbps      | `live/<slug>/hls/1080p/index.m3u8` |

---

#### `GET /stream`

Lists all active broadcasting rooms from the LiveKit Room Service and computes current status.

**Request:**

```bash
curl -X GET http://localhost:3111/stream
```

**Response (`200 OK`):**

```json
[
  {
    "slug": "event-main",
    "deviceId": "cam-01",
    "status": "live",
    "streamUrl": "event-main_cam-01",
    "media": "https://livekit.example.com/rooms/event-main_cam-01"
  }
]
```

---

#### `GET /stream/:slug/:deviceId`

Fetches status and CDN playback URLs for a specific room (`<slug>_<deviceId>`).

**Request:**

```bash
curl -X GET http://localhost:3111/stream/event-main/cam-01
```

**Response (`200 OK`):**

```json
{
  "slug": "event-main_cam-01",
  "status": "live",
  "streamUrl": "",
  "media": "https://cdn.example.com/live/event-main/hls/master.m3u8"
}
```

_Possible `status` values:_ `idle`, `starting`, `live`, `paused`, `stopping`, `stopped`, `error`, `processing`, `ready`.

---

#### `POST /stream/stop`

Forcibly closes the LiveKit room, disconnects all participants and egress pipelines, and emits a `stream.stopped` queue event.

**Request:**

```bash
curl -X POST http://localhost:3111/stream/stop \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "event-main",
    "deviceId": "cam-01"
  }'
```

**Response (`200 OK`):**

```json
{
  "stopped": true,
  "slug": "event-main",
  "deviceId": "cam-01"
}
```

**Error Responses:**

- `400 Bad Request`: `{"error": "slug and deviceId required"}`
- `404 Not Found`: `{"error": "No active room found for event-main_cam-01"}`

---

## Background Queues & Workflows

Motia orchestrates asynchronous jobs across dedicated worker queues configured in `src/job/`:

| Topic / Flow                    | Concurrency | Retries | Step               | Description                                                                                                                                                                         |
| ------------------------------- | ----------- | ------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `media.process`                 | `1`         | `3`     | `MediaProcessor`   | Downloads uploaded file from R2, extracts metadata, standardizes asset filename, uploads to `processed/` path, cleans up temporary source, and sends progress webhooks (60%, 100%). |
| `media.transform`               | `2`         | `3`     | `MediaTransformer` | Executes IPX image resizing/conversion or FFmpeg DASH transcoding, saves output to disk cache, and updates `stateManager` (`media.result`).                                         |
| `media.file.metadata.extracted` | `1`         | `0`     | `MediaNotionSync`  | Creates a Notion asset database entry with extracted metadata and dimensions.                                                                                                       |
| `stream.processed`              | `1`         | `0`     | `StreamUpload`     | Uploads finalized stream artifacts to target cloud buckets.                                                                                                                         |
| `stream.stopped`                | `1`         | `0`     | Event Consumer     | Emitted upon room termination for downstream cleanup.                                                                                                                               |

---

## Configuration Reference

The service is configured via environment variables (loaded through `.env` in development or Docker environment injection in production):

| Variable                           | Type     | Default         | Description                                                                |
| ---------------------------------- | -------- | --------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`                         | `string` | `"development"` | Application environment (`development` \| `production`).                   |
| `HOSTNAME`                         | `string` | System hostname | Host node identifier reported by `/health`.                                |
| `MOTIA_APP_VERSION`                | `string` | None            | App version injected into `/health` response.                              |
| `MOTIA_APP_BUILD_TIME`             | `string` | None            | Build timestamp injected into `/health` response.                          |
| `MOTIA_DRIVE_R2_ENDPOINT`          | `string` | Required        | Cloudflare R2 / S3 API endpoint for the drive storage bucket.              |
| `MOTIA_DRIVE_R2_BUCKET`            | `string` | Required        | Bucket name containing incoming uploads and drive assets.                  |
| `MOTIA_DRIVE_R2_ACCESS_KEY_ID`     | `string` | Required        | S3 access key ID for drive bucket operations.                              |
| `MOTIA_DRIVE_R2_SECRET_ACCESS_KEY` | `string` | Required        | S3 secret access key for drive bucket operations.                          |
| `MOTIA_DRIVE_R2_REGION`            | `string` | `"auto"`        | S3 region for drive bucket operations.                                     |
| `MOTIA_DRIVE_URL`                  | `string` | Required        | Base URL of central drive service (notified at `/webhook/uploads/status`). |
| `MOTIA_CDN_HOST`                   | `string` | Required        | Public CDN domain (e.g. `https://cdn.example.com`) for master HLS URLs.    |
| `MOTIA_CDN_R2_ENDPOINT`            | `string` | Required        | S3/R2 API endpoint for public CDN cache bucket.                            |
| `MOTIA_CDN_R2_BUCKET`              | `string` | Required        | Bucket name for CDN cache and live stream outputs.                         |
| `MOTIA_CDN_R2_ACCESS_KEY_ID`       | `string` | Required        | S3 access key ID for CDN bucket operations.                                |
| `MOTIA_CDN_R2_SECRET_ACCESS_KEY`   | `string` | Required        | S3 secret access key for CDN bucket operations.                            |
| `MOTIA_CDN_R2_REGION`              | `string` | `"auto"`        | S3 region for CDN bucket operations.                                       |
| `MOTIA_LIVEKIT_URL`                | `string` | Required        | LiveKit SFU server host URL (e.g. `livekit.example.com`).                  |
| `MOTIA_LIVEKIT_API_KEY`            | `string` | Required        | LiveKit server API key.                                                    |
| `MOTIA_LIVEKIT_API_SECRET`         | `string` | Required        | LiveKit server API secret.                                                 |
| `STREAMS_PORT`                     | `number` | `3114`          | Local port for `StreamModule` internal streams adapter.                    |

---

## Development

<details>
<summary><strong>View Developer Commands & Scripts</strong></summary>

All scripts are executed using `bun`:

```bash
# Start local development server with watch mode and III flow console
bun run dev

# Build production bundle with Motia
bun run build

# Start production server
bun run start

# Run ESLint with auto-fix across codebase
bun run lint

# Format codebase using Prettier
bun run format

# Run Gitleaks secret detection
bun run detect

# Clean compiled build artifacts and temporary Motia cache
bun run clean

# Build Docker image locally
bun run docker:build

# Run local Docker container using .env.prod
bun run docker:start
```

### Git Commit Conventions

This project enforces [Conventional Commits](https://www.conventionalcommits.org) using `@commitlint/cli` and `husky`:

- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code improvements without behavioral changes
- `chore:` Dependency and config updates
- `ci(release):` Version bumps and releases

</details>

---

## License

Published under the [MIT](https://github.com/Modest-Human-Brands/mmedia/blob/main/LICENSE) license.

<br>

<p align="center">
  <a href="https://github.com/Modest-Human-Brands/mmedia/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=Modest-Human-Brands/mmedia" alt="Contributors" />
  </a>
</p>
