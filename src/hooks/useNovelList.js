import { useState, useEffect } from 'react';

export function useNovelList() {
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/novels')
      .then(r => r.json())
      .then(data => { setNovels(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      await res.json();
      setSyncMsg(res.ok ? '同期完了' : 'エラー');
      if (res.ok) load();
    } catch {
      setSyncMsg('エラー');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 3000);
    }
  };

  return { novels, loading, syncing, syncMsg, handleSync };
}
