import { Router } from 'express';
import { drive } from '../config/drive.js';
import { syncFromDrive } from '../services/driveService.js';

const router = Router();

router.post('/', async (req, res) => {
  if (!drive) return res.status(503).json({ error: 'Google Drive 未設定' });
  try {
    await syncFromDrive();
    res.json({ message: '同期完了' });
  } catch (err) {
    console.error('/api/sync エラー:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
