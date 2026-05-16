import { useState } from 'react';
import { useNovelsContext } from '../context/NovelsContext';

export function useNovelList() {
  const { novels, loading, reload } = useNovelsContext();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const handleSync = async () => {
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
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 3000);
    }
  };

  return { novels, loading, syncing, syncMsg, handleSync };
}
