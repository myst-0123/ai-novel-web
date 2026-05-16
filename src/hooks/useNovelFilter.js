import { useState, useMemo } from 'react';

export function useNovelFilter(novels) {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('default');

  const filtered = useMemo(() => {
    let list = novels.filter(n =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.title.includes(search)
    );
    switch (sortOrder) {
      case 'asc':
        list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'ja'));
        break;
      case 'desc':
        list = [...list].sort((a, b) => b.title.localeCompare(a.title, 'ja'));
        break;
      case 'rating-desc':
        list = [...list].sort((a, b) => (b.avgRating ?? -Infinity) - (a.avgRating ?? -Infinity));
        break;
      case 'rating-asc':
        list = [...list].sort((a, b) => (a.avgRating ?? Infinity) - (b.avgRating ?? Infinity));
        break;
      case 'count-desc':
        list = [...list].sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0));
        break;
      case 'count-asc':
        list = [...list].sort((a, b) => (a.commentCount ?? 0) - (b.commentCount ?? 0));
        break;
      default:
        break;
    }
    return list;
  }, [novels, search, sortOrder]);

  return { search, setSearch, sortOrder, setSortOrder, filtered };
}
