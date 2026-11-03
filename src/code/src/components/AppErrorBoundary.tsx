import React from 'react';
export class AppErrorBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { console.error('app_render_failed'); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-slate-50">
      <p role="alert" className="max-w-md text-center text-sm text-red-700">No se pudo mostrar la aplicación. Recarga para volver a intentarlo.</p>
      <button type="button" onClick={() => window.location.reload()} className="text-sm font-bold text-blue-600">Recargar</button>
    </main>;
  }
}
