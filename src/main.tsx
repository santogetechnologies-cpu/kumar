import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import { AuthProvider } from './lib/auth';
import { PharmacyProvider } from './lib/pharmacy-store';
import './styles.css';

const router = getRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <PharmacyProvider>
        <RouterProvider router={router} />
      </PharmacyProvider>
    </AuthProvider>
  </React.StrictMode>
);
