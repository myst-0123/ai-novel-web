import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { drive } from './server/config/drive.js';
import { NOVELS_DIR } from './server/config/paths.js';
import { syncFromDrive } from './server/services/driveService.js';
import novelsRouter from './server/routes/novels.js';
import commentsRouter from './server/routes/comments.js';
import uploadRouter from './server/routes/upload.js';
import syncRouter from './server/routes/sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Express 設定 ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use('/novels', express.static(NOVELS_DIR));

// ── API ルート ────────────────────────────────────────────────
app.use('/api/novels', novelsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/sync', syncRouter);

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
