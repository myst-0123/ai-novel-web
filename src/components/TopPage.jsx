import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StarDisplay } from './StarRating';


export default function TopPage() {
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const loadNovels = () => {
    setLoading(true);
    fetch('/api/novels')
      .then(r => r.json())
      .then(data => { setNovels(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadNovels(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      setSyncMsg(res.ok ? '同期完了' : 'エラー');
      if (res.ok) loadNovels();
    } catch {
      setSyncMsg('エラー');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 3000);
    }
  };

  const filtered = useMemo(() => {
    let list = novels.filter(n =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.title.includes(search)
    );
    switch (sortOrder) {
      case 'asc':
        list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'ja'));
        break;
      case 'desc':
        list = [...list].sort((a, b) => b.title.localeCompare(a.title, 'ja'));
        break;
      case 'rating-desc':
        list = [...list].sort((a, b) => (b.avgRating ?? -Infinity) - (a.avgRating ?? -Infinity));
        break;
      case 'rating-asc':
        list = [...list].sort((a, b) => (a.avgRating ?? Infinity) - (b.avgRating ?? Infinity));
        break;
      case 'count-desc':
        list = [...list].sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0));
        break;
      case 'count-asc':
        list = [...list].sort((a, b) => (a.commentCount ?? 0) - (b.commentCount ?? 0));
        break;
      default:
        break;
    }
    return list;
  }, [novels, search, sortOrder]);

  return (
    <>
      <header className="site-header">
        <h1>AI小説ライブラリ</h1>
        <p>AI生成小説のコレクション</p>
        <Link to="/upload" className="upload-link">＋ アップロード</Link>
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
            <optgroup label="並び替え">
              <option value="default">デフォルト</option>
              <option value="asc">五十音順（昇順）</option>
              <option value="desc">五十音順（降順）</option>
            </optgroup>
            <optgroup label="評価">
              <option value="rating-desc">評価が高い順</option>
              <option value="rating-asc">評価が低い順</option>
              <option value="count-desc">評価件数が多い順</option>
              <option value="count-asc">評価件数が少ない順</option>
            </optgroup>
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
          <ul className="novel-list">
            {filtered.map(novel => (
              <NovelRow key={novel.id} novel={novel} />
            ))}
          </ul>
        )}
        <button
          className="sync-btn"
          onClick={handleSync}
          disabled={syncing}
          title="Google Driveから再同期"
        >
          {syncing ? '同期中...' : syncMsg || '↻ 再同期'}
        </button>
      </div>
    </>
  );
}

function NovelRow({ novel }) {
  const to = novel.type === 'series'
    ? `/series/${encodeURIComponent(novel.id)}`
    : `/novel/${encodeURIComponent(novel.id)}`;

  return (
    <li>
      <Link to={to} className="novel-row">
        <span className={`card-badge ${novel.type}`}>
          {novel.type === 'series' ? '連載' : '単発'}
        </span>
        <span className="novel-row-title">{novel.title}</span>
        {novel.type === 'series' && (
          <span className="novel-row-episodes">全{novel.episodeCount}話</span>
        )}
        <span className="novel-row-rating">
          {novel.avgRating != null ? (
            <StarDisplay rating={novel.avgRating} count={novel.commentCount} />
          ) : (
            <span className="no-rating">未評価</span>
          )}
        </span>
        <span className="novel-row-arrow">→</span>
      </Link>
    </li>
  );
}
