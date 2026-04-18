import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Results({ grabId, onNavigate }) {
  const [images, setImages] = useState([]);
  const [totalImages, setTotalImages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (!grabId) return;
    fetchImages(page);
  }, [grabId, page]);

  async function fetchImages(p) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/images/${grabId}?page=${p}&limit=${limit}`
      );
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Failed to load images.');
        return;
      }

      setImages(data.data.images);
      setTotalImages(data.data.total_images);
    } catch (err) {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(totalImages / limit);

  return (
    <div className="page results">
      <button className="btn-back" onClick={() => onNavigate('upload')}>
        ← Try Another Selfie
      </button>

      <h2>Your Event Photos</h2>
      <p className="subtitle">
        Found <strong>{totalImages}</strong> photo{totalImages !== 1 ? 's' : ''}{' '}
        matching your face.
      </p>
      <p className="grab-id-display">
        Your ID: <code>{grabId}</code>
      </p>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Loading your photos...</p>
        </div>
      ) : images.length === 0 ? (
        <div className="empty-state">
          <p>No photos found for this identity.</p>
        </div>
      ) : (
        <>
          <div className="image-grid">
            {images.map((img) => (
              <a
                key={img.id}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="image-card"
              >
                <img src={img.url} alt={img.original_name || 'Event photo'} loading="lazy" />
                <div className="image-info">
                  <span>{img.original_name}</span>
                  {img.faces_count > 1 && (
                    <span className="face-badge">{img.faces_count} faces</span>
                  )}
                </div>
              </a>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-small"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-small"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
