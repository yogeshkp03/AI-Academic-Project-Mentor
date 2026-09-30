import { Sidebar } from './Sidebar';

export function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="ml-16 p-5 md:ml-20 md:p-7 lg:ml-64 lg:p-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}