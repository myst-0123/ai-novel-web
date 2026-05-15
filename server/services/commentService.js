import { db } from '../config/firebase.js';

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

export { avgRating, toDocId, fetchComments };
