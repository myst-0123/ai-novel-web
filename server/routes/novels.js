import { Router } from 'express';
import { scanNovels } from '../services/novelService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json(await scanNovels());
  } catch (err) {
    console.error('/api/novels エラー:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
