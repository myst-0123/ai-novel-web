import React from 'react';
import { useParams, Link } from 'react-router-dom';
import CommentSection from '../components/CommentSection';
import { useNovel } from '../hooks/useNovel';

export default function SingleViewer() {
  const { id } = useParams();
  const { novel, loading } = useNovel(id);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!novel) return <div className="empty-state">小説が見つかりません</div>;

  return (
    <>
      <header className="page-header">
        <Link to="/" className="back-btn">← 一覧へ戻る</Link>
        <h2>{novel.title}</h2>
      </header>
      <div className="viewer-layout">
        <main className="viewer-main">
          <iframe
            className="novel-iframe"
            src={novel.htmlPath}
            title={novel.title}
          />
          <CommentSection novelId={id} />
        </main>
      </div>
    </>
  );
}
