import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import { AuthProvider } from './lib/auth';
import { PharmacyProvider } from './lib/pharmacy-store';
import './styles.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
          <h2>React Application Crashed</h2>
          <p>{this.state.error?.message}</p>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const router = getRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <PharmacyProvider>
          <RouterProvider router={router} />
        </PharmacyProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
