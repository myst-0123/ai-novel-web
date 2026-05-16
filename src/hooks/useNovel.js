import { useState, useEffect } from 'react';

export function useNovel(id) {
  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => { setNovel(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  return { novel, loading };
}
