import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
const menuItems = [
  ["Resumen", "⌂", "/"],
  ["Ventas", "↗", "#"],
  ["Inventario", "▦", "/inventario"],
  ["Compras", "◎", "/compras"],
  ["Proveedores", "◇", "/proveedores"],
  ["Facturación", "▤", "#"],
  ["Reportes", "◫", "#"],
];

const metrics = [
  ["Ventas de hoy", "S/ 4,280.50", "+12.5%", "text-emerald-600"],
  ["Órdenes", "126", "+8.2%", "text-sky-600"],
  ["Ticket promedio", "S/ 33.97", "+3.8%", "text-violet-600"],
  ["Stock crítico", "8 productos", "Revisar", "text-amber-600"],
];

const sales = [42, 54, 48, 68, 60, 82, 74, 91, 78, 96, 86, 100];

const orders = [
  ["#1048", "Salón", "S/ 86.00", "Completada"],
  ["#1047", "Delivery", "S/ 54.50", "Preparando"],
  ["#1046", "Recojo", "S/ 39.90", "Completada"],
];

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const { data: products } = membership
    ? await supabase
        .from("products")
        .select("id, name, category, unit, current_stock, minimum_stock")
        .eq("restaurant_id", membership.restaurant_id)
        .eq("active", true)
        .order("current_stock", { ascending: true })
    : { data: [] };

  const criticalProducts = (products || []).filter(
    (product) =>
      Number(product.current_stock) <= Number(product.minimum_stock),
  );

  const criticalCount = criticalProducts.length;

  const dashboardMetrics = metrics.map((metric) =>
    metric[0] === "Stock crítico"
      ? [
          "Stock crítico",
          `${criticalCount} ${criticalCount === 1 ? "producto" : "productos"}`,
          "Revisar",
          "text-amber-600",
        ]
      : metric,
  );
  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white shadow-lg shadow-emerald-200">P</div>
          <div>
            <div className="text-xl font-black tracking-tight">Prand<span className="text-emerald-600">IQ</span></div>
            <p className="text-xs text-slate-400">Restaurant Intelligence</p>
          </div>
        </div>

        <nav className="mt-9 space-y-1">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Operaciones</p>
          {menuItems.map(([label, icon, href], index) => (
            <a key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${index === 0 ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-lg text-base ${index === 0 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>{icon}</span>
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white">
          <p className="text-xs font-semibold text-emerald-300">PrandIQ Insights</p>
          <p className="mt-2 text-sm font-bold leading-snug">Tus ventas subieron 12.5% esta semana.</p>
          <button className="mt-4 text-xs font-bold text-white/70 hover:text-white">Ver análisis →</button>
        </div>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur md:px-8">
          <div>
            <p className="text-xs font-semibold text-slate-400">Viernes, 18 de julio</p>
            <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">Buenos días, Daniel</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm sm:block">Descargar reporte</button>
            <button className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200">+ Nueva venta</button>
            <LogoutButton initials="DR" />
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Resumen del negocio</h2>
              <p className="mt-1 text-sm text-slate-500">Todo lo que ocurre hoy en Tu Punto de Encuentro.</p>
            </div>
            <select className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"><option>Hoy</option><option>Esta semana</option><option>Este mes</option></select>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardMetrics.map(([label, value, change, color]) => (
              <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-4 text-2xl font-black tracking-tight">{value}</p>
                <p className={`mt-2 text-xs font-bold ${color}`}>{change} <span className="font-medium text-slate-400">{label === "Stock crítico" ? "requieren atención" : "vs. ayer"}</span></p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between">
                <div><h3 className="font-extrabold">Rendimiento de ventas</h3><p className="mt-1 text-xs text-slate-400">Ingresos por hora · Hoy</p></div>
                <div className="text-right"><p className="text-xl font-black">S/ 4,280.50</p><p className="text-xs font-bold text-emerald-600">+12.5%</p></div>
              </div>
              <div className="mt-8 flex h-56 items-end gap-2 border-b border-slate-100 md:gap-3">
                {sales.map((height, index) => <div key={index} className="group flex h-full flex-1 items-end"><div className="w-full rounded-t-md bg-emerald-100 transition group-hover:bg-emerald-500" style={{ height: `${height}%` }} /></div>)}
              </div>
              <div className="mt-3 flex justify-between text-[10px] font-semibold text-slate-400"><span>9 am</span><span>12 pm</span><span>3 pm</span><span>6 pm</span><span>9 pm</span></div>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between"><div><h3 className="font-extrabold">Ventas por canal</h3><p className="mt-1 text-xs text-slate-400">Distribución de ingresos</p></div><button className="text-xs font-bold text-emerald-600">Detalles</button></div>
              <div className="mt-7 flex justify-center"><div className="grid h-40 w-40 place-items-center rounded-full bg-[conic-gradient(#059669_0_52%,#38bdf8_52%_79%,#a78bfa_79%_100%)]"><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><p className="text-2xl font-black">126</p><p className="text-[10px] text-slate-400">órdenes</p></div></div></div></div>
              <div className="mt-7 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-slate-500">● Salón</p><p className="mt-1 text-sm font-black">52%</p></div>
                <div><p className="text-xs text-sky-500">● Delivery</p><p className="mt-1 text-sm font-black">27%</p></div>
                <div><p className="text-xs text-violet-500">● Recojo</p><p className="mt-1 text-sm font-black">21%</p></div>
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="font-extrabold">Alertas de inventario</h3><p className="mt-1 text-xs text-slate-400">Productos que necesitan reposición</p></div><a href="/inventario" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Ver inventario</a></div>
              {criticalProducts.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-bold text-emerald-600">Inventario en orden</p>
                  <p className="mt-1 text-xs text-slate-400">No hay productos con stock bajo.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {criticalProducts.map((product) => (
                    <div key={product.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4">
                      <div>
                        <p className="text-sm font-bold">{product.name}</p>
                        <p className="text-xs text-slate-400">{product.category || "Sin categoría"}</p>
                      </div>
                      <p className="text-sm font-extrabold">{Number(product.current_stock)} {product.unit}</p>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600">Stock bajo</span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="font-extrabold">Últimas órdenes</h3><p className="mt-1 text-xs text-slate-400">Actividad reciente del restaurante</p></div><button className="text-xs font-bold text-emerald-600">Ver todas</button></div>
              <div className="divide-y divide-slate-100">{orders.map(([id, channel, total, status]) => <div key={id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-xs font-black">{id.slice(-2)}</div><div><p className="text-sm font-bold">{id} · {channel}</p><p className="text-xs text-slate-400">{status}</p></div><p className="text-sm font-black">{total}</p></div>)}</div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}