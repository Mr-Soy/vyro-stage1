# Grabpic — Intelligent Identity & Retrieval Engine

> **Vyrothon 2026 Hackathon Project**

A full-stack facial recognition platform that automatically detects and indexes faces from event photos, then lets any attendee retrieve every photo they appear in by uploading a single selfie — **"Selfie-as-a-Key"**.

Imagine a marathon with 500 runners and 50,000 photos. Instead of scrolling through thousands of images, Grabpic detects every face, assigns a unique `grab_id` to each person, and lets anyone find all their photos instantly.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + Vite | React 18, Vite 5 |
| **Backend** | Express.js (Node.js) | Express 4.18, Node 18+ |
| **Database** | Supabase PostgreSQL | — |
| **Storage** | Supabase Storage | — |
| **Face Detection** | @vladmandic/face-api | 1.7.14 |
| **ML Runtime** | @tensorflow/tfjs + WASM backend | tfjs 4.17, wasm 4.22 |
| **Image Decoding** | Jimp (pure JS) | 0.22.12 |
| **API Docs** | Swagger UI (OpenAPI 3.0) | — |
| **Deployment** | Railway / Render (backend), Vercel (frontend) | — |

**Key constraint:** 100% pure JavaScript — zero native C++ bindings. No `tfjs-node`, no `canvas`. Runs on any platform where Node.js runs.

### ML Models

| Model | Purpose | Architecture | Output |
|-------|---------|-------------|--------|
| **SSD MobileNet v1** | Face detection | Single Shot Multibox Detector on MobileNet v1 backbone | Bounding boxes + confidence scores |
| **FaceLandmark68Net** | Facial landmark detection | 68-point face landmark predictor | 68 (x, y) landmark coordinates |
| **FaceRecognitionNet** | Face encoding | ResNet-34-like architecture | 128-dimensional descriptor vector |

All models are served via the `@vladmandic/face-api` library, running on the **TensorFlow.js WASM backend** (no GPU or native bindings required). Model weights are downloaded from the jsDelivr CDN via `npm run download-models`.

---

## Features

- **Event Photo Upload** — Upload group/event photos directly from the browser; each is stored in Supabase Storage and immediately processed for face detection
- **Bucket Crawl** — Alternatively, scan an entire Supabase Storage bucket to batch-process all unprocessed images
- **Multi-Face Detection** — Detects multiple faces per photo using SSD MobileNet v1
- **128-Dim Face Encoding** — Each face is encoded into a 128-dimensional descriptor vector for comparison
- **Identity Assignment** — Faces are matched against all known identities using Euclidean distance (threshold: 0.6). New faces get a fresh UUID (`grab_id`), known faces are linked
- **Many-to-Many Mapping** — One photo → many faces, one person → many photos (junction table with bounding box data)
- **Selfie Authentication** — Upload a selfie → matched to your `grab_id` → retrieve all your event photos
- **Paginated Retrieval** — Fetch your photos with pagination support
- **Interactive API Docs** — Swagger UI at `/api-docs`
- **Rate Limiting** — 100 requests per 15 minutes per IP
- **WASM Backend** — TensorFlow.js WASM backend for fast inference without native dependencies

---

## Prerequisites

