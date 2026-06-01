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

# Spec

## 0. Core & Health Layer

### `GET /api/health`

**Description:** Verification ping to check system readiness and isolate active compute worker processing infrastructure nodes.

**Input:** _(None)_

**Output (JSON):**

```json
{
  "status": "OK",
  "node": "Gigabyte"
}
```

---

### `GET /api/media/[mediaId]/metadata`

**Description:** Retrieves a single media item's enhanced technical metadata and deep EXIF properties using its unique slug or identifier.

**Input (Path Parameter):**

- `mediaId` (string): The unique slug or resource identifier of the media asset.

**Output (JSON):**

```json
{
  "slug": "video-vacation-2026",
  "type": "video",
  "title": "video-vacation-2026",
  "metadata": {
    "kind": "video",
    "format": {
      "filename": "storage/uploads/video-vacation-2026.mp4",
      "formatName": "mov,mp4,m4a,3gp,3g2,mj2",
      "size": 4829104,
      "duration": 12.4,
      "bitRate": 3115550,
      "width": 1920,
      "height": 1080,
      "resolution": "1920x1080",
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
      "width": 1920,
      "height": 1080,
      "bitRate": 3110000,
      "duration": 12.4,
      "frameRate": 30
    }
  }
}
```

---

## 1. Storage & On-Demand Transcoding Layer

### `POST /webhook/media/uploads`

**Description:** Non-blocking storage-provider bucket event listener triggered automatically by Cloudflare R2 / AWS S3 when binary byte streams finish landing in the cloud. Instantly replies with `202 Accepted` and dispatches execution tasks into the background worker orchestration queue.

**Input (JSON - Storage Event Structure):**

```json
{
  "Records": [
    {
      "s3": {
        "bucket": { "name": "production-media-vault" },
        "object": {
          "key": "upload/org_1/prj_8f92a1b/vacation1-batch_abc123-up_7x89dz.jpg",
          "size": 500000
        }
      }
    }
  ]
}
```

**Output (JSON):**

```json
{
  "success": true,
  "message": "Dispatched optimization request"
}
```

---

### `POST /api/media/transform`

**Description:** Consolidated pipeline execution endpoint for processing, modifying, and transcoding both image and video assets. Updated to support hardware-accelerated Adaptive Bitrate (ABR) segmentation and Dynamic Adaptive Streaming over HTTP (DASH) manifest files.

**Input (JSON Body):**

```json
{
  "taskType": "transform:video",
  "payload": {
    "cacheKey": "dash_prj_8f9_Garment_Shoot",
    "mediaOriginId": "upload/org_1/prj_8f9/Garment_Shoot.mov",
    "modifiers": {
      "format": "dash",
      "preset": "abr_standard"
    }
  }
}
```

**Output (JSON):**

```json
{
  "traceId": "motia_trk_99182x",
  "status": "queued",
  "message": "DASH transcoding job dispatched to hardware encoders."
}
```

---

## 2. Live Streaming Pipeline (LiveKit Core Integration)

### `POST /api/stream/ingress`

**Description:** Called by `MSync` or the administration dashboard to provision a dedicated hardware ingestion resource, mapping an incoming standard broadcasting client (e.g., OBS Studio via RTMP) to a real-time WebRTC room cluster.

**Input (JSON Body):**

```json
{
  "projectId": "prj_8f92a1b",
  "roomName": "live-shoot-garment",
  "participantName": "Studio-Camera-A"
}
```

**Output (JSON):**

```json
{
  "ingressId": "ing_9981az",
  "rtmpUrl": "rtmp://ingress.livekit.modesthumanbrands.com/live",
  "streamKey": "...",
  "roomName": "live-shoot-garment"
}
```

---

### `POST /api/stream/token`

**Description:** Provisions a cryptographic JWT access token allowing real-time client web or desktop applications to establish a direct connection to the LiveKit SFU WebRTC room.

**Input (JSON Body):**

```json
{
  "roomName": "live-shoot-garment",
  "identity": "client_justin",
  "isPublisher": false
}
```

**Output (JSON):**

```json
{
  "token": ".....",
  "wsUrl": "wss://livekit.modesthumanbrands.com"
}
```

---

## 3. Live Delivery Optimization & Archiving (Egress)

### `POST /api/stream/egress/hls`

**Description:** Spawns a LiveKit Egress worker node to intercept the room's live WebRTC components, mixing and packaging them into a highly scalable HTTP Live Streaming (HLS) `.m3u8` manifest file. The resulting data chunks are saved directly onto your storage cluster to guarantee infinite CDN delivery scaling.

