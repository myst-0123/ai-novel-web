import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { Readable } from 'stream';
import multer from 'multer';
import { HTML_EXTENSION, sanitizeFilename, safeJoin } from './server/utils/utils.js';
import { db, FieldValue } from './server/config/firebase.js';
import { drive, DRIVE_FOLDER_ID } from './server/config/drive.js';
import { NOVELS_DIR } from './server/config/paths.js';
import { fetchComments, toDocId } from './server/services/commentService.js';
import { scanNovels } from './server/services/novelService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
