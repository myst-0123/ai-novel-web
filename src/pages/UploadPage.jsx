import React from 'react';
import { Link } from 'react-router-dom';
import { useUploadForm } from '../hooks/useUploadForm';
import '../styles/UploadPage.css';

export default function UploadPage() {
  const {
    password, setPassword,
    type, setType,
    file, setFile,
    title, setTitle,
    seriesName, setSeriesName,
    episodeTitle, setEpisodeTitle,
    episodeNumber, setEpisodeNumber,
    submitting,
    error, setError,
    success,
    handleSubmit,
  } = useUploadForm();

  return (
    <>
      <header className="site-header">
        <h1>AI小説ライブラリ</h1>
        <p>AI生成小説のコレクション</p>
      </header>

      <div className="upload-page">
        <div className="upload-back">
          <Link to="/" className="back-btn">← トップに戻る</Link>
        </div>

        <h2 className="upload-title">小説をアップロード</h2>
        <p className="upload-desc">HTMLファイルを novels/ フォルダに追加します。最大 5MB。</p>

        <form className="upload-form" onSubmit={handleSubmit}>
          {/* 種別選択 */}
          <div className="upload-type-toggle">
            <button
              type="button"
              className={`toggle-btn ${type === 'single' ? 'active' : ''}`}
              onClick={() => setType('single')}
            >
              単発小説
            </button>
            <button
              type="button"
              className={`toggle-btn ${type === 'series' ? 'active' : ''}`}
              onClick={() => setType('series')}
            >
              連載の話
            </button>
          </div>

          {/* ファイル選択 */}
          <div className="form-group">
            <label>HTMLファイル <span className="label-required">*</span></label>
            <div
              className={`file-drop-zone ${file ? 'has-file' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && f.name.toLowerCase().endsWith('.html')) {
                  setFile(f);
                  setError('');
                } else {
                  setError('HTMLファイルのみ選択できます');
                }
              }}
            >
              {file ? (
                <span className="file-name">📄 {file.name}</span>
              ) : (
                <span className="file-placeholder">クリックまたはドラッグ＆ドロップ</span>
              )}
              <input
                id="upload-file-input"
                type="file"
                accept=".html"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) { setFile(f); setError('')};
                }}
              />
            </div>
          </div>

          {/* 単発: タイトル */}
          {type === 'single' && (
            <div className="form-group">
              <label>タイトル <span className="label-optional">（任意・空欄ならファイル名を使用）</span></label>
              <input
                className="form-input"
                type="text"
                placeholder="例：黒耀回路"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>
          )}

          {/* 連載: シリーズ名 / 話タイトル / 話番号 */}
          {type === 'series' && (
            <>
              <div className="form-group">
                <label>シリーズ名 <span className="label-required">*</span></label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="例：黒耀回路"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="upload-row">
                <div className="form-group">
                  <label>話タイトル <span className="label-required">*</span></label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="例：第一章"
                    value={episodeTitle}
                    onChange={(e) => setEpisodeTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="form-group" style={{ maxWidth: 120 }}>
                  <label>話番号 <span className="label-required">*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="1"
                    min="1"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                  />
                </div>
              </div>
              <p className="upload-hint">
                保存先: novels/{seriesName || 'シリーズ名'}/{episodeTitle || '話タイトル'}_{episodeNumber || 'N'}.html
              </p>
            </>
          )}

          {/* パスワード */}
          <div className="form-group" style={{ maxWidth: 300 }}>
            <label>アップロードパスワード <span className="label-required">*</span></label>
            <input
              className="form-input"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <button className="submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'アップロード中...' : 'アップロードする'}
          </button>
        </form>
      </div>
    </>
  );
}
