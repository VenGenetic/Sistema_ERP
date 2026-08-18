import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { captureInstallPrompt } from './utils/installState';

/*
  Antes de renderizar.

  Chrome dispara `beforeinstallprompt` en cuanto decide que el sitio es
  instalable, y en una segunda visita —service worker ya activo, manifiesto en
  caché— eso puede pasar antes de que React monte. El evento no se repite: si
  nadie estaba escuchando, la app se queda sin poder ofrecer la instalación
  durante toda la sesión.
*/
captureInstallPrompt();

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

  Se registra ya, no colgado de 'load'.

  Estaba diferido para no competir por ancho de banda con la primera pantalla,
  pero el precio era peor: Chrome decide si un sitio es instalable "de verdad"
  poco después de cargar, y uno de los requisitos es que exista un service
  worker con manejador de fetch. Si todavía no estaba registrado en ese momento,
  Chrome no ofrecía instalar la aplicación sino sólo añadir un acceso directo
  del navegador — un icono que abre una pestaña con barra de direcciones, no una
  app. El registro pesa unos pocos kilobytes y no bloquea el render.
*/
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('No se pudo registrar el service worker:', err);
  });
}