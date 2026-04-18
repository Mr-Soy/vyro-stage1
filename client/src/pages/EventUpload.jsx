import { useState, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function EventUpload({ onNavigate }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    addFiles(Array.from(e.target.files));
  }

  function handleDrop(e) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    addFiles(dropped);
  }

  function addFiles(newFiles) {
    setError(null);
    setResult(null);
    const combined = [...files, ...newFiles].slice(0, 20);
    setFiles(combined);

    const newPreviews = [];
    combined.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        newPreviews.push({ name: f.name, src: reader.result });
        if (newPreviews.length === combined.length) {
          setPreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(f);
    });
  }

  function removeFile(index) {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    setPreviews(previews.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) {
      setError('Please select at least one photo.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('photos', f));

      const res = await fetch(`${API_URL}/api/upload/event-photos`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Upload failed.');
        return;
      }

      setResult(data.data);
      setFiles([]);
      setPreviews([]);
    } catch (err) {
      setError('Failed to connect to the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page event-upload">
      <button className="btn-back" onClick={() => onNavigate('home')}>
        ← Back
      </button>

      <h2>Upload Event Photos</h2>
      <p className="subtitle">
        Upload group or event photos. We'll detect every face and index them so
        attendees can find themselves with a selfie.
      </p>

      <div
        className={`drop-zone ${previews.length ? 'has-preview' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {previews.length > 0 ? (
          <div className="preview-grid">
            {previews.map((p, i) => (
              <div key={i} className="preview-thumb">
                <img src={p.src} alt={p.name} />
                <button
                  className="remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="drop-placeholder">
            <span className="drop-icon">📷</span>
            <p>Click or drag & drop event photos here</p>
            <p className="drop-hint">Up to 20 images — JPEG, PNG, or WebP — max 5MB each</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          hidden
        />
      </div>

      {files.length > 0 && (
        <p className="file-count">{files.length} photo{files.length !== 1 ? 's' : ''} selected</p>
      )}

      {error && <div className="error-msg">{error}</div>}

      {result && (
        <div className="upload-result">
          <h3>Upload Complete</h3>
          <p>
            <strong>{result.total_uploaded}</strong> photo{result.total_uploaded !== 1 ? 's' : ''} processed
            {result.total_failed > 0 && <>, <strong>{result.total_failed}</strong> failed</>}
          </p>
          <p>
            <strong>{result.new_faces}</strong> new face{result.new_faces !== 1 ? 's' : ''} discovered,{' '}
            <strong>{result.matched_faces}</strong> existing face{result.matched_faces !== 1 ? 's' : ''} matched
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('upload')}>
            Now Find Yourself →
          </button>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleUpload}
        disabled={files.length === 0 || loading}
      >
        {loading ? 'Uploading & Processing...' : `Upload ${files.length || ''} Photo${files.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}
