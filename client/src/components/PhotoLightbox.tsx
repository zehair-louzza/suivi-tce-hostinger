import React, { useState, useEffect } from 'react';

export interface PhotoItem {
  id: string;
  url: string;
  category?: string;
  caption?: string;
  takenAt?: string;
  auteur?: string;
}

interface PhotoLightboxProps {
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  const currentPhoto = photos[currentIndex] || photos[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
        setZoom(1);
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
        setZoom(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, onClose]);

  if (!currentPhoto) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setZoom(1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setZoom(1);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = currentPhoto.url;
    link.download = `photo-terrain-${currentPhoto.category || 'anelec'}-${currentPhoto.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 10, 20, 0.92)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'rgba(15, 23, 42, 0.75)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              background: '#0284c7',
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {currentPhoto.category || 'PHOTO TERRAIN'}
          </span>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            {currentPhoto.caption || 'Sans légende'}
          </div>
          {currentPhoto.auteur && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              • Prise par <strong>{currentPhoto.auteur}</strong>
            </span>
          )}
          {currentPhoto.takenAt && (
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              ({new Date(currentPhoto.takenAt).toLocaleString('fr-FR')})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '6px' }}>
            {currentIndex + 1} / {photos.length}
          </span>

          {/* Zoom In */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setZoom((z) => Math.min(z + 0.3, 3))}
            title="Zoomer"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
          >
            🔍+
          </button>
          {/* Zoom Out */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setZoom((z) => Math.max(z - 0.3, 0.7))}
            title="Dézoomer"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
          >
            🔍-
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setZoom(1)}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', fontSize: '11px' }}
            >
              100%
            </button>
          )}

          {/* Download */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownload}
            style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}
          >
            ⬇ Télécharger
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              borderRadius: '8px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '13px',
              marginLeft: '8px',
            }}
          >
            ✕ Fermer
          </button>
        </div>
      </div>

      {/* Main image viewer */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '20px',
          overflow: 'hidden',
        }}
      >
        {photos.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ‹
          </button>
        )}

        <img
          src={currentPhoto.url}
          alt={currentPhoto.caption || 'Photo'}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '92vw',
            maxHeight: '78vh',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            transform: `scale(${zoom})`,
            transition: 'transform 0.15s ease',
            cursor: zoom > 1 ? 'grab' : 'default',
          }}
        />

        {photos.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ›
          </button>
        )}
      </div>

      {/* Thumbnails strip */}
      {photos.length > 1 && (
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(15, 23, 42, 0.85)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            overflowX: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((ph, idx) => (
            <div
              key={ph.id || idx}
              onClick={() => {
                setCurrentIndex(idx);
                setZoom(1);
              }}
              style={{
                width: '64px',
                height: '46px',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: idx === currentIndex ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                opacity: idx === currentIndex ? 1 : 0.6,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <img
                src={ph.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
