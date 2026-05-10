import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopPage from './components/TopPage';
import SingleViewer from './components/SingleViewer';
import SeriesIndex from './components/SeriesIndex';
import SeriesViewer from './components/SeriesViewer';
import UploadPage from './components/UploadPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/novel/:id" element={<SingleViewer />} />
        <Route path="/series/:id" element={<SeriesIndex />} />
        <Route path="/series/:id/:episode" element={<SeriesViewer />} />
        <Route path="/upload" element={<UploadPage />} />
      </Routes>
    </BrowserRouter>
  );
}
