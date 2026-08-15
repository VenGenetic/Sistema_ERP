import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

/*
  Registro del service worker (public/sw.js), lo que habilita instalar el
  sistema en la pantalla de inicio del teléfono.

  Sólo en producción: en desarrollo el service worker se interpondría entre el
  navegador y el servidor de Vite, y los cambios dejarían de verse al recargar.

  Va después de render y colgado de 'load' para no competir por ancho de banda
  con los archivos que la primera pantalla necesita para dibujarse.
*/
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('No se pudo registrar el service worker:', err);
    });
  });
}