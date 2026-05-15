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

router.get('/:id(*)', async (req, res) => {
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

export default router;
