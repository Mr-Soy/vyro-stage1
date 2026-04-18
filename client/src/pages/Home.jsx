export default function Home({ onNavigate }) {
  return (
    <div className="page home">
      <div className="hero">
        <h1>Grabpic</h1>
        <p className="tagline">Find your event photos with a selfie.</p>
        <p className="description">
          Thousands of photos taken at your event? Don't scroll through them all.
          Just upload a selfie and we'll use facial recognition to find every
          photo you appear in — instantly.
        </p>

        <div className="features">
          <div className="feature-card">
            <span className="feature-icon">📸</span>
            <h3>50,000+ Photos</h3>
            <p>We process every photo from the event automatically.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🤳</span>
            <h3>Selfie as Key</h3>
            <p>Your face is your search query. No login needed.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <h3>Instant Results</h3>
            <p>Get all your photos in seconds, not hours.</p>
          </div>
        </div>

        <div className="hero-buttons">
          <button className="btn btn-primary" onClick={() => onNavigate('event-upload')}>
            Upload Event Photos
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('upload')}>
            Find My Photos
          </button>
        </div>
      </div>
    </div>
  );
}
