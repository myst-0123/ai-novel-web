import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import CommentSection from '../components/CommentSection';
import '../styles/SeriesViewer.css';

export default function SeriesViewer() {
  const { id, episode } = useParams();
  const navigate = useNavigate();
  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => { setNovel(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const currentNum = episode ? parseInt(episode, 10) : 1;
  const currentEp = novel?.episodes?.find(e => e.number === currentNum)
    ?? novel?.episodes?.[0];
  const currentIndex = novel?.episodes?.findIndex(e => e.number === currentNum) ?? 0;
  const prevEp = novel?.episodes?.[currentIndex - 1] ?? null;
  const nextEp = novel?.episodes?.[currentIndex + 1] ?? null;

  // 各話のコメントID：シリーズID + "__ep__" + 話数
  const episodeCommentId = `${id}__ep__${currentNum}`;

  const goToEp = (ep) => {
    setSidebarOpen(false);
    navigate(`/series/${encodeURIComponent(id)}/${ep.number}`);
    mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!novel) return <div className="empty-state">作品が見つかりません</div>;

  return (
    <>
      <header className="page-header">
        <Link to={`/series/${encodeURIComponent(id)}`} className="back-btn">← 話一覧へ</Link>
        <button className="back-btn sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
          ☰ 話一覧
        </button>
        <h2>
          {novel.title}
          {currentEp && (
            <span style={{ fontWeight: 400, fontSize: '0.9rem', marginLeft: 12, opacity: 0.8 }}>
              第{currentEp.number}話「{currentEp.title}」
            </span>
          )}
        </h2>
      </header>

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="viewer-layout">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">話一覧（全{novel.episodes.length}話）</div>
          <ul className="episode-list">
            {novel.episodes.map(ep => (
              <li key={ep.number} className="episode-item">
                <button
                  className={`episode-link ${ep.number === currentNum ? 'active' : ''}`}
                  onClick={() => goToEp(ep)}
                  style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span className="ep-num">#{ep.number}</span>
                  <span>{ep.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="viewer-main" ref={mainRef}>
          {currentEp ? (
            <iframe
              className="novel-iframe"
              src={currentEp.htmlPath}
              title={`${novel.title} 第${currentEp.number}話`}
            />
          ) : (
            <div className="empty-state">話が見つかりません</div>
          )}

          <nav className="ep-nav">
            {prevEp ? (
              <button className="ep-nav-btn" onClick={() => goToEp(prevEp)}>
                ← 第{prevEp.number}話
              </button>
            ) : (
              <span className="ep-nav-btn disabled">← 前の話</span>
            )}
            <span className="ep-nav-label">
              第{currentNum}話 / 全{novel.episodes.length}話
            </span>
            {nextEp ? (
              <button className="ep-nav-btn" onClick={() => goToEp(nextEp)}>
                第{nextEp.number}話 →
              </button>
            ) : (
              <span className="ep-nav-btn disabled">次の話 →</span>
            )}
          </nav>

          {/* 各話コメント：評価なし・コメントのみ */}
          <CommentSection novelId={episodeCommentId} showRating={false} />
        </main>
      </div>
    </>
  );
}
