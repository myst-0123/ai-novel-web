import { useState, useRef } from 'react';
import { useNovelsContext } from '../context/NovelsContext';

export function useNovelList() {
  const { novels, loading, reload } = useNovelsContext();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const syncingRef = useRef(false);

  const handleSync = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      await res.json();
      setSyncMsg(res.ok ? '同期完了' : 'エラー');
      if (res.ok) reload();
    } catch {
      setSyncMsg('エラー');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 3000);
    }
  };

  return { novels, loading, syncing, syncMsg, handleSync };
}
