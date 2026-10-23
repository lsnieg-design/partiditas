import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

// Cachea únicamente los archivos de la interfaz. Las solicitudes y respuestas
// de la API de partidas nunca se guardan en caché: siguen yendo al servidor/Sheets.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('No se pudo registrar el service worker de Partiditas:', error);
    });
  });
}
