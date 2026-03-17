import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AdminSection,
  MaterialIcon,
  StatCard,
  SurfaceCard,
  cn,
} from '../components/admin/ui/AdminPrimitives';

interface DashboardSection {
  description: string;
  icon: string;
  kicker: string;
  label: string;
  match: string[];
  to: string;
}

const dashboardSections: DashboardSection[] = [
  {
    description: 'Actividad reciente y visibilidad inmediata de guias procesadas.',
    icon: 'radar',
    kicker: 'Tiempo real',
    label: 'Monitor',
    match: ['/dashboard', '/dashboard/monitor'],
    to: '/dashboard/monitor',
  },
  {
    description: 'Busqueda, filtros y seguimiento historico de todos los registros.',
    icon: 'inventory_2',
    kicker: 'Historial',
    label: 'Guias',
    match: ['/dashboard/shipments'],
    to: '/dashboard/shipments',
  },
  {
    description: 'Altas, edicion y permisos del personal operativo y administrativo.',
    icon: 'group',
    kicker: 'Accesos',
    label: 'Usuarios',
    match: ['/dashboard/users'],
    to: '/dashboard/users',
  },
  {
    description: 'Mantenimiento de zonas activas para operacion y seleccion en login.',
    icon: 'map',
    kicker: 'Operacion',
    label: 'Zonas',
    match: ['/dashboard/zones'],
    to: '/dashboard/zones',
  },
  {
    description: 'Catalogos auxiliares para estados y gestiones visibles en el flujo.',
    icon: 'category',
    kicker: 'Configuracion',
    label: 'Catalogos',
    match: ['/dashboard/catalogs'],
    to: '/dashboard/catalogs',
  },
];

const getNavItemClassName = (active: boolean) =>
  cn(
    'group flex w-full items-start gap-3 rounded-3xl px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
    active
      ? 'bg-primary/12 text-dark-text dark:bg-primary/12 dark:text-white'
      : 'text-gray-600 hover:bg-gray-50 hover:text-dark-text dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white',
  );

const Dashboard = () => {
  const location = useLocation();
  const currentSection =
    dashboardSections.find((section) => section.match.includes(location.pathname)) ??
    dashboardSections[0];

  return (
    <div className="min-h-screen bg-background-light font-display text-dark-text dark:bg-background-dark dark:text-white">
      <a
        className="sr-only absolute left-4 top-4 z-50 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-dark-text shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-[#181811] dark:text-white"
        href="#admin-content"
      >
        Ir al contenido
      </a>

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <SurfaceCard className="overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                Panel Administrativo
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tight text-balance text-dark-text dark:text-white sm:text-[2.6rem]">
                  Cibermundo Assist
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300 sm:text-[15px]">
                  Administra operacion, catalogos y usuarios desde un solo lugar. La logica se mantiene,
                  pero la lectura, jerarquia y navegacion ahora priorizan velocidad de uso.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex touch-manipulation items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2.5 text-sm font-bold text-dark-text transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-white/10 dark:bg-[#232218] dark:text-white dark:hover:bg-[#2b2a1f]"
                to="/home"
              >
                <MaterialIcon className="text-[18px]" name="arrow_back" />
                Volver al inicio
              </Link>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-primary/12 px-4 py-2.5 text-sm font-bold text-dark-text dark:text-white">
                <MaterialIcon className="text-[18px] text-primary" name={currentSection.icon} />
                {currentSection.label}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon="grid_view" label="Modulos" tone="default" value={dashboardSections.length} />
            <StatCard icon="radar" label="Vista activa" tone="primary" value={currentSection.label} />
            <StatCard icon="space_dashboard" label="Diseno" tone="success" value="Unificado" />
            <StatCard icon="verified_user" label="Flujo" tone="warning" value="Sin cambios" />
          </div>
        </SurfaceCard>

        <div className="grid flex-1 gap-6 2xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden 2xl:block">
            <SurfaceCard className="sticky top-6 px-3 py-3">
              <nav aria-label="Secciones del dashboard" className="space-y-1">
                {dashboardSections.map((section) => {
                  const active = section.match.includes(location.pathname);

                  return (
                    <NavLink className={getNavItemClassName(active)} key={section.to} to={section.to}>
                      <div
                        className={cn(
                          'flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
                          active
                            ? 'bg-primary text-neutral-dark'
                            : 'bg-gray-100 text-gray-500 group-hover:bg-white dark:bg-white/5 dark:text-gray-300 dark:group-hover:bg-white/10',
                        )}
                      >
                        <MaterialIcon className="text-[20px]" name={section.icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-current/55">
                          {section.kicker}
                        </p>
                        <p className="mt-1 text-sm font-black">{section.label}</p>
                        <p className="mt-1 text-xs leading-5 text-current/70">{section.description}</p>
                      </div>
                    </NavLink>
                  );
                })}
              </nav>
            </SurfaceCard>
          </aside>

          <AdminSection className="gap-4 lg:gap-5">
            <div className="2xl:hidden">
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="tablist">
                {dashboardSections.map((section) => {
                  const active = section.match.includes(location.pathname);

                  return (
                    <NavLink
                      className={cn(
                        'inline-flex min-w-max items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        active
                          ? 'border-primary/30 bg-primary/12 text-dark-text dark:text-white'
                          : 'border-gray-200/80 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-[#181811] dark:text-gray-300 dark:hover:bg-white/5',
                      )}
                      key={section.to}
                      to={section.to}
                    >
                      <MaterialIcon className="text-[18px]" name={section.icon} />
                      {section.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <SurfaceCard className="px-5 py-4 sm:px-6">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                Seccion activa
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-dark-text dark:text-white">
                    {currentSection.label}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {currentSection.description}
                  </p>
                </div>
              </div>
            </SurfaceCard>

            <main className="flex min-h-0 flex-1 flex-col" id="admin-content">
              <Outlet />
            </main>
          </AdminSection>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
