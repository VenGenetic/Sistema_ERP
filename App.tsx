import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy load pages
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Team = React.lazy(() => import('./pages/Team'));
const Partners = React.lazy(() => import('./pages/Partners'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Finance = React.lazy(() => import('./pages/Finance'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Login = React.lazy(() => import('./pages/Login'));
const AdminSetup = React.lazy(() => import('./pages/AdminSetup'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-gray-400">Cargando...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<AdminSetup />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="team" element={<Team />} />
            <Route path="partners" element={<Partners />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="finance" element={<Finance />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;