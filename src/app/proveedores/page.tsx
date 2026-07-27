import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createSupplier,
  toggleSupplierStatus,
  updateSupplier,
} from "./actions";

const menuItems = [
  ["Resumen", "⌂", "/"],
  ["Ventas", "↗", "#"],
  ["Inventario", "▦", "/inventario"],
  ["Compras", "◎", "#"],
  ["Proveedores", "◇", "/proveedores"],
  ["Facturación", "▤", "#"],
  ["Reportes", "◫", "#"],
];

type Supplier = {
  id: string;
  business_name: string;
  trade_name: string | null;
  document_type: string;
  document_number: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50";

function SupplierFields({ supplier }: { supplier?: Supplier }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-bold text-slate-500">
        Razón social *
        <input name="business_name" required defaultValue={supplier?.business_name} className={inputClass} placeholder="Distribuidora Lima S.A.C." />
      </label>
      <label className="text-xs font-bold text-slate-500">
        Nombre comercial
        <input name="trade_name" defaultValue={supplier?.trade_name || ""} className={inputClass} placeholder="Distribuidora Lima" />
      </label>
      <label className="text-xs font-bold text-slate-500">
        Tipo de documento
        <select name="document_type" defaultValue={supplier?.document_type || "RUC"} className={inputClass}>
          <option>RUC</option><option>DNI</option><option>CE</option><option>OTRO</option>
        </select>
      </label>
      <label className="text-xs font-bold text-slate-500">
        Número de documento
        <input name="document_number" defaultValue={supplier?.document_number || ""} className={inputClass} placeholder="20123456789" />
      </label>
      <label className="text-xs font-bold text-slate-500">
        Persona de contacto
        <input name="contact_name" defaultValue={supplier?.contact_name || ""} className={inputClass} placeholder="María Pérez" />
      </label>
      <label className="text-xs font-bold text-slate-500">
        Teléfono
        <input name="phone" type="tel" defaultValue={supplier?.phone || ""} className={inputClass} placeholder="987 654 321" />
      </label>
      <label className="text-xs font-bold text-slate-500">
        Correo
        <input name="email" type="email" defaultValue={supplier?.email || ""} className={inputClass} placeholder="ventas@proveedor.pe" />
      </label>
      <label className="text-xs font-bold text-slate-500">
        Dirección
        <input name="address" defaultValue={supplier?.address || ""} className={inputClass} placeholder="Av. Principal 123" />
      </label>
      <label className="text-xs font-bold text-slate-500 md:col-span-2 xl:col-span-4">
        Notas
        <textarea name="notes" defaultValue={supplier?.notes || ""} className={`${inputClass} min-h-20 resize-y`} placeholder="Condiciones de pago, horario de atención u observaciones" />
      </label>
    </div>
  );
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/");

  let query = supabase
    .from("suppliers")
    .select("id, business_name, trade_name, document_type, document_number, contact_name, phone, email, address, notes, active")
    .eq("restaurant_id", membership.restaurant_id)
    .order("active", { ascending: false })
    .order("business_name");

  const search = (params.q || "").trim();
  if (search) {
    const safeSearch = search.replace(/[%_,()]/g, " ");
    query = query.or(`business_name.ilike.%${safeSearch}%,trade_name.ilike.%${safeSearch}%,document_number.ilike.%${safeSearch}%`);
  }

  const { data } = await query;
  const suppliers = (data || []) as Supplier[];
  const editingSupplier = suppliers.find((supplier) => supplier.id === params.edit);
  const activeCount = suppliers.filter((supplier) => supplier.active).length;

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white shadow-lg shadow-emerald-200">P</div>
          <div><div className="text-xl font-black tracking-tight">Prand<span className="text-emerald-600">IQ</span></div><p className="text-xs text-slate-400">Restaurant Intelligence</p></div>
        </div>
        <nav className="mt-9 space-y-1">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Operaciones</p>
          {menuItems.map(([label, icon, href]) => {
            const active = label === "Proveedores";
            return <a key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><span className={`grid h-7 w-7 place-items-center rounded-lg text-base ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>{icon}</span>{label}</a>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white"><p className="text-xs font-semibold text-emerald-300">Gestión de compras</p><p className="mt-2 text-sm font-bold leading-snug">Mantén actualizados los datos de tus proveedores.</p></div>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur md:px-8">
          <div><a href="/" className="text-xs font-bold text-emerald-600">← Volver al resumen</a><h1 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">Proveedores</h1></div>
          <LogoutButton initials="DR" />
        </header>

        <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
          <section className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Proveedores registrados</p><p className="mt-3 text-3xl font-black">{suppliers.length}</p></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Proveedores activos</p><p className="mt-3 text-3xl font-black text-emerald-600">{activeCount}</p></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Inactivos</p><p className="mt-3 text-3xl font-black text-slate-400">{suppliers.length - activeCount}</p></article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5"><h2 className="text-lg font-black">Registrar proveedor</h2><p className="mt-1 text-sm text-slate-400">Agrega los datos comerciales y de contacto.</p></div>
            <form action={createSupplier} className="space-y-5">
              <SupplierFields />
              <div className="flex justify-end"><button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700">+ Guardar proveedor</button></div>
            </form>
          </section>

          {editingSupplier && (
            <section className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-black">Editar proveedor</h2><p className="mt-1 text-sm text-slate-400">Actualiza la información de {editingSupplier.business_name}.</p></div><a href="/proveedores" className="text-sm font-bold text-slate-400 hover:text-slate-700">Cerrar ×</a></div>
              <form action={updateSupplier} className="space-y-5">
                <input type="hidden" name="supplier_id" value={editingSupplier.id} />
                <SupplierFields supplier={editingSupplier} />
                <div className="flex justify-end"><button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Guardar cambios</button></div>
              </form>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-black">Lista de proveedores</h2><p className="mt-1 text-sm text-slate-400">Consulta, edita y controla su estado.</p></div>
              <form className="flex gap-2"><input name="q" defaultValue={search} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 sm:w-72" placeholder="Buscar por nombre o documento" /><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Buscar</button></form>
            </div>
            {suppliers.length === 0 ? (
              <div className="px-5 py-14 text-center"><p className="font-bold text-slate-600">{search ? "No se encontraron proveedores" : "Aún no hay proveedores registrados"}</p><p className="mt-1 text-sm text-slate-400">{search ? "Prueba con otro nombre o documento." : "Completa el formulario superior para agregar el primero."}</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {suppliers.map((supplier) => (
                  <article key={supplier.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-center">
                    <div><div className="flex items-center gap-2"><p className="font-bold">{supplier.trade_name || supplier.business_name}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${supplier.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{supplier.active ? "Activo" : "Inactivo"}</span></div>{supplier.trade_name && <p className="mt-1 text-xs text-slate-400">{supplier.business_name}</p>}<p className="mt-1 text-xs text-slate-400">{supplier.document_type}: {supplier.document_number || "Sin número"}</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Contacto</p><p className="mt-1 text-sm font-semibold">{supplier.contact_name || "Sin contacto"}</p><p className="text-xs text-slate-400">{supplier.phone || "Sin teléfono"}</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Correo</p><p className="mt-1 break-all text-sm font-semibold">{supplier.email || "Sin correo"}</p><p className="truncate text-xs text-slate-400">{supplier.address || "Sin dirección"}</p></div>
                    <div className="flex gap-2 lg:justify-end"><a href={`/proveedores?edit=${supplier.id}${search ? `&q=${encodeURIComponent(search)}` : ""}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Editar</a><form action={toggleSupplierStatus}><input type="hidden" name="supplier_id" value={supplier.id} /><input type="hidden" name="active" value={String(supplier.active)} /><button className={`rounded-lg px-3 py-2 text-xs font-bold ${supplier.active ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{supplier.active ? "Desactivar" : "Activar"}</button></form></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
