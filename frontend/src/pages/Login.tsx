import React from 'react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Simulate login logic
    navigate('/location');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased transition-colors duration-200 min-h-screen flex items-center justify-center">
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden mx-auto max-w-md bg-white dark:bg-[#1a1a12] shadow-sm">
        {/* Header Section */}
        <header className="flex flex-col items-center pt-12 pb-6 px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-neutral-dark mb-6 shadow-lg rotate-3 transform transition-transform hover:rotate-0">
            <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
          </div>
          <h2 className="text-neutral-light dark:text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Operaciones</h2>
          <h1 className="text-neutral-dark dark:text-white text-3xl font-bold leading-tight text-center">Bienvenido Operario</h1>
        </header>

        {/* Main Form Content */}
        <main className="flex-1 flex flex-col px-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Usuario Field */}
            <div className="space-y-2 group">
              <label className="text-neutral-dark dark:text-gray-200 text-sm font-medium pl-1" htmlFor="username">ID de Operario</label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-neutral-light dark:text-gray-500 pointer-events-none flex items-center">
                  <span className="material-symbols-outlined">badge</span>
                </div>
                <input 
                  className="w-full rounded-full border border-border-light dark:border-border-dark bg-white dark:bg-[#2c2b1f] text-neutral-dark dark:text-white pl-12 pr-4 py-4 text-base focus:border-neutral-dark dark:focus:border-primary focus:ring-1 focus:ring-neutral-dark dark:focus:ring-primary outline-none transition-all placeholder:text-neutral-light/70 dark:placeholder:text-gray-600" 
                  id="username" 
                  placeholder="Ej. OP-4832" 
                  type="text" 
                />
              </div>
            </div>

            {/* Contraseña Field */}
            <div className="space-y-2">
              <label className="text-neutral-dark dark:text-gray-200 text-sm font-medium pl-1" htmlFor="password">Contraseña</label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-neutral-light dark:text-gray-500 pointer-events-none flex items-center">
                  <span className="material-symbols-outlined">lock</span>
                </div>
                <input 
                  className="w-full rounded-full border border-border-light dark:border-border-dark bg-white dark:bg-[#2c2b1f] text-neutral-dark dark:text-white pl-12 pr-12 py-4 text-base focus:border-neutral-dark dark:focus:border-primary focus:ring-1 focus:ring-neutral-dark dark:focus:ring-primary outline-none transition-all placeholder:text-neutral-light/70 dark:placeholder:text-gray-600" 
                  id="password" 
                  placeholder="••••••••" 
                  type="password" 
                />
                <button className="absolute right-4 text-neutral-light dark:text-gray-500 hover:text-neutral-dark dark:hover:text-white transition-colors flex items-center justify-center p-1 rounded-full focus:outline-none focus:bg-gray-100 dark:focus:bg-white/10" type="button">
                  <span className="material-symbols-outlined">visibility_off</span>
                </button>
              </div>
            </div>

            {/* Spacer */}
            <div className="h-4"></div>

            {/* Action Button */}
            <button className="relative w-full overflow-hidden rounded-full bg-primary py-4 px-6 text-neutral-dark shadow-md transition-transform hover:scale-[1.01] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-[#1a1a12]" type="submit">
              <div className="flex items-center justify-center gap-2">
                <span className="text-base font-bold tracking-wide uppercase">Iniciar Sesión</span>
                <span className="material-symbols-outlined text-lg font-bold">arrow_forward</span>
              </div>
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
            <button className="text-sm font-medium text-neutral-light dark:text-gray-400 hover:text-neutral-dark dark:hover:text-white underline decoration-dashed underline-offset-4 transition-colors">
              ¿Problemas de acceso?
            </button>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto py-6 text-center">
          <p className="text-xs text-neutral-light/60 dark:text-gray-600">
            v1.0.2 • Solo uso interno
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Login;
