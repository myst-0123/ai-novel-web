import { useState, useEffect, useCallback } from 'react';

export function useComments(novelId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(() => {
    setLoading(true);
    fetch(`/api/comments/${encodeURIComponent(novelId)}`)
      .then(r => r.json())
      .then(data => { setComments(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [novelId]);

  useEffect(() => {
    setComments([]);
    fetchComments();
  }, [fetchComments]);

  return { comments, loading, refetch: fetchComments };
}
