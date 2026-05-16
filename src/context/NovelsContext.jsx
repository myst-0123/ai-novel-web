import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NovelsContext = createContext(null);

export function NovelsProvider({ children }) {
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/novels')
      .then(r => r.json())
      .then(data => { setNovels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <NovelsContext.Provider value={{ novels, loading, reload: load }}>
      {children}
    </NovelsContext.Provider>
  );
}

export function useNovelsContext() {
  return useContext(NovelsContext);
}
