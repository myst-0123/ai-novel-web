import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { Readable } from 'stream';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Firebase 初期化（任意）────────────────────────────────────
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

// ── Google Drive 初期化（OAuth2）─────────────────────────────
let drive = null;
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
const NOVELS_DIR = path.join(__dirname, 'novels');
const HTML_EXTENSION = '.html';

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REFRESH_TOKEN &&
  DRIVE_FOLDER_ID
) {
  try {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ Google Drive 接続完了（OAuth2）');
  } catch (err) {
    console.error('⚠️  Google Drive 初期化失敗（ローカルフォルダを使用）:', err.message);
  }
} else {
  console.warn('⚠️  Google Drive 環境変数未設定 — ローカルフォルダを使用');
}

// ── Express 設定 ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use('/novels', express.static(NOVELS_DIR));

// ── multer（ファイルアップロード）────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('HTMLファイルのみアップロードできます'));
    }
  },
});

function sanitizeFilename(str) {
  return String(str)
    .trim()
    .replace(/[\0\\/:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\./, '_')
    .slice(0, 200);
}

function safeJoin(base, ...parts) {
  const resolved = path.resolve(base, ...parts);
  if (!resolved.startsWith(path.resolve(base) + path.sep) &&
      resolved !== path.resolve(base)) {
    throw new Error('不正なパスです');
  }
  return resolved;
}

// ── ユーティリティ ────────────────────────────────────────────
function avgRating(comments) {
  if (!comments || comments.length === 0) return null;
  const sum = comments.reduce((acc, c) => acc + c.rating, 0);
  return Math.round((sum / comments.length) * 10) / 10;
}

function toDocId(str) {
  return str.replace(/\//g, '__SLASH__');
}

async function fetchComments(novelId) {
  if (!db) return [];
  try {
    const snap = await db
      .collection('comments')
      .doc(toDocId(novelId))
      .collection('items')
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });
  } catch (err) {
    console.error('fetchComments エラー:', err.message);
    return [];
  }
}

function stripHtmlExtension(filename) {
  return filename.slice(0, -HTML_EXTENSION.length);
}

function isHtmlFile(filename) {
  return filename.endsWith(HTML_EXTENSION);
}

// ── Google Drive ユーティリティ ───────────────────────────────
async function listDriveFiles(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: 1000,
  });
  return res.data.files || [];
}

async function downloadDriveFile(fileId, destPath) {
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  fs.writeFileSync(destPath, Buffer.from(response.data));
}

// Drive → ローカルに全ファイルを同期（既存をすべて削除してから再取得）
async function syncFromDrive() {
  if (!drive) return;
  console.log('🔄 Google Drive から同期中...');

  // ローカルをクリアしてから再作成
  if (fs.existsSync(NOVELS_DIR)) fs.rmSync(NOVELS_DIR, { recursive: true, force: true });
  fs.mkdirSync(NOVELS_DIR, { recursive: true });

  const entries = await listDriveFiles(DRIVE_FOLDER_ID);
  for (const entry of entries) {
    if (entry.mimeType === 'application/vnd.google-apps.folder') {
      // 連載フォルダ
      const seriesDir = path.join(NOVELS_DIR, entry.name);
      if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });
      const seriesFiles = await listDriveFiles(entry.id);
      for (const file of seriesFiles) {
        if (!file.name.toLowerCase().endsWith('.html')) continue;
        await downloadDriveFile(file.id, path.join(seriesDir, file.name));
      }
    } else if (entry.name.toLowerCase().endsWith('.html')) {
      // 単発ファイル
      await downloadDriveFile(entry.id, path.join(NOVELS_DIR, entry.name));
    }
  }
  console.log('✅ Google Drive 同期完了');
}

// ── scanNovels（ローカルから読み取り）────────────────────────
function collectNovelIds(entries) {
  return entries.flatMap(entry => {
    if (entry.isFile() && isHtmlFile(entry.name)) {
      return [stripHtmlExtension(entry.name)];
    }
    if (entry.isDirectory()) {
      return [entry.name];
    }
    return [];
  });
}

async function buildCommentStatsMap(novelIds) {
  const commentStats = await Promise.all(
    novelIds.map(async id => {
      const comments = await fetchComments(id);
      return { id, count: comments.length, avg: avgRating(comments) };
    })
  );
  return Object.fromEntries(commentStats.map(s => [s.id, s]));
}

function getCommentStats(statsMap, id) {
  return statsMap[id] || { count: 0, avg: null };
}

function readSeriesEpisodes(seriesDir, seriesName) {
  const episodes = [];
  try {
    const files = fs.readdirSync(seriesDir);
    for (const file of files) {
      if (!isHtmlFile(file)) continue;
      const nameWithoutExt = stripHtmlExtension(file);
      const lastUnderscore = nameWithoutExt.lastIndexOf('_');
      if (lastUnderscore === -1) continue;
      const episodeTitle = nameWithoutExt.substring(0, lastUnderscore);
      const episodeNum = parseInt(nameWithoutExt.substring(lastUnderscore + 1), 10);
      episodes.push({
        fileId: nameWithoutExt,
        title: episodeTitle,
        number: isNaN(episodeNum) ? 0 : episodeNum,
        htmlPath: `/novels/${seriesName}/${file}`,
      });
    }
  } catch {}
  return episodes.sort((a, b) => a.number - b.number);
}

async function scanNovels() {
  const novels = [];
  if (!fs.existsSync(NOVELS_DIR)) return novels;

  const entries = fs.readdirSync(NOVELS_DIR, { withFileTypes: true });
  const statsMap = await buildCommentStatsMap(collectNovelIds(entries));

  for (const entry of entries) {
    if (entry.isFile() && isHtmlFile(entry.name)) {
      const id = stripHtmlExtension(entry.name);
      const stats = getCommentStats(statsMap, id);
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
      const episodes = readSeriesEpisodes(seriesDir, entry.name);
      const id = entry.name;
      const stats = getCommentStats(statsMap, id);
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
    if (!comment) {
      return res.status(400).json({ error: 'コメントを入力してください' });
    }
    const resolvedName = (name && String(name).trim())
      ? String(name).trim().slice(0, 50)
      : '名無し';

    const novelId = decodeURIComponent(req.params.id);
    const newComment = {
      id: crypto.randomUUID(),
      name: resolvedName,
      comment: String(comment).slice(0, 1000),
      createdAt: FieldValue.serverTimestamp(),
    };

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
    if (err.code === 5 || (err.message && err.message.includes('NOT_FOUND'))) {
      return res.status(503).json({
        error: 'Firestoreデータベースが見つかりません。Firebase ConsoleでFirestoreを有効化してください。',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Drive 再同期 ──────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  if (!drive) return res.status(503).json({ error: 'Google Drive 未設定' });
  try {
    await syncFromDrive();
    res.json({ message: '同期完了' });
  } catch (err) {
    console.error('/api/sync エラー:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── アップロード ──────────────────────────────────────────────
app.post('/api/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!process.env.UPLOAD_PASSWORD) {
    return res.status(503).json({ error: 'アップロード機能は無効です（UPLOAD_PASSWORD未設定）' });
  }
  const { password, type, title, seriesName, episodeTitle, episodeNumber } = req.body;

  if (password !== process.env.UPLOAD_PASSWORD) {
    return res.status(401).json({ error: 'パスワードが違います' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'ファイルを選択してください' });
  }

  try {
    if (type === 'series') {
      if (!seriesName || !seriesName.trim())
        return res.status(400).json({ error: 'シリーズ名を入力してください' });
      if (!episodeTitle || !episodeTitle.trim())
        return res.status(400).json({ error: '話タイトルを入力してください' });
      const epNum = parseInt(episodeNumber, 10);
      if (isNaN(epNum) || epNum < 1)
        return res.status(400).json({ error: '話番号を正しく入力してください（1以上の整数）' });

      const safeSeriesName = sanitizeFilename(seriesName.trim());
      const safeEpTitle = sanitizeFilename(episodeTitle.trim());
      const filename = `${safeEpTitle}_${epNum}.html`;

      // ── ローカルに保存 ──
      const seriesDir = safeJoin(NOVELS_DIR, safeSeriesName);
      if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });
      fs.writeFileSync(safeJoin(seriesDir, filename), req.file.buffer);

      // ── Drive にもアップロード ──
      if (drive) {
        const folderSearch = await drive.files.list({
          q: `'${DRIVE_FOLDER_ID}' in parents and name = '${safeSeriesName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id)',
        });
        let folderId;
        if (folderSearch.data.files.length > 0) {
          folderId = folderSearch.data.files[0].id;
        } else {
          const folder = await drive.files.create({
            requestBody: {
              name: safeSeriesName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [DRIVE_FOLDER_ID],
            },
            fields: 'id',
          });
          folderId = folder.data.id;
        }
        await drive.files.create({
          requestBody: { name: filename, parents: [folderId] },
          media: { mimeType: 'text/html', body: Readable.from(req.file.buffer) },
          fields: 'id',
        });
      }

      return res.status(201).json({
        message: 'アップロード完了',
        path: `${safeSeriesName}/${filename}`,
      });

    } else {
      const rawTitle = (title && title.trim())
        ? title.trim()
        : req.file.originalname.replace(/\.html$/i, '');
      const safeTitle = sanitizeFilename(rawTitle);
      const filename = `${safeTitle}.html`;

      // ── ローカルに保存 ──
      if (!fs.existsSync(NOVELS_DIR)) fs.mkdirSync(NOVELS_DIR, { recursive: true });
      fs.writeFileSync(safeJoin(NOVELS_DIR, filename), req.file.buffer);

      // ── Drive にもアップロード ──
      if (drive) {
        await drive.files.create({
          requestBody: { name: filename, parents: [DRIVE_FOLDER_ID] },
          media: { mimeType: 'text/html', body: Readable.from(req.file.buffer) },
          fields: 'id',
        });
      }

      return res.status(201).json({
        message: 'アップロード完了',
        path: filename,
      });
    }
  } catch (err) {
    console.error('/api/upload エラー:', err);
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

// ── 起動時に Drive から同期 ───────────────────────────────────
if (drive) {
  await syncFromDrive().catch(err =>
    console.error('⚠️  起動時同期失敗:', err.message)
  );
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
