import React, { useState, useMemo } from 'react';
import { StarDisplay, StarPicker } from './StarRating';
import '../styles/CommentSection.css';

// showRating=true  → 星評価あり（単発・連載全体用）
// showRating=false → コメントのみ（各話用）
export default function CommentSection({ novelId, showRating = true, comments, loading, refetch }) {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { ratedComments, avgRating, reversedComments } = useMemo(() => {
    const rated = comments.filter(c => c.rating != null);
    return {
      ratedComments: rated,
      avgRating: showRating && rated.length > 0
        ? rated.reduce((s, c) => s + c.rating, 0) / rated.length
        : null,
      reversedComments: [...comments].reverse(),
    };
  }, [comments, showRating]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    // 名前は任意（空なら「名無し」はサーバーで処理）
    if (showRating && !rating) return setError('評価を選択してください');
    if (!comment.trim()) return setError('コメントを入力してください');

    const body = { name: name.trim(), comment: comment.trim() };
    if (showRating && rating) body.rating = rating;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(novelId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || '送信に失敗しました');
      } else {
        setSuccess('コメントを投稿しました！');
        setName('');
        setRating(0);
        setComment('');
        refetch();
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  // ISO文字列・Firestoreシリアライズ済みタイムスタンプ両方に対応
  const formatDate = (val) => {
    if (!val) return '';
    let d;
    if (typeof val === 'string') {
      d = new Date(val);
    } else if (val._seconds !== undefined) {
      // Firestore Timestamp が JSON化された場合 { _seconds, _nanoseconds }
      d = new Date(val._seconds * 1000);
    } else if (val.seconds !== undefined) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="comment-section">
      <h3>{showRating ? 'コメント・評価' : 'この話へのコメント'}</h3>

      {avgRating !== null && (
        <div className="avg-rating-box">
          <div className="avg-big">{avgRating.toFixed(1)}</div>
          <div className="avg-detail">
            <StarDisplay rating={avgRating} size="lg" />
            <small>{ratedComments.length}件の評価</small>
          </div>
        </div>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <h4>コメントを投稿する</h4>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 240 }}>
            <label>名前 <span className="label-optional">（任意）</span></label>
            <input
              className="form-input"
              type="text"
              placeholder="空欄で「名無し」"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
            />
          </div>
          {showRating && (
            <div className="form-group">
              <label>評価</label>
              <StarPicker value={rating} onChange={setRating} />
            </div>
          )}
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
          {reversedComments.map(c => (
            <div key={c.id} className="comment-item">
              <div className="comment-meta">
                <span className="comment-name">{c.name}</span>
                {c.rating != null && <StarDisplay rating={c.rating} />}
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
