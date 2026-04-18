-- ============================================================
-- Grabpic — Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: images
-- Stores metadata for every photo ingested from storage
-- ============================================================
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_path TEXT NOT NULL UNIQUE,           -- e.g. "event-photos/IMG_0001.jpg"
    bucket_name TEXT NOT NULL DEFAULT 'event-photos',
    original_name TEXT,                           -- original filename
    file_size INTEGER,                            -- bytes
    mime_type TEXT DEFAULT 'image/jpeg',
    width INTEGER,
    height INTEGER,
    faces_count INTEGER DEFAULT 0,               -- number of faces detected
    processed BOOLEAN DEFAULT FALSE,              -- has face detection been run?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: faces
-- Each row = one unique person (one grab_id)
-- encoding stores the 128-dim face descriptor as a JSON array
-- ============================================================
CREATE TABLE faces (
    grab_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encoding JSONB NOT NULL,                      -- [0.123, -0.456, ...] 128 floats
    sample_image_id UUID,                         -- reference to a representative photo
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: face_image_map (Junction / Many-to-Many)
-- One image can have many faces; one face can appear in many images
-- ============================================================
CREATE TABLE face_image_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    grab_id UUID NOT NULL REFERENCES faces(grab_id) ON DELETE CASCADE,
    bbox_x INTEGER,                               -- bounding box x
    bbox_y INTEGER,                               -- bounding box y
    bbox_width INTEGER,                           -- bounding box width
    bbox_height INTEGER,                          -- bounding box height
    confidence FLOAT,                             -- detection confidence 0.0–1.0
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(image_id, grab_id)                     -- prevent duplicate mappings
);

-- ============================================================
-- Indexes for query performance
-- ============================================================
CREATE INDEX idx_face_image_map_image_id ON face_image_map(image_id);
CREATE INDEX idx_face_image_map_grab_id ON face_image_map(grab_id);
CREATE INDEX idx_images_processed ON images(processed);
CREATE INDEX idx_images_storage_path ON images(storage_path);

-- ============================================================
-- Supabase Storage Bucket Policies
-- Run these AFTER creating the "event-photos" bucket
-- ============================================================

-- Allow public read access to event photos
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-photos');

-- Allow authenticated/service role to upload
CREATE POLICY "Service role upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-photos');