**Input (JSON Body):**

```json
{
  "roomName": "live-shoot-garment",
  "storageProvider": "s3",
  "bucket": "production-media-vault",
  "outputPrefix": "live/prj_8f92a1b/garment-shoot"
}
```

**Output (JSON):**

```json
{
  "egressId": "eg_77xxyyzz",
  "status": "starting",
  "hlsUrl": "https://cdn.modesthumanbrands.com/live/prj_8f92a1b/garment-shoot/stream.m3u8",
  "message": "HLS Egress started. Stream will be available at the URL in ~10 seconds."
}
```

---

### `POST /api/stream/egress/record`

**Description:** Initiates a low-overhead Track Egress job that intercepts and archives raw, uncompressed media layers directly from the WebRTC publisher stream. Saves audio and video into their exact native formats (e.g., Opus and H.264) without server-side transcoding, ensuring maximum fidelity for post-production.

**Input (JSON Body):**

```json
{
  "roomName": "live-shoot-garment",
  "participantIdentity": "Studio-Camera-A",
  "storageProvider": "s3",
  "bucket": "production-media-vault",
  "outputPrefix": "archives/prj_8f92a1b/garment-shoot/raw"
}
```

**Output (JSON):**

```json
{
  "egressId": "eg_raw_88bbcc",
  "status": "starting",
  "message": "Raw track recording started.",
  "expectedOutputs": {
    "video": "archives/prj_8f92a1b/garment-shoot/raw/video_Studio-Camera-A.mp4",
    "audio": "archives/prj_8f92a1b/garment-shoot/raw/audio_Studio-Camera-A.ogg"
  }
}
```

---

## 4. Real-Time Interactivity (Chat & Engagement)

### `POST /api/stream/chat/token`

**Description:** Issues a lightweight, specialized LiveKit WebRTC access token limited exclusively to the real-time Data Channel. This allows massive audiences watching the cached CDN HLS feed to securely interact via live text comment streams and emoji reactions without incurring the heavy server costs associated with media track subscriptions.

**Input (JSON Body):**

```json
{
  "roomName": "live-shoot-garment",
  "identity": "viewer_justin",
  "metadata": {
    "avatar": "url_to_avatar.jpg",
    "role": "viewer"
  }
}
```

**Output (JSON):**

```json
{
  "token": "....",
  "wsUrl": "wss://livekit.modesthumanbrands.com",
  "capabilities": ["subscribe_data", "publish_data"]
}
```

---

## 5. Audience Analytics & Telemetry Layer

> ### Analytical Methodology Architecture Overview
>
> - **WebRTC (Hosts/VIPs/Publishers):** Monitored natively via the infrastructure control plane. Real-time updates utilize standard webhooks (`participant_joined`, `participant_left`) coupled with session telemetry tracing to build instantaneous state maps.
> - **HLS (Scalable Audience Masses):** Managed via a decoupled client-to-backend pipeline. High-concurrency web clients use structured polling intervals against a CDN-backed telemetry receiver to calculate accurate geo-distributed active watcher counts.

### `POST /api/stream/analytics/heartbeat`

