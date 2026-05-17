import { Router } from 'express';
import fs from 'fs';
import { Readable } from 'stream';
import multer from 'multer';
import { drive, DRIVE_FOLDER_ID } from '../config/drive.js';
import { NOVELS_DIR } from '../config/paths.js';
import { sanitizeFilename, safeJoin } from '../utils/utils.js';
import { rebuildManifest } from '../services/manifestService.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('HTMLファイルのみアップロードできます'));
    }
  },
});

router.post('/', (req, res, next) => {
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

      const seriesDir = safeJoin(NOVELS_DIR, safeSeriesName);
      if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });
      fs.writeFileSync(safeJoin(seriesDir, filename), req.file.buffer);

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

      await rebuildManifest();
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

      if (!fs.existsSync(NOVELS_DIR)) fs.mkdirSync(NOVELS_DIR, { recursive: true });
      fs.writeFileSync(safeJoin(NOVELS_DIR, filename), req.file.buffer);

      if (drive) {
        await drive.files.create({
          requestBody: { name: filename, parents: [DRIVE_FOLDER_ID] },
          media: { mimeType: 'text/html', body: Readable.from(req.file.buffer) },
          fields: 'id',
        });
      }

      await rebuildManifest();
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

export default router;
