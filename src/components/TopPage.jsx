import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StarDisplay } from './StarRating';

export default function TopPage() {
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('default');

  useEffect(() => {
    fetch('/api/novels')
      .then(r => r.json())
      .then(data => { setNovels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = novels.filter(n =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.title.includes(search)
    );
    if (sortOrder === 'asc') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    } else if (sortOrder === 'desc') {
      list = [...list].sort((a, b) => b.title.localeCompare(a.title, 'ja'));
    }
    return list;
  }, [novels, search, sortOrder]);

  return (
    <>
      <header className="site-header">
        <h1>AI小説ライブラリ</h1>
        <p>AI生成小説のコレクション</p>
      </header>

      <div className="controls">
        <div className="search-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="タイトルで検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="sort-select-wrapper">
          <select
            className="sort-select"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
          >
            <option value="default">並び替え：デフォルト</option>
            <option value="asc">五十音順（昇順）</option>
            <option value="desc">五十音順（降順）</option>
          </select>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div className="novel-section">
        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {search ? `「${search}」に一致する小説が見つかりません` : '小説がまだありません。novels/ フォルダに HTML ファイルを追加してください。'}
          </div>
        ) : (
          <div className="novel-grid">
            {filtered.map(novel => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NovelCard({ novel }) {
  const to = novel.type === 'series'
    ? `/series/${encodeURIComponent(novel.id)}`
    : `/novel/${encodeURIComponent(novel.id)}`;

  return (
    <Link to={to} className="novel-card">
      <span className={`card-badge ${novel.type}`}>
        {novel.type === 'series' ? '連載' : '単発'}
      </span>
      <h2 className="card-title">{novel.title}</h2>
      {novel.type === 'series' && (
        <div className="card-meta">全{novel.episodeCount}話</div>
      )}
      {novel.avgRating != null ? (
        <StarDisplay rating={novel.avgRating} count={novel.commentCount} />
      ) : (
        <div className="no-rating">まだ評価なし</div>
      )}
    </Link>
  );
}
