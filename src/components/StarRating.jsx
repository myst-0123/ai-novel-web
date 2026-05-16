import React from 'react';
import '../styles/StarRating.css';

export function StarDisplay({ rating, count, size = 'sm' }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className="stars-display">
      <div className="stars">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className={`star-icon ${i <= rounded ? 'filled' : ''}`}
            style={{ fontSize: size === 'lg' ? '1.4rem' : '1rem' }}
          >
            ★
          </span>
        ))}
      </div>
      {rating != null && (
        <span className="rating-val">{Number(rating).toFixed(1)}</span>
      )}
      {count != null && (
        <span className="rating-count">({count}件)</span>
      )}
    </div>
  );
}

export function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = React.useState(0);
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className={i <= (hovered || value) ? 'active' : ''}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          aria-label={`${i}星`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
