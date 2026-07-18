import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.24),transparent_34%),radial-gradient(circle_at_80%_75%,rgba(56,189,248,0.14),transparent_30%)]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-xl font-black">P</div>
          <div>
            <div className="text-2xl font-black tracking-tight">Prand<span className="text-emerald-400">IQ</span></div>
            <p className="text-xs text-slate-400">Restaurant Intelligence</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">El centro de tu operación</p>
          <h1 className="text-5xl font-black leading-[1.08] tracking-tight xl:text-6xl">Decisiones más inteligentes. Restaurantes más rentables.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">Controla ventas, inventario, compras, proveedores y resultados desde un solo lugar.</p>
        </div>

        <div className="relative grid grid-cols-3 gap-4">
          {["Ventas en tiempo real", "Inventario inteligente", "Reportes automáticos"].map((feature) => (
            <div key={feature} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-slate-200 backdrop-blur">✓ {feature}</div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 font-black text-white">P</div>
            <div className="text-xl font-black">Prand<span className="text-emerald-600">IQ</span></div>
          </div>

          <p className="text-sm font-bold text-emerald-600">BIENVENIDO DE NUEVO</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Inicia sesión en PrandIQ</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Ingresa con la cuenta autorizada para administrar tu restaurante.</p>

          {error && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
          )}

          <form action={login} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Correo electrónico</span>
              <input name="email" type="email" autoComplete="email" required placeholder="nombre@restaurante.com" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Contraseña</span>
              <input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-500"><input type="checkbox" className="h-4 w-4 accent-emerald-600" /> Recordarme</label>
              <button type="button" className="font-bold text-emerald-600">¿Olvidaste tu contraseña?</button>
            </div>

            <button type="submit" className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700">Iniciar sesión</button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Acceso protegido por PrandIQ. Al continuar aceptas los términos y políticas de seguridad.</p>
        </div>
      </section>
    </main>
  );
}
