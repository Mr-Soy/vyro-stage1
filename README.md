# Grabpic — Intelligent Identity & Retrieval Engine

A high-performance image processing backend that uses facial recognition to automatically tag event photos and lets participants retrieve their images using a **"Selfie-as-a-Key"** system.

Imagine a marathon with 500 runners and 50,000 photos. Instead of manual tagging, Grabpic detects every face, assigns a unique `grab_id` to each person, and lets anyone find all their photos by uploading a single selfie.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express.js (Node.js 18+) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage |
| Face Recognition | @vladmandic/face-api + @tensorflow/tfjs (pure JS, no native bindings) |
| Image Decoding | Jimp (pure JS) |
| Deployment | Railway / Render (backend), Vercel (frontend) |
| Docs | Swagger UI (OpenAPI 3.0) |

---

## Features

- **Image Crawl & Ingest** — Scans a Supabase storage bucket, detects all faces, assigns unique `grab_id`s
- **Multi-Face Mapping** — One photo → many faces, one person → many photos (M:N junction table)
- **Selfie Authentication** — Upload a selfie → get matched to your `grab_id` via face encoding comparison
- **Image Retrieval** — Fetch all event photos you appear in, paginated
- **Swagger Docs** — Interactive API documentation at `/api-docs`
- **Rate Limiting** — 100 requests per 15 minutes per IP
- **Pure JS** — No native C++ bindings. Runs anywhere Node.js runs.

---

## Prerequisites

- **Node.js 18+** and npm
- A [Supabase](https://supabase.com) account (free tier works)
- Git

---

## Setup & Run Locally

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/grabpic.git
cd grabpic
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Download Face Recognition Models

```bash
npm run download-models
```

This downloads ~12MB of model weights (SSD MobileNet v1, FaceLandmark68, FaceRecognition) to the `models/` directory.

### 4. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `schema.sql`, then run it
3. Go to **Storage** → Create a bucket named `event-photos` (set **Public** access)
4. Upload sample event photos to the `event-photos` bucket
5. Go to **Settings** → **API** → Copy your project URL, anon key, and service role key

### 5. Configure Environment Variables

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

### 6. Start the Server

```bash
npm run dev
```

The server loads face recognition models at startup (~10-20s on first run), then:

- **API:** http://localhost:3001/api
- **Health:** http://localhost:3001/api/health
- **Swagger:** http://localhost:3001/api-docs

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/crawl` | Crawl storage bucket & process images |
| POST | `/api/auth/selfie` | Upload selfie to find your grab_id |
| GET | `/api/images/:grab_id` | Get all images for a grab_id |
| GET | `/api/stats` | System statistics |
| GET | `/api-docs` | Swagger UI |

---

## cURL Examples

### Health Check

```bash
curl http://localhost:3001/api/health
```

### Crawl & Ingest Images

```bash
curl -X POST http://localhost:3001/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"bucket": "event-photos", "limit": 50}'
```

**Response:**
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

**Response (match found):**
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

### Get My Photos

```bash
curl "http://localhost:3001/api/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890?page=1&limit=20"
```

### Get System Stats

```bash
curl http://localhost:3001/api/stats
```

---

## Database Schema

3 tables with a many-to-many relationship:

```
images (1) ──── (N) face_image_map (N) ──── (1) faces
```

- **images** — metadata for each ingested photo
- **faces** — one row per unique person, stores 128-dim face encoding as JSONB
- **face_image_map** — junction table linking faces to images, with bounding box data

See `schema.sql` for the full SQL.

---

## Project Structure

```
grabpic/
├── server/
│   ├── index.js                  # Express entry point (CORS, rate limit, model loading)
│   ├── config/
│   │   ├── supabase.js           # Supabase client (service role key)
│   │   └── swagger.js            # OpenAPI spec config
│   ├── routes/
│   │   ├── crawl.js              # POST /api/crawl
│   │   ├── auth.js               # POST /api/auth/selfie
│   │   ├── images.js             # GET /api/images/:grab_id
│   │   └── stats.js              # GET /api/stats
│   ├── services/
│   │   ├── faceService.js        # detectFaces(), compareFaces(), findMatchingGrabId()
│   │   ├── crawlService.js       # crawlBucket(), processImage(), listStorageFiles()
│   │   └── imageService.js       # getImagesByGrabId(), getImagePublicUrl()
│   ├── middleware/
│   │   ├── errorHandler.js       # Global error handler
│   │   └── upload.js             # Multer config (memory, 5MB, MIME filter)
│   └── utils/
│       └── faceModels.js         # Cold-start model loader (singleton pattern)
├── models/                       # face-api.js model weights (downloaded)
├── scripts/
│   └── download-models.js        # Model download script
├── schema.sql                    # Database schema (run in Supabase SQL Editor)
├── package.json
├── .env
├── .gitignore
└── README.md
```

---

## Deployment (Railway)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Grabpic backend"
git remote add origin https://github.com/YOUR_USERNAME/grabpic.git
git push -u origin main
```

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select your `grabpic` repo
3. Railway auto-detects Node.js. Set the following environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FACE_MATCH_THRESHOLD=0.6`
   - `MAX_FILE_SIZE=5242880`
   - `CORS_ORIGIN=https://your-frontend.vercel.app`
   - `NODE_ENV=production`
4. Railway will run `npm install` and `npm start` automatically
5. The face models must be in the repo (committed in `models/`) or download them at build time

### 3. Verify

```bash
curl https://your-app.up.railway.app/api/health
curl https://your-app.up.railway.app/api/stats
```

---

## How It Works

1. **Crawl**: Admin triggers `POST /api/crawl`. The server scans the Supabase storage bucket, downloads each unprocessed photo, and runs face detection.

2. **Face Encoding**: Each detected face is converted to a 128-dimensional vector (descriptor) using SSD MobileNet + FaceRecognitionNet.

3. **Identity Assignment**: The new encoding is compared against ALL known faces in memory using Euclidean distance. If distance < 0.6 → same person (existing `grab_id`). Otherwise → new person (new UUID).

4. **Selfie Auth**: User uploads a selfie. The system detects exactly one face, encodes it, and compares it against all known `grab_id`s. Returns the closest match with confidence.

5. **Retrieval**: User calls `GET /api/images/:grab_id` to fetch all event photos they appear in.

---

## License

MIT

