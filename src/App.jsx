import React from 'react';
import './styles/global.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NovelsProvider } from './context/NovelsContext';
import TopPage from './pages/TopPage';
import SingleViewer from './pages/SingleViewer';
import SeriesIndex from './pages/SeriesIndex';
import SeriesViewer from './pages/SeriesViewer';
import UploadPage from './pages/UploadPage';

export default function App() {
  return (
    <BrowserRouter>
      <NovelsProvider>
        <Routes>
          <Route path="/" element={<TopPage />} />
          <Route path="/novel/:id" element={<SingleViewer />} />
          <Route path="/series/:id" element={<SeriesIndex />} />
          <Route path="/series/:id/:episode" element={<SeriesViewer />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </NovelsProvider>
    </BrowserRouter>
  );
}
