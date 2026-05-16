import React, { lazy, Suspense } from 'react';
import './styles/global.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NovelsProvider } from './context/NovelsContext';

const TopPage      = lazy(() => import('./pages/TopPage'));
const SingleViewer = lazy(() => import('./pages/SingleViewer'));
const SeriesIndex  = lazy(() => import('./pages/SeriesIndex'));
const SeriesViewer = lazy(() => import('./pages/SeriesViewer'));
const UploadPage   = lazy(() => import('./pages/UploadPage'));

export default function App() {
  return (
    <BrowserRouter>
      <NovelsProvider>
        <Suspense fallback={<div className="loading">読み込み中...</div>}>
          <Routes>
            <Route path="/" element={<TopPage />} />
            <Route path="/novel/:id" element={<SingleViewer />} />
            <Route path="/series/:id" element={<SeriesIndex />} />
            <Route path="/series/:id/:episode" element={<SeriesViewer />} />
            <Route path="/upload" element={<UploadPage />} />
          </Routes>
        </Suspense>
      </NovelsProvider>
    </BrowserRouter>
  );
}
