import { useNovelsContext } from '../context/NovelsContext';

export function useNovel(id) {
  const { novels, loading } = useNovelsContext();
  const novel = loading ? null : (novels.find(n => n.id === decodeURIComponent(id)) ?? null);
  return { novel, loading };
}