**Description:** A lightweight, high-frequency status check invoked by client video players every 30 to 60 seconds during live HLS consumption. Computes audience counts and isolates viewer coordinates via Edge Geo-IP infrastructure routing headers (e.g., Cloudflare's `CF-IPCountry`).

**Input (JSON Body):**

```json
{
  "roomName": "live-shoot-garment",
  "viewerId": "viewer_justin",
  "platform": "web_safari"
}
```

**Output (JSON):**

```json
{
  "success": true,
  "liveStats": {
    "currentViewers": 14203,
    "topLocations": ["US", "IN", "UK"]
  }
}
```

---

### `GET /api/stream/[roomName]/telemetry-baseline`

**Description:** Retrieves reference encoding presets and upstream container properties from the active live broadcast. Client applications combine these properties with local hardware execution matrices to generate comprehensive "Stats for Nerds" panels.

**Input (Path Parameter):**

- `roomName` (string): The active live room identifier.

**Output (JSON):**

```json
{
  "roomName": "live-shoot-garment",
  "sourceProfile": {
    "engine": "LiveKit SFU",
    "videoCodec": "h264",
    "audioCodec": "opus",
    "targetResolution": "1920x1080",
    "targetFps": 30,
    "maxBitrateBps": 4500000
  },
  "egressProfile": {
    "hlsManifestUrl": "https://cdn.modesthumanbrands.com/live/prj_8f92a1b/garment-shoot/stream.m3u8",
    "segmentLengthSeconds": 2,
    "abrVariants": ["1080p", "720p", "480p"]
  }
}
```

---

### Client-Side Render Target (Reference Structure)

The client application compiles the response from `/telemetry-baseline` with properties pulled from local browser browser telemetry engines (`RTCPeerConnection.getStats()` or HLS buffer trackers) to power the player stats overlay interface:

```json
{
  "connectionType": "HLS (CDN Distributed)",
  "resolvedUrl": "https://cdn.modesthumanbrands.com/live/prj_8f92a1b/garment-shoot/stream_1080p.m3u8",
  "codec": "avc1.64002a (H.264 High Profile)",
  "currentResolution": "1920x1080",
  "displayFps": 29.97,
  "droppedFrames": 4,
  "streamLatency": "12.4s",
  "bufferLength": "6.2s",
  "downloadSpeedMbps": 48.2
}
```

### Roadmap

| Order  | Route                                           | Module                                    | Complexity Profile                                                                                                                                                        | Status         |
| ------ | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **1**  | `GET /api/health`                               | 0. Core & Health Layer                    | **Trivial**: Simple hardcoded static JSON response checking node availability.                                                                                            | ✅ **Done**    |
| **2**  | `GET /api/media/[mediaId]/metadata`             | 0. Core & Health Layer                    | **Low**: Standard database lookup by unique slug or identifier to fetch deep EXIF metadata and asset dimensions.                                                          | ⏳ **Pending** |
| **3**  | `POST /webhook/media/uploads`                   | 1. Storage & On-Demand Transcoding Layer  | **Medium**: Ingestion of cloud bucket event payloads (S3/R2). Requires fast input validation, immediate `202 Accepted` response, and asynchronous job queuing.            | ⏳ **Pending** |
| **4**  | `POST /api/media/transform`                     | 1. Storage & On-Demand Transcoding Layer  | **High**: Orchestrates hardware-accelerated adaptive bitrate (ABR) segmentation pipelines and generates dynamic DASH manifest paths.                                      | ⏳ **Pending** |
| **5**  | `POST /api/stream/ingress`                      | 2. Live Streaming Pipeline                | **Medium-High**: Integrates directly with the LiveKit API to spin up dedicated ingestion resources, translating incoming RTMP streams to WebRTC clusters.                 | ⏳ **Pending** |
| **6**  | `POST /api/stream/token`                        | 2. Live Streaming Pipeline                | **Low**: Cryptographic JWT token generation utilizing the LiveKit Server SDK to grant secure, room-scoped WebRTC access.                                                  | ⏳ **Pending** |
| **7**  | `POST /api/stream/egress/hls`                   | 3. Live Delivery Optimization & Archiving | **High**: Dispatches LiveKit Egress workers to combine live WebRTC tracks, slice segments, and output scalable HLS `.m3u8` manifests directly to storage CDN origins.     | ⏳ **Pending** |
| **8**  | `POST /api/stream/egress/record`                | 3. Live Delivery Optimization & Archiving | **High**: Initiates low-level track interceptors to extract raw audio/video tracks (Opus/H.264) without server transcoding, saving files directly to cloud storage.       | ⏳ **Pending** |
| **9**  | `POST /api/stream/chat/token`                   | 4. Real-Time Interactivity                | **Low**: Issues restricted JWT access tokens bounded exclusively to the WebRTC Data Channel payload layer to minimize compute overhead for massive chat audiences.        | ⏳ **Pending** |
| **10** | `POST /api/stream/analytics/heartbeat`          | 5. Audience Analytics & Telemetry Layer   | **Medium-High**: High-frequency telemetry endpoint. Must handle high concurrency, parse Edge Geo-IP routing headers (`CF-IPCountry`), and update real-time viewer counts. | ⏳ **Pending** |
| **11** | `GET /api/stream/[roomName]/telemetry-baseline` | 5. Audience Analytics & Telemetry Layer   | **Low-Medium**: Reads infrastructure profiles and HLS variant lengths from the active broadcast context to construct diagnostic baselines for client-side overlays.       | ⏳ **Pending** |

Progress = 1/11 = 9%

## License

Published under the [MIT](https://github.com/Modest-Human-Brands/mmedia/blob/main/LICENSE) license.
<br><br>
<a href="https://github.com/Modest-Human-Brands/mmedia/graphs/contributors">
<img src="https://contrib.rocks/image?repo=Modest-Human-Brands/mmedia" />
</a>