- **Node.js 18+** and npm
- A [Supabase](https://supabase.com) account (free tier works)
- Git

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Mr-Soy/vyro-stage1.git
cd vyro-stage1
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Install Frontend Dependencies

```bash
cd client
npm install
cd ..
```

### 4. Download Face Recognition Models

```bash
npm run download-models
```

Downloads ~12 MB of model weights to `models/`:
- `ssd_mobilenetv1_model.bin` — face detection (5.6 MB)
- `face_landmark_68_model.bin` — facial landmark detection (357 KB)
- `face_recognition_model.bin` — 128-dim face encoding (6.4 MB)
- 3 corresponding weight manifest JSONs

### 5. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste the contents of `schema.sql` → click **Run**
3. Go to **Storage** → click **New bucket** → name it `event-photos` → set to **Public**
4. Go to **Settings** → **API** → copy your **Project URL**, **anon key**, and **service role key**

### 6. Configure Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FACE_MATCH_THRESHOLD=0.6
MAX_FILE_SIZE=5242880
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### 7. Start Both Servers

**Backend** (from project root):
```bash
npm start
```

The server loads face models at startup (~5-15s), then:
- **API:** http://localhost:3001
- **Health:** http://localhost:3001/api/health
- **Swagger:** http://localhost:3001/api-docs

**Frontend** (from `client/`):
```bash
cd client
npm run dev
```

- **App:** http://localhost:5173

---

## User Flow

```
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│    1. UPLOAD PHOTOS  │      │   2. UPLOAD SELFIE   │      │   3. VIEW RESULTS   │
│                      │      │                      │      │                      │
│  Drag & drop event   │ ──►  │  Upload a clear       │ ──►  │  See every event     │
│  photos (up to 20)   │      │  selfie of yourself   │      │  photo you appear in │
│                      │      │                      │      │                      │
│  Each photo is:      │      │  System detects your  │      │  Paginated gallery   │
│  • Stored in Supabase│      │  face, compares it    │      │  with download links │
│  • Face-detected     │      │  against all known    │      │                      │
│  • Indexed by grab_id│      │  identities           │      │                      │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/upload/event-photos` | Upload & process event photos (multipart, up to 20 files) |
| `POST` | `/api/crawl` | Crawl Supabase Storage bucket & process unprocessed images |
| `POST` | `/api/auth/selfie` | Upload selfie → get matched `grab_id` |
| `GET` | `/api/images/:grab_id` | Retrieve all photos for a `grab_id` (paginated) |
| `GET` | `/api/stats` | System statistics (total images, faces, mappings) |
| `GET` | `/api-docs` | Swagger UI interactive documentation |

---

## cURL Examples

### Health Check

```bash
curl http://localhost:3001/api/health
```

```json
{ "success": true, "message": "Grabpic API is running" }
```

### Upload Event Photos

```bash
curl -X POST http://localhost:3001/api/upload/event-photos \
  -F "photos=@./group-photo-1.jpg" \
  -F "photos=@./group-photo-2.jpg"
```

```json
{
  "success": true,
  "data": {
    "total_uploaded": 2,
    "total_failed": 0,
    "new_faces": 5,
    "matched_faces": 2,
    "details": [
      { "file": "group-photo-1.jpg", "success": true, "newFaces": 3, "matchedFaces": 0 },
      { "file": "group-photo-2.jpg", "success": true, "newFaces": 2, "matchedFaces": 2 }
    ]
  }
}
```

### Crawl Storage Bucket

```bash
curl -X POST http://localhost:3001/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"bucket": "event-photos", "limit": 50}'
```

```json
{
  "success": true,
  "data": {
    "total_images_found": 25,
    "already_processed": 0,
    "newly_processed": 25,
    "new_faces_discovered": 12,
    "existing_faces_matched": 35,
    "total_unique_faces": 12,
    "processing_time_ms": 45000
  }
}
```

### Authenticate with Selfie

```bash
curl -X POST http://localhost:3001/api/auth/selfie \
  -F "selfie=@./my-selfie.jpg"
```

```json
{
  "success": true,
  "data": {
    "grab_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "confidence": 0.87,
    "match_distance": 0.13,
    "total_images": 8
  }
}
```

### Retrieve My Photos

```bash
curl "http://localhost:3001/api/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890?page=1&limit=20"
```

### System Stats

```bash
curl http://localhost:3001/api/stats
```

```json
{
  "success": true,
  "data": {
    "total_images": 25,
    "processed_images": 25,
    "total_unique_faces": 12,
    "total_face_mappings": 47
  }
}
```

---

## Database Schema

3 tables with a many-to-many relationship:

```
images (1) ──── (N) face_image_map (N) ──── (1) faces
```

| Table | Purpose |
|-------|---------|
| `images` | Metadata for every ingested photo (path, bucket, processed flag, face count) |
| `faces` | One row per unique person — stores the 128-dim face encoding as JSONB and a `grab_id` UUID |
| `face_image_map` | Junction table linking faces to images, with bounding box coordinates and detection confidence |

Indexes on `image_id`, `grab_id`, `processed`, and `storage_path` for query performance.

Full SQL in [`schema.sql`](schema.sql).

---

## Project Structure

```
vyro-stage1/
├── client/                           # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                   # Router (state-based page switching)
│   │   ├── main.jsx                  # React entry point
│   │   ├── index.css                 # Global styles (dark theme)
│   │   └── pages/
│   │       ├── Home.jsx              # Landing page with feature cards
│   │       ├── EventUpload.jsx       # Upload event photos (drag & drop, multi-file)
│   │       ├── Upload.jsx            # Upload selfie for face matching
│   │       └── Results.jsx           # Photo gallery with pagination
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json                   # Vercel deployment config
│   └── package.json
│
├── server/                           # Express.js backend
│   ├── index.js                      # Entry point (CORS, rate limit, model loading, routes)
│   ├── config/
│   │   ├── supabase.js               # Supabase client singleton (service role key)
│   │   └── swagger.js                # OpenAPI 3.0 spec configuration
│   ├── routes/
│   │   ├── upload.js                 # POST /api/upload/event-photos
│   │   ├── crawl.js                  # POST /api/crawl
│   │   ├── auth.js                   # POST /api/auth/selfie
│   │   ├── images.js                 # GET /api/images/:grab_id
│   │   └── stats.js                  # GET /api/stats
│   ├── services/
│   │   ├── faceService.js            # detectFaces(), compareFaces(), findMatchingGrabId()
│   │   ├── crawlService.js           # crawlBucket(), processImage(), listStorageFiles()
│   │   └── imageService.js           # getImagesByGrabId(), getImagePublicUrl()
│   ├── middleware/
│   │   ├── errorHandler.js           # Global error handler
│   │   └── upload.js                 # Multer config (memory storage, 5MB, MIME filter)
│   └── utils/
│       └── faceModels.js             # Singleton model loader (WASM backend)
│
├── models/                           # Face-api.js model weights (git-ignored .bin files)
├── scripts/
│   └── download-models.js            # Downloads model weights from jsDelivr CDN
├── schema.sql                        # Supabase database schema
├── SRS.md                            # Software Requirements Specification
├── package.json                      # Backend dependencies & scripts
├── .env                              # Environment variables (git-ignored)
├── .gitignore
└── README.md
```

---

## How It Works

### 1. Upload & Detect

Event photos are uploaded via the frontend or `POST /api/upload/event-photos`. Each image is:
- Stored in the Supabase `event-photos` storage bucket
- Decoded to raw pixels using Jimp (pure JS, no native canvas)
- Fed through SSD MobileNet v1 for face detection
- Each detected face is encoded into a **128-dimensional descriptor** using FaceRecognitionNet

### 2. Identity Assignment

Each new face encoding is compared against **all existing faces** in the database using **Euclidean distance**:
- **Distance < 0.6** → same person → reuse their existing `grab_id`
- **Distance ≥ 0.6** → new person → generate a new UUID as their `grab_id`
- A junction record is created linking the face to the image (with bounding box data)

### 3. Selfie Matching

When a user uploads a selfie via `POST /api/auth/selfie`:
- Exactly **one face** must be detected (rejects 0 or 2+ faces)
- The face is encoded and compared against all known `grab_id`s
- Returns the closest match with a confidence score (1 - distance)

### 4. Retrieval

The user's `grab_id` is used to query the junction table and return all event photos they appear in, with signed public URLs from Supabase Storage.

---

## Build & Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install backend dependencies |
| `npm start` | Start backend server (production) |
| `npm run dev` | Start backend with nodemon (auto-restart on file changes) |
| `npm run download-models` | Download face recognition model weights (~12 MB) |
| `cd client && npm install` | Install frontend dependencies |
| `cd client && npm run dev` | Start Vite dev server (http://localhost:5173) |
| `cd client && npm run build` | Build frontend for production (outputs to `client/dist/`) |

---

## Environment Variables

### Backend (`.env` in project root)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | — | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service role key (full access) |
| `PORT` | No | `3001` | Backend server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `FACE_MATCH_THRESHOLD` | No | `0.6` | Euclidean distance threshold for face matching |
| `MAX_FILE_SIZE` | No | `5242880` | Max upload file size in bytes (5 MB) |

### Frontend (`client/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend API base URL |

---

## Deployment

### Backend → Railway / Render

1. Push to GitHub (already done)
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select `vyro-stage1` repo
4. Set environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)
5. Set build command: `npm install && npm run download-models`
6. Set start command: `npm start`
7. Railway auto-detects Node.js and deploys

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Import Git Repository**
2. Set **Root Directory** to `client`
3. Set **Build Command** to `npm run build`
4. Set **Output Directory** to `dist`
5. Add environment variable: `VITE_API_URL=https://your-backend.up.railway.app`
6. Deploy

### Verify

```bash
curl https://your-backend.up.railway.app/api/health
curl https://your-backend.up.railway.app/api/stats
```

---

## Dependencies

### Backend

| Package | Purpose |
|---------|---------|
| `express` | HTTP server & routing |
| `cors` | Cross-origin resource sharing |
| `express-rate-limit` | Request rate limiting |
| `multer` | Multipart file upload handling |
| `dotenv` | Environment variable loading |
| `@supabase/supabase-js` | Supabase client (DB + Storage) |
| `@tensorflow/tfjs` | TensorFlow.js core (ML runtime) |
| `@tensorflow/tfjs-backend-wasm` | WASM backend (no native bindings) |
| `@vladmandic/face-api` | Face detection & recognition models |
| `jimp` | Image decoding (pure JS, no canvas) |
| `uuid` | UUID generation for `grab_id`s |
| `swagger-jsdoc` | OpenAPI spec generation from JSDoc |
| `swagger-ui-express` | Swagger UI middleware |
| `nodemon` | Dev-only auto-restart |

### Frontend

| Package | Purpose |
|---------|---------|
| `react` | UI library |
| `react-dom` | React DOM renderer |
| `vite` | Build tool & dev server |
| `@vitejs/plugin-react` | Vite React plugin (JSX, Fast Refresh) |

---

## License

MIT

