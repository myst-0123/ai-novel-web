import React, { useState, useEffect } from 'react';
import { StarDisplay, StarPicker } from './StarRating';

export default function CommentSection({ novelId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchComments = () => {
    setLoading(true);
    fetch(`/api/comments/${encodeURIComponent(novelId)}`)
      .then(r => r.json())
      .then(data => { setComments(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchComments();
  }, [novelId]);

  const avgRating = comments.length
    ? comments.reduce((s, c) => s + c.rating, 0) / comments.length
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim()) return setError('名前を入力してください');
    if (!rating) return setError('評価を選択してください');
    if (!comment.trim()) return setError('コメントを入力してください');

    setSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(novelId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), rating, comment: comment.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || '送信に失敗しました');
      } else {
        setSuccess('コメントを投稿しました！');
        setName('');
        setRating(0);
        setComment('');
        fetchComments();
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="comment-section">
      <h3>コメント・評価</h3>

      {avgRating !== null && (
        <div className="avg-rating-box">
          <div className="avg-big">{avgRating.toFixed(1)}</div>
          <div className="avg-detail">
            <StarDisplay rating={avgRating} size="lg" />
            <small>{comments.length}件の評価</small>
          </div>
        </div>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <h4>コメントを投稿する</h4>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 240 }}>
            <label>名前</label>
            <input
              className="form-input"
              type="text"
              placeholder="お名前"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="form-group">
            <label>評価</label>
            <StarPicker value={rating} onChange={setRating} />
          </div>
        </div>
        <div className="form-group">
          <label>コメント</label>
          <textarea
            className="form-textarea"
            placeholder="感想・コメントを書いてください（最大1000文字）"
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={1000}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
        <button className="submit-btn" type="submit" disabled={submitting}>
          {submitting ? '送信中...' : '投稿する'}
        </button>
      </form>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : comments.length === 0 ? (
        <div className="no-comments">まだコメントはありません。最初の感想を書きませんか？</div>
      ) : (
        <div className="comment-list">
          {[...comments].reverse().map(c => (
            <div key={c.id} className="comment-item">
              <div className="comment-meta">
                <span className="comment-name">{c.name}</span>
                <StarDisplay rating={c.rating} />
                <span className="comment-date">{formatDate(c.createdAt)}</span>
              </div>
              <div className="comment-text">{c.comment}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
