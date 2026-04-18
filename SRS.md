# Software Requirements Specification (SRS)

## Grabpic — Intelligent Identity & Retrieval Engine

**Version:** 1.0  
**Date:** April 18, 2026  
**Team:** Vyrothon 2026  
**Time Budget:** 1 hour 45 minutes  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Tech Stack & Justification](#3-tech-stack--justification)
4. [Architecture Design](#4-architecture-design)
5. [Database Schema](#5-database-schema)
6. [API Specification](#6-api-specification)
7. [Core Modules](#7-core-modules)
8. [Face Recognition Pipeline](#8-face-recognition-pipeline)
9. [Authentication & Security](#9-authentication--security)
10. [Error Handling Strategy](#10-error-handling-strategy)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Sprint Plan (90 Minutes)](#12-sprint-plan-90-minutes)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Risk Analysis](#14-risk-analysis)
15. [Appendix](#15-appendix)

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete software requirements for **Grabpic**, a high-performance image processing backend designed for large-scale events. The system automates photo tagging using facial recognition and provides a "Selfie-as-a-Key" retrieval mechanism.

### 1.2 Problem Statement

At large events (marathons, concerts, conferences), thousands of photos are taken by multiple photographers. Participants want to find **their** photos but:

- Manual tagging is impossible at scale (50,000+ photos, 500+ people)
- People don't remember exact timestamps or locations
- Traditional search by name/bib number requires manual metadata entry

### 1.3 Solution

Grabpic solves this by:

1. **Crawling** a storage bucket to ingest all raw event photos
2. **Detecting every face** in every image using facial recognition
3. **Assigning a unique `grab_id`** to every distinct person across all photos
4. **Mapping images ↔ grab_ids** (many-to-many: one photo has many faces, one person appears in many photos)
5. **Selfie Authentication**: a user uploads a selfie, the system matches it to a `grab_id`, and returns all their photos

### 1.4 Scope

| In Scope | Out of Scope |
|----------|-------------|
| Image ingestion from Supabase Storage | Real-time camera feed processing |
| Face detection & encoding | Face liveness detection |
| Unique face clustering (grab_id assignment) | Payment/billing for photo downloads |
| Selfie-based authentication | Mobile app |
| Image retrieval by grab_id | Image editing/watermarking |
| REST API with Swagger docs | User registration/password auth |
| Supabase (DB + Storage) | Multi-tenant event management |
| Vercel deployment | On-premise deployment |

### 1.5 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| **grab_id** | A unique UUID assigned to each distinct person/face discovered in the photo corpus |
| **face_encoding** | A 128-dimensional numerical vector representing a face's unique biometric features |
| **search_token** | The selfie image uploaded by a user to authenticate and retrieve their photos |
| **crawl** | The process of scanning a storage bucket to discover and process new images |
| **face_distance** | Euclidean distance between two face encodings; lower = more similar. Threshold: 0.6 |

---

## 2. System Overview

### 2.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GRABPIC SYSTEM                          │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐     │
│  │ Supabase │───>│  Crawl &     │───>│  Supabase DB      │     │
│  │ Storage  │    │  Ingest API  │    │  (faces, images,  │     │
│  │ (Photos) │    │              │    │   mappings)       │     │
│  └──────────┘    └──────────────┘    └─────────┬─────────┘     │
│                                                 │               │
│  ┌──────────┐    ┌──────────────┐              │               │
│  │ User     │───>│  Selfie Auth │──────────────┘               │
│  │ Selfie   │    │  API         │                               │
│  └──────────┘    └──────┬───────┘                               │
│                         │                                       │
│                         v                                       │
│                  ┌──────────────┐                               │
│                  │  Image       │                               │
│                  │  Retrieval   │                               │
│                  │  API         │                               │
│                  └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Actor Diagram

| Actor | Description | Interactions |
|-------|------------|-------------|
| **Admin/Photographer** | Uploads photos to Supabase Storage, triggers crawl | POST /api/crawl |
| **Participant (User)** | Uploads selfie to find their photos | POST /api/auth/selfie, GET /api/images/:grab_id |
| **System (Crawler)** | Automated process that scans storage and processes images | Internal face detection pipeline |

---

## 3. Tech Stack & Justification

### 3.1 Backend: Express.js (Node.js)

| Choice | Reason |
|--------|--------|
| Express.js | Fast to scaffold, huge ecosystem, Vercel-native support |
| Node.js 18+ | Stable, async I/O for image processing, Vercel runtime |

### 3.2 Frontend: React (Vite)

| Choice | Reason |
|--------|--------|
| React + Vite | Fast dev setup, Vercel deploys React trivially |
| Minimal UI | Upload selfie → see results. 2-3 pages max |

### 3.3 Database & Storage: Supabase

| Component | Usage |
|-----------|-------|
| Supabase PostgreSQL | Store faces table, images table, face_image_map (junction), face_encodings as JSONB/vector |
| Supabase Storage | Store raw event photos in a bucket; crawl from here |
| Supabase JS Client | Server-side SDK for storage access and DB queries |

### 3.4 Face Recognition: face-api.js

| Choice | Reason |
|--------|--------|
| face-api.js | Pure JS, runs in Node.js with @tensorflow/tfjs-node, no Python dependency |
| TensorFlow.js | Backend for face-api.js model inference |
| Models | SSD MobileNet v1 (detection) + FaceLandmark68Net + FaceRecognitionNet (128-dim encodings) |

**Why face-api.js over Python dlib/face_recognition?**
- Single language stack (JS everywhere)
- Deploys to Vercel without Python runtime
- Pre-trained models, no training needed
- Sufficient accuracy for hackathon scope

### 3.5 Deployment: Vercel

| Component | Deployment |
|-----------|-----------|
| Express.js API | Vercel Serverless Functions (via `vercel.json` rewrites) |
| React Frontend | Vercel static hosting (auto-detected) |
| Supabase | Managed cloud (no deployment needed) |

### 3.6 Documentation: Swagger (OpenAPI 3.0)

- `swagger-jsdoc` + `swagger-ui-express` for auto-generated interactive docs
- Available at `/api-docs`

---

## 4. Architecture Design

### 4.1 Project Structure

```
grabpic/
├── api/                          # Vercel serverless functions
│   └── index.js                  # Express app entry point
├── src/                          # React frontend
│   ├── App.jsx
│   ├── pages/
│   │   ├── Home.jsx              # Landing page
│   │   ├── Upload.jsx            # Selfie upload page
│   │   └── Results.jsx           # Photo results page
│   └── components/
│       ├── ImageGrid.jsx
│       └── SelfieCapture.jsx
├── server/                       # Backend source
│   ├── index.js                  # Express app setup
│   ├── config/
│   │   └── supabase.js           # Supabase client init
│   ├── routes/
│   │   ├── crawl.js              # POST /api/crawl
│   │   ├── auth.js               # POST /api/auth/selfie
│   │   └── images.js             # GET /api/images/:grab_id
│   ├── services/
│   │   ├── faceService.js        # Face detection, encoding, comparison
│   │   ├── crawlService.js       # Storage crawling & ingestion
│   │   └── imageService.js       # Image retrieval logic
│   ├── middleware/
│   │   ├── errorHandler.js       # Global error handler
│   │   └── upload.js             # Multer config for selfie upload
│   ├── models/                   # (Optional) DB query helpers
│   │   └── db.js
│   └── utils/
│       └── faceModels.js         # Load face-api.js models
├── models/                       # face-api.js pre-trained model weights
│   ├── ssd_mobilenetv1_model-weights_manifest.json
│   ├── face_landmark_68_model-weights_manifest.json
│   └── face_recognition_model-weights_manifest.json
├── public/
├── package.json
├── vercel.json
├── .env                          # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
├── swagger.json
└── README.md
```

### 4.2 Data Flow Diagrams

#### 4.2.1 Crawl & Ingest Flow

```
Step 1: Admin calls POST /api/crawl
Step 2: Server lists all files in Supabase Storage bucket "event-photos"
Step 3: For each image not already in DB:
    Step 3a: Download image buffer from Supabase Storage
    Step 3b: Run face detection (SSD MobileNet) → bounding boxes
    Step 3c: For each detected face:
        Step 3c-i:   Extract 128-dim face encoding
        Step 3c-ii:  Compare encoding against ALL existing grab_ids in DB
        Step 3c-iii: If distance < 0.6 to an existing grab_id → assign that grab_id
        Step 3c-iv:  If no match → create NEW grab_id (UUID v4)
        Step 3c-v:   Insert into face_image_map (grab_id, image_id)
    Step 3d: Mark image as processed in DB
Step 4: Return summary { total_images, new_faces, matched_faces }
```

#### 4.2.2 Selfie Authentication Flow

```
Step 1: User uploads selfie via POST /api/auth/selfie (multipart/form-data)
Step 2: Server receives image buffer via Multer
Step 3: Run face detection on selfie
Step 4: If no face detected → return 400 "No face detected"
Step 5: If multiple faces detected → return 400 "Multiple faces detected, use a single-face selfie"
Step 6: Extract 128-dim encoding of the detected face
Step 7: Query ALL grab_ids + their encodings from DB
Step 8: Compute euclidean distance between selfie encoding and each grab_id encoding
Step 9: Find minimum distance:
    - If min_distance < 0.6 → MATCH FOUND → return { grab_id, confidence: 1 - min_distance }
    - If min_distance >= 0.6 → NO MATCH → return 404 "No matching identity found"
```

#### 4.2.3 Image Retrieval Flow

```
Step 1: Client calls GET /api/images/:grab_id
Step 2: Server queries face_image_map JOIN images WHERE grab_id = :grab_id
Step 3: For each image, generate Supabase Storage public URL
Step 4: Return { grab_id, image_count, images: [{ id, url, created_at }] }
```

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│     images       │       │    face_image_map     │       │      faces       │
├──────────────────┤       ├──────────────────────┤       ├──────────────────┤
│ id (UUID) PK     │──┐    │ id (UUID) PK         │    ┌──│ grab_id (UUID) PK│
│ storage_path     │  └───>│ image_id (UUID) FK   │    │  │ encoding (JSONB) │
│ bucket_name      │       │ grab_id (UUID) FK    │<───┘  │ created_at       │
│ original_name    │       │ bbox_x (INT)         │       │ updated_at       │
│ file_size (INT)  │       │ bbox_y (INT)         │       └──────────────────┘
│ mime_type        │       │ bbox_width (INT)     │
│ width (INT)      │       │ bbox_height (INT)    │
│ height (INT)     │       │ confidence (FLOAT)   │
│ faces_count (INT)│       │ created_at           │
│ processed (BOOL) │       └──────────────────────┘
│ created_at       │
│ updated_at       │
└──────────────────┘
```

### 5.2 SQL Schema (Supabase PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: images
-- Stores metadata for every photo ingested from storage
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_path TEXT NOT NULL UNIQUE,       -- e.g., "event-photos/IMG_0001.jpg"
    bucket_name TEXT NOT NULL DEFAULT 'event-photos',
    original_name TEXT,                       -- original filename
    file_size INTEGER,                        -- bytes
    mime_type TEXT DEFAULT 'image/jpeg',
    width INTEGER,
    height INTEGER,
    faces_count INTEGER DEFAULT 0,           -- number of faces detected in this image
    processed BOOLEAN DEFAULT FALSE,          -- has face detection been run?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: faces
-- Each row = one unique person (one grab_id)
-- encoding stores the 128-dim face descriptor as a JSON array
CREATE TABLE faces (
    grab_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encoding JSONB NOT NULL,                  -- [0.123, -0.456, ...] 128 floats
    sample_image_id UUID,                     -- reference to a "best" photo of this face
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: face_image_map (Junction Table)
-- Maps faces to images (many-to-many)
-- One image can have many faces; one face (grab_id) can appear in many images
CREATE TABLE face_image_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    grab_id UUID NOT NULL REFERENCES faces(grab_id) ON DELETE CASCADE,
    bbox_x INTEGER,                           -- face bounding box x-coordinate
    bbox_y INTEGER,                           -- face bounding box y-coordinate
    bbox_width INTEGER,                       -- face bounding box width
    bbox_height INTEGER,                      -- face bounding box height
    confidence FLOAT,                         -- detection confidence (0.0 - 1.0)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(image_id, grab_id)                 -- prevent duplicate mappings
);

-- Indexes for performance
CREATE INDEX idx_face_image_map_image_id ON face_image_map(image_id);
CREATE INDEX idx_face_image_map_grab_id ON face_image_map(grab_id);
CREATE INDEX idx_images_processed ON images(processed);
CREATE INDEX idx_images_storage_path ON images(storage_path);
```

### 5.3 Relationship Cardinality

| Relationship | Type | Description |
|-------------|------|-------------|
| images → face_image_map | 1 : N | One image can contain multiple faces |
| faces → face_image_map | 1 : N | One person (grab_id) can appear in multiple images |
| images ↔ faces | M : N | Many-to-many through face_image_map |

---

## 6. API Specification

### 6.1 Base URL

- **Local:** `http://localhost:3001/api`
- **Production:** `https://grabpic.vercel.app/api`

### 6.2 Endpoints

#### 6.2.1 `POST /api/crawl` — Crawl & Ingest Images

Scans Supabase Storage bucket, detects faces, assigns grab_ids.

**Request:**
```
POST /api/crawl
Content-Type: application/json

{
  "bucket": "event-photos",        // optional, defaults to "event-photos"
  "limit": 50                       // optional, max images to process in this batch
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_images_found": 150,
    "already_processed": 100,
    "newly_processed": 50,
    "new_faces_discovered": 12,
    "existing_faces_matched": 85,
    "total_unique_faces": 47,
    "processing_time_ms": 34521
  }
}
```

**Response (500 Error):**
```json
{
  "success": false,
  "error": {
    "code": "CRAWL_FAILED",
    "message": "Failed to access storage bucket",
    "details": "Bucket 'event-photos' not found"
  }
}
```

---

#### 6.2.2 `POST /api/auth/selfie` — Selfie Authentication

Upload a selfie to identify the user and get their grab_id.

**Request:**
```
POST /api/auth/selfie
Content-Type: multipart/form-data

Field: "selfie" (file, JPEG/PNG, max 5MB)
```

**Response (200 OK — Match Found):**
```json
{
  "success": true,
  "data": {
    "grab_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "confidence": 0.87,
    "match_distance": 0.13,
    "total_images": 23
  }
}
```

**Response (400 — No Face Detected):**
```json
{
  "success": false,
  "error": {
    "code": "NO_FACE_DETECTED",
    "message": "No face was detected in the uploaded image. Please upload a clear selfie."
  }
}
```

**Response (400 — Multiple Faces):**
```json
{
  "success": false,
  "error": {
    "code": "MULTIPLE_FACES",
    "message": "Multiple faces detected. Please upload an image with only your face."
  }
}
```

**Response (404 — No Match):**
```json
{
  "success": false,
  "error": {
    "code": "NO_MATCH",
    "message": "No matching identity found in the database. You may not appear in any event photos."
  }
}
```

---

#### 6.2.3 `GET /api/images/:grab_id` — Retrieve User's Images

Fetch all images associated with a grab_id.

**Request:**
```
GET /api/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Images per page (max 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "grab_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "total_images": 23,
    "page": 1,
    "limit": 20,
    "images": [
      {
        "id": "img-uuid-1",
        "url": "https://xxxx.supabase.co/storage/v1/object/public/event-photos/IMG_0042.jpg",
        "original_name": "IMG_0042.jpg",
        "width": 4032,
        "height": 3024,
        "faces_count": 3,
        "created_at": "2026-04-18T10:30:00Z"
      }
    ]
  }
}
```

**Response (404 — Invalid grab_id):**
```json
{
  "success": false,
  "error": {
    "code": "GRAB_ID_NOT_FOUND",
    "message": "No identity found with the provided grab_id."
  }
}
```

---

#### 6.2.4 `GET /api/stats` — System Statistics (Nice-to-Have)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_images": 500,
    "processed_images": 480,
    "total_unique_faces": 127,
    "total_face_mappings": 1243
  }
}
```

---

#### 6.2.5 `GET /api-docs` — Swagger Documentation

Returns interactive Swagger UI for API exploration.

---

## 7. Core Modules

### 7.1 Face Service (`server/services/faceService.js`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `loadModels()` | None | void | Loads SSD MobileNet, FaceLandmark68, FaceRecognition models from `/models` directory |
| `detectFaces(imageBuffer)` | Buffer | Array<{detection, landmarks, descriptor}> | Detects all faces in an image, returns bounding boxes + 128-dim encodings |
| `compareFaces(encoding1, encoding2)` | Float32Array, Float32Array | number (distance) | Computes Euclidean distance between two face encodings |
| `findMatchingGrabId(encoding, knownFaces)` | Float32Array, Array | {grab_id, distance} or null | Finds the closest matching grab_id below threshold 0.6 |

### 7.2 Crawl Service (`server/services/crawlService.js`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `crawlBucket(bucketName, limit)` | string, number | CrawlResult | Main orchestrator: lists files, filters unprocessed, runs face pipeline |
| `listStorageFiles(bucket)` | string | Array<FileObject> | Lists all files in Supabase Storage bucket |
| `processImage(file)` | FileObject | ProcessResult | Downloads image, detects faces, assigns/matches grab_ids, persists to DB |

### 7.3 Image Service (`server/services/imageService.js`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `getImagesByGrabId(grabId, page, limit)` | string, number, number | PaginatedImages | Queries face_image_map + images, generates public URLs |
| `getImagePublicUrl(storagePath)` | string | string | Generates Supabase public URL for a stored image |

### 7.4 Middleware

| Module | Purpose |
|--------|---------|
| `errorHandler.js` | Catches all unhandled errors, returns consistent JSON error format |
| `upload.js` | Multer configuration: memory storage, 5MB limit, image MIME type validation |

---

## 8. Face Recognition Pipeline

### 8.1 Technology: face-api.js with TensorFlow.js

```
Input Image (Buffer)
        │
        v
┌───────────────────┐
│ SSD MobileNet v1  │ ──> Face Detection (bounding boxes + confidence scores)
└───────────────────┘
        │
        v
┌───────────────────┐
│ FaceLandmark68Net │ ──> 68-point facial landmark detection
└───────────────────┘
        │
        v
┌───────────────────┐
│ FaceRecognitionNet│ ──> 128-dimensional face descriptor (Float32Array)
└───────────────────┘
        │
        v
   Face Encoding
  [0.12, -0.34, 0.56, ..., 0.78]  (128 values)
```

### 8.2 Face Matching Algorithm

```
function findMatchingGrabId(newEncoding, allKnownFaces):
    bestMatch = null
    bestDistance = Infinity
    
    for each knownFace in allKnownFaces:
        distance = euclideanDistance(newEncoding, knownFace.encoding)
        if distance < bestDistance:
            bestDistance = distance
            bestMatch = knownFace.grab_id
    
    if bestDistance < THRESHOLD (0.6):
        return { grab_id: bestMatch, distance: bestDistance }
    else:
        return null  // New face, generate new grab_id
```

### 8.3 Euclidean Distance Formula

For two 128-dim vectors $a$ and $b$:

$$d(a, b) = \sqrt{\sum_{i=1}^{128} (a_i - b_i)^2}$$

- $d < 0.6$ → Same person (match)
- $d \geq 0.6$ → Different person (no match)

### 8.4 Model Files Required

| Model | File | Size | Purpose |
|-------|------|------|---------|
| SSD MobileNet v1 | `ssd_mobilenetv1_model-*` | ~5.4MB | Face detection |
| Face Landmark 68 | `face_landmark_68_model-*` | ~350KB | Landmark detection |
| Face Recognition | `face_recognition_model-*` | ~6.2MB | 128-dim encoding |

Download from: `https://github.com/justadudewhohacks/face-api.js/tree/master/weights`

---

## 9. Authentication & Security

### 9.1 Selfie-as-a-Key Authentication

This system uses **biometric authentication** — the user's face IS the key. There are no passwords or tokens.

| Security Concern | Mitigation |
|-----------------|------------|
| Spoofing (photo of a photo) | Out of scope for hackathon. Production would add liveness detection |
| grab_id exposure | grab_ids are UUIDs, not guessable. Returned only after successful face match |
| Image privacy | Supabase Storage with RLS policies. Public URLs are long, unguessable |
| API abuse | Rate limiting via `express-rate-limit` (100 req/15min per IP) |
| File upload attacks | Multer validates MIME type (image/jpeg, image/png only), max 5MB |
| SQL Injection | Supabase JS client uses parameterized queries |
| XSS | React auto-escapes output. API returns JSON only |
| CORS | Configured to allow only the frontend origin |

### 9.2 Environment Variables

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...                    # For client-side (limited access)
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # For server-side (full access, NEVER expose to client)
FACE_MATCH_THRESHOLD=0.6                    # Euclidean distance threshold
MAX_FILE_SIZE=5242880                        # 5MB in bytes
```

---

## 10. Error Handling Strategy

### 10.1 Consistent Error Response Format

Every error response follows this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "Optional technical details (dev mode only)"
  }
}
```

### 10.2 Error Codes

| Code | HTTP Status | Trigger |
|------|------------|---------|
| `NO_FACE_DETECTED` | 400 | Selfie has no detectable face |
| `MULTIPLE_FACES` | 400 | Selfie has more than one face |
| `INVALID_FILE_TYPE` | 400 | Uploaded file is not JPEG/PNG |
| `FILE_TOO_LARGE` | 400 | File exceeds 5MB |
| `NO_MATCH` | 404 | Face doesn't match any grab_id |
| `GRAB_ID_NOT_FOUND` | 404 | grab_id doesn't exist in DB |
| `CRAWL_FAILED` | 500 | Storage access or processing failure |
| `FACE_DETECTION_ERROR` | 500 | face-api.js model error |
| `DATABASE_ERROR` | 500 | Supabase query failure |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### 10.3 Global Error Handler

```javascript
// Catches all unhandled errors
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] ${err.stack}`);
    
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'An unexpected error occurred',
            ...(process.env.NODE_ENV === 'development' && { details: err.stack })
        }
    });
});
```

---

## 11. Deployment Architecture

### 11.1 Vercel Configuration

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/server/index.js" },
    { "source": "/(.*)", "destination": "/dist/$1" }
  ]
}
```

### 11.2 Supabase Setup Checklist

1. Create Supabase project
2. Create storage bucket `event-photos` (public read)
3. Run SQL schema from Section 5.2 in SQL Editor
4. Upload sample event photos to the bucket
5. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 11.3 Deployment Flow

```
Local Dev → Git Push → Vercel Auto-Deploy
                              │
                    ┌─────────┴──────────┐
                    │  Vercel Build       │
                    │  1. npm install     │
                    │  2. vite build      │
                    │  3. Deploy API +    │
                    │     Static assets   │
                    └─────────┬──────────┘
                              │
                    ┌─────────┴──────────┐
                    │  Production         │
                    │  API: /api/*        │
                    │  UI:  /*            │
                    │  Docs: /api-docs    │
                    └────────────────────┘
```

---

## 12. Sprint Plan (90 Minutes)

### Phase 1: Foundation (0:00 – 0:20) [20 min]

| # | Task | Time | Details |
|---|------|------|---------|
| 1 | Project scaffolding | 5 min | `npm init`, install deps, create folder structure |
| 2 | Supabase setup | 5 min | Create project, bucket, run SQL schema |
| 3 | Express server + Supabase client | 5 min | Basic server with health check, Supabase connection |
| 4 | Download face-api.js models | 5 min | Download model weights to `/models` directory |

**Deliverable:** Server running, Supabase connected, models loaded.

---

### Phase 2: Core Face Pipeline (0:20 – 0:50) [30 min]

| # | Task | Time | Details |
|---|------|------|---------|
| 5 | Face service: loadModels() | 5 min | Initialize face-api.js with TF.js backend |
| 6 | Face service: detectFaces() | 10 min | Accept image buffer, return face detections + encodings |
| 7 | Face service: compareFaces() + findMatch() | 5 min | Euclidean distance comparison logic |
| 8 | Crawl service: processImage() | 10 min | Download from storage, detect faces, assign grab_ids, persist to DB |

**Deliverable:** Can process a single image end-to-end (face detect → grab_id → DB).

---

### Phase 3: API Endpoints (0:50 – 1:10) [20 min]

| # | Task | Time | Details |
|---|------|------|---------|
| 9 | POST /api/crawl | 7 min | List bucket, loop processImage(), return summary |
| 10 | POST /api/auth/selfie | 8 min | Multer upload, face detect, compare against DB, return grab_id |
| 11 | GET /api/images/:grab_id | 5 min | Query junction table, return image URLs |

**Deliverable:** All 3 core APIs working.

---

### Phase 4: Frontend + Polish (1:10 – 1:35) [25 min]

| # | Task | Time | Details |
|---|------|------|---------|
| 12 | React: Selfie upload page | 10 min | File input, upload to /api/auth/selfie, display grab_id |
| 13 | React: Image results page | 8 min | Fetch /api/images/:grab_id, display grid |
| 14 | Swagger docs setup | 3 min | swagger-jsdoc annotations on routes |
| 15 | Error handling + edge cases | 4 min | Validate all error codes work correctly |

**Deliverable:** Working end-to-end demo with UI.

---

### Phase 5: Deploy & Submit (1:35 – 1:45) [10 min]

| # | Task | Time | Details |
|---|------|------|---------|
| 16 | Deploy to Vercel | 5 min | Push to GitHub, connect Vercel, set env vars |
| 17 | Test production endpoints | 3 min | Verify crawl, auth, retrieval on live URL |
| 18 | Final README + submission | 2 min | Update README with live URLs, submit |

**Deliverable:** Live, deployed, submitted.

---

## 13. Non-Functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| **Response Time** | < 3s for selfie auth, < 5s for crawl per image | face-api.js inference is ~500ms per image |
| **Image Size Limit** | 5MB per upload | Multer enforced |
| **Supported Formats** | JPEG, PNG | Validated at upload |
| **Concurrent Users** | 10-50 | Hackathon demo scale |
| **Database** | Supabase Free Tier (500MB, 2 connections) | Sufficient for demo |
| **Storage** | Supabase Storage Free Tier (1GB) | ~200 images at 5MB each |
| **Face Match Accuracy** | ~95%+ for frontal faces | face-api.js limitation: poor with extreme angles |
| **Uptime** | Best effort (Vercel free tier) | Not SLA-bound |

---

## 14. Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| face-api.js model loading fails on Vercel | Medium | Critical | Pre-load models at cold start; fallback: use external face API (e.g., AWS Rekognition) |
| Vercel serverless function timeout (10s free tier) | High | High | Process images in batches (limit=10); crawl endpoint is admin-only |
| TensorFlow.js binary incompatibility | Medium | Critical | Use `@tensorflow/tfjs` (pure JS, no native bindings) instead of `@tensorflow/tfjs-node` |
| Supabase free tier rate limits | Low | Medium | Batch DB operations; use connection pooling |
| Poor face detection on low-quality images | Medium | Medium | Document minimum requirements (frontal face, well-lit, >100x100px) |
| Time overrun on face pipeline | High | High | If blocked, use a hosted face API (face++ or AWS) as fallback |

---

## 15. Appendix

### 15.1 npm Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "@supabase/supabase-js": "^2.39.0",
    "face-api.js": "^0.22.2",
    "@tensorflow/tfjs": "^4.17.0",
    "canvas": "^2.11.2",
    "multer": "^1.4.5-lts.1",
    "express-rate-limit": "^7.1.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "vite": "^5.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

### 15.2 cURL Examples

```bash
# 1. Trigger crawl
curl -X POST https://grabpic.vercel.app/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"bucket": "event-photos", "limit": 50}'

# 2. Authenticate with selfie
curl -X POST https://grabpic.vercel.app/api/auth/selfie \
  -F "selfie=@./my-selfie.jpg"

# 3. Get my photos
curl https://grabpic.vercel.app/api/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890

# 4. Get system stats
curl https://grabpic.vercel.app/api/stats
```

### 15.3 Supabase Storage Bucket Policy

```sql
-- Allow public read access to event photos
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-photos');

-- Allow service role to upload
CREATE POLICY "Service role upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-photos');
```

---

*End of SRS Document*
