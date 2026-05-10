import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopPage from './components/TopPage';
import SingleViewer from './components/SingleViewer';
import SeriesViewer from './components/SeriesViewer';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/novel/:id" element={<SingleViewer />} />
        <Route path="/series/:id" element={<SeriesViewer />} />
        <Route path="/series/:id/:episode" element={<SeriesViewer />} />
      </Routes>
    </BrowserRouter>
  );
}
