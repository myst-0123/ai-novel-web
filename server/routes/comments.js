import { Router } from 'express';
import crypto from 'crypto';
import { db, FieldValue } from '../config/firebase.js';
import { fetchComments, toDocId } from '../services/commentService.js';

const router = Router();

router.get('/:id(*)', async (req, res) => {
  try {
    const comments = await fetchComments(decodeURIComponent(req.params.id));
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id(*)', async (req, res) => {
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

export default router;
