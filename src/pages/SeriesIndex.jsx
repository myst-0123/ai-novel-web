import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StarDisplay } from '../components/StarRating';
import CommentSection from '../components/CommentSection';

export default function SeriesIndex() {
  const { id } = useParams();
  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => { setNovel(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!novel)  return <div className="empty-state">作品が見つかりません</div>;

  return (
    <>
      <header className="page-header">
        <Link to="/" className="back-btn">← 一覧へ戻る</Link>
        <h2>{novel.title}</h2>
      </header>

      <div className="series-index">
        <div className="series-index-meta">
          <span className="si-episode-count">全 {novel.episodeCount} 話</span>
          {novel.avgRating != null && (
            <StarDisplay rating={novel.avgRating} count={novel.commentCount} />
          )}
        </div>

        <ul className="si-episode-list">
          {novel.episodes.map(ep => (
            <li key={ep.number}>
              <Link
                to={`/series/${encodeURIComponent(id)}/${ep.number}`}
                className="si-episode-row"
              >
                <span className="si-ep-num">第 {ep.number} 話</span>
                <span className="si-ep-title">{ep.title}</span>
                {ep.commentCount > 0 && (
                  <span className="si-ep-comments">{ep.commentCount}件のコメント</span>
                )}
                <span className="si-arrow">→</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* 作品全体へのコメント・評価（星評価あり） */}
        <CommentSection novelId={id} showRating={true} />
      </div>
    </>
  );
}
