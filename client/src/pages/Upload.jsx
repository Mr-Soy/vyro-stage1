import { useState, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Upload({ onNavigate }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;

    setError(null);
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(selected);
  }

  function handleDrop(e) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('image/')) {
      setError(null);
      setFile(dropped);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(dropped);
    }
  }

  async function handleSubmit() {
    if (!file) {
      setError('Please select a selfie first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('selfie', file);

      const res = await fetch(`${API_URL}/api/auth/selfie`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Something went wrong.');
        return;
      }

      // Success — navigate to results with grab_id
      onNavigate('results', data.data.grab_id);
    } catch (err) {
      setError('Failed to connect to the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page upload">
      <button className="btn-back" onClick={() => onNavigate('home')}>
        ← Back
      </button>

      <h2>Upload Your Selfie</h2>
      <p className="subtitle">
        Take or upload a clear selfie. We'll match your face against all event
        photos to find you.
      </p>

      <div
        className={`drop-zone ${preview ? 'has-preview' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {preview ? (
          <img src={preview} alt="Selfie preview" className="selfie-preview" />
        ) : (
          <div className="drop-placeholder">
            <span className="drop-icon">🤳</span>
            <p>Click or drag & drop your selfie here</p>
            <p className="drop-hint">JPEG, PNG, or WebP — max 5MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          hidden
        />
      </div>

      {error && <div className="error-msg">{error}</div>}

      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!file || loading}
      >
        {loading ? 'Searching...' : 'Find My Photos'}
      </button>
    </div>
  );
}
