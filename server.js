import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Firebase 初期化（任意）────────────────────────────────────
// FIREBASE_SERVICE_ACCOUNT が設定されている場合のみ Firestore を有効化
// 未設定の場合はコメント機能なしで動作する
let db = null;
let FieldValue = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const firestoreModule = await import('firebase-admin/firestore');
    FieldValue = firestoreModule.FieldValue;

    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
    }
    db = firestoreModule.getFirestore();
    console.log('✅ Firestore 接続完了');
  } catch (err) {
    console.error('⚠️  Firestore 初期化失敗（コメント機能は無効）:', err.message);
  }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT 未設定 — コメント機能は無効です');
}

// ── Express 設定 ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const NOVELS_DIR = path.join(__dirname, 'novels');

app.use(express.json());
app.use('/novels', express.static(NOVELS_DIR));

// ── ユーティリティ ────────────────────────────────────────────
function avgRating(comments) {
  if (!comments || comments.length === 0) return null;
  const sum = comments.reduce((acc, c) => acc + c.rating, 0);
  return Math.round((sum / comments.length) * 10) / 10;
}

function toDocId(str) {
  return str.replace(/\//g, '__SLASH__');
}

// Firestore からコメント取得（未接続なら空配列を返す）
async function fetchComments(novelId) {
  if (!db) return [];
  try {
    const snap = await db
      .collection('comments')
      .doc(toDocId(novelId))
      .collection('items')
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('fetchComments エラー:', err.message);
    return [];
  }
}

// novels ディレクトリをスキャンし、評価情報を付与して返す
async function scanNovels() {
  const novels = [];
  if (!fs.existsSync(NOVELS_DIR)) return novels;

  const entries = fs.readdirSync(NOVELS_DIR, { withFileTypes: true });
  const novelIds = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      novelIds.push(entry.name.replace('.html', ''));
    } else if (entry.isDirectory()) {
      novelIds.push(entry.name);
    }
  }

  // コメント集計を並列取得
  const commentStats = await Promise.all(
    novelIds.map(async id => {
      const comments = await fetchComments(id);
      return { id, count: comments.length, avg: avgRating(comments) };
    })
  );
  const statsMap = Object.fromEntries(commentStats.map(s => [s.id, s]));

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const id = entry.name.replace('.html', '');
      const stats = statsMap[id] || { count: 0, avg: null };
      novels.push({
        id,
        title: id,
        type: 'single',
        htmlPath: `/novels/${entry.name}`,
        commentCount: stats.count,
        avgRating: stats.avg,
      });
    } else if (entry.isDirectory()) {
      const seriesDir = path.join(NOVELS_DIR, entry.name);
      const episodes = [];
      try {
        const files = fs.readdirSync(seriesDir);
        for (const file of files) {
          if (!file.endsWith('.html')) continue;
          const nameWithoutExt = file.replace('.html', '');
          const lastUnderscore = nameWithoutExt.lastIndexOf('_');
          if (lastUnderscore === -1) continue;
          const episodeTitle = nameWithoutExt.substring(0, lastUnderscore);
          const episodeNum = parseInt(nameWithoutExt.substring(lastUnderscore + 1), 10);
          episodes.push({
            fileId: nameWithoutExt,
            title: episodeTitle,
            number: isNaN(episodeNum) ? 0 : episodeNum,
            htmlPath: `/novels/${entry.name}/${file}`,
          });
        }
      } catch {}
      episodes.sort((a, b) => a.number - b.number);

      const id = entry.name;
      const stats = statsMap[id] || { count: 0, avg: null };
      novels.push({
        id,
        title: id,
        type: 'series',
        episodes,
        episodeCount: episodes.length,
        commentCount: stats.count,
        avgRating: stats.avg,
      });
    }
  }

  return novels;
}

// ── API ルート ────────────────────────────────────────────────
app.get('/api/novels', async (req, res) => {
  try {
    res.json(await scanNovels());
  } catch (err) {
    console.error('/api/novels エラー:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/novels/:id(*)', async (req, res) => {
  try {
    const novels = await scanNovels();
    const novel = novels.find(n => n.id === decodeURIComponent(req.params.id));
    if (!novel) return res.status(404).json({ error: 'Not found' });
    res.json(novel);
  } catch (err) {
    console.error('/api/novels/:id エラー:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comments/:id(*)', async (req, res) => {
  try {
    const comments = await fetchComments(decodeURIComponent(req.params.id));
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments/:id(*)', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'コメント機能は現在利用できません（Firebase未設定）' });
  }
  try {
    const { name, rating, comment } = req.body;
    // rating は任意（各話コメントは評価なし）
    if (!name || !comment) {
      return res.status(400).json({ error: '必須項目が入力されていません' });
    }

    const novelId = decodeURIComponent(req.params.id);
    const newComment = {
      id: crypto.randomUUID(),
      name: String(name).slice(0, 50),
      comment: String(comment).slice(0, 1000),
      createdAt: FieldValue.serverTimestamp(),
    };

    // 評価が送られた場合のみ保存
    if (rating !== undefined && rating !== null) {
      const ratingNum = parseInt(rating, 10);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: '評価は1〜5で入力してください' });
      }
      newComment.rating = ratingNum;
    }

    await db
      .collection('comments')
      .doc(toDocId(novelId))
      .collection('items')
      .doc(newComment.id)
      .set(newComment);

    res.status(201).json({ ...newComment, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('/api/comments POST エラー:', err);
    // Firestore gRPC NOT_FOUND (code 5): データベース未作成
    if (err.code === 5 || (err.message && err.message.includes('NOT_FOUND'))) {
      return res.status(503).json({
        error: 'Firestoreデータベースが見つかりません。Firebase ConsoleでFirestoreを有効化してください。',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── 本番: React アプリを配信 ──────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get(/^(?!\/api|\/novels).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
