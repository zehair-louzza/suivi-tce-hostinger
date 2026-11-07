import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './styles/gallery.css';
import './styles/dossier.css';
import './styles/base.css';
import './styles/dir-atlas.css';
import './styles/dir-craft.css';
import './styles/dir-signal.css';
import './styles/dir-swiss.css';
import './styles/dir-bento.css';
import './styles/dir-origin-light.css';
import './styles/dir-origin-dark.css';
import Home from './gallery/Home.jsx';
import Viewer from './gallery/Viewer.jsx';
import Compare from './gallery/Compare.jsx';
import Dossier from './gallery/Dossier.jsx';
import MockRoot from './mock/MockRoot.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/viewer" element={<Viewer />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/dossier" element={<Dossier />} />
        <Route path="/m/:dir/:screen" element={<MockRoot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
