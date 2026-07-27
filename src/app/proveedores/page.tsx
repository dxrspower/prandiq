import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createSupplier,
  createSupplierProduct,
  toggleSupplierProductStatus,
  toggleSupplierStatus,
  updateSupplier,
  updateSupplierProduct,
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
  id: string; business_name: string; trade_name: string | null;
  document_type: string; document_number: string | null;
  contact_name: string | null; phone: string | null; email: string | null;
  address: string | null; notes: string | null; active: boolean;
};
type Product = { id: string; name: string; unit: string; active: boolean };
type Relation = {
  id: string; supplier_id: string; product_id: string;
  supplier_product_code: string | null; purchase_price: number;
  minimum_order_quantity: number; lead_time_days: number;
  preferred: boolean; active: boolean; notes: string | null;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50";

function SupplierFields({ supplier }: { supplier?: Supplier }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-bold text-slate-500">Razón social *<input name="business_name" required defaultValue={supplier?.business_name} className={inputClass} placeholder="Distribuidora Lima S.A.C." /></label>
      <label className="text-xs font-bold text-slate-500">Nombre comercial<input name="trade_name" defaultValue={supplier?.trade_name || ""} className={inputClass} placeholder="Distribuidora Lima" /></label>
      <label className="text-xs font-bold text-slate-500">Tipo de documento<select name="document_type" defaultValue={supplier?.document_type || "RUC"} className={inputClass}><option>RUC</option><option>DNI</option><option>CE</option><option>OTRO</option></select></label>
      <label className="text-xs font-bold text-slate-500">Número de documento<input name="document_number" defaultValue={supplier?.document_number || ""} className={inputClass} placeholder="20123456789" /></label>
      <label className="text-xs font-bold text-slate-500">Persona de contacto<input name="contact_name" defaultValue={supplier?.contact_name || ""} className={inputClass} placeholder="María Pérez" /></label>
      <label className="text-xs font-bold text-slate-500">Teléfono<input name="phone" type="tel" defaultValue={supplier?.phone || ""} className={inputClass} placeholder="987 654 321" /></label>
      <label className="text-xs font-bold text-slate-500">Correo<input name="email" type="email" defaultValue={supplier?.email || ""} className={inputClass} placeholder="ventas@proveedor.pe" /></label>
      <label className="text-xs font-bold text-slate-500">Dirección<input name="address" defaultValue={supplier?.address || ""} className={inputClass} placeholder="Av. Principal 123" /></label>
      <label className="text-xs font-bold text-slate-500 md:col-span-2 xl:col-span-4">Notas<textarea name="notes" defaultValue={supplier?.notes || ""} className={`${inputClass} min-h-20 resize-y`} /></label>
    </div>
  );
}

function RelationFields({
  suppliers, products, relation,
}: { suppliers: Supplier[]; products: Product[]; relation?: Relation }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-bold text-slate-500">Proveedor *<select name="supplier_id" required defaultValue={relation?.supplier_id || ""} className={inputClass}><option value="" disabled>Selecciona un proveedor</option>{suppliers.filter(s => s.active || s.id === relation?.supplier_id).map(s => <option key={s.id} value={s.id}>{s.trade_name || s.business_name}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-500">Producto *<select name="product_id" required defaultValue={relation?.product_id || ""} className={inputClass}><option value="" disabled>Selecciona un producto</option>{products.filter(p => p.active || p.id === relation?.product_id).map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select></label>
      <label className="text-xs font-bold text-slate-500">Código del proveedor<input name="supplier_product_code" defaultValue={relation?.supplier_product_code || ""} className={inputClass} placeholder="COD-001" /></label>
      <label className="text-xs font-bold text-slate-500">Precio de compra (S/) *<input name="purchase_price" type="number" min="0" step="0.01" required defaultValue={relation?.purchase_price ?? 0} className={inputClass} /></label>
      <label className="text-xs font-bold text-slate-500">Cantidad mínima *<input name="minimum_order_quantity" type="number" min="0.001" step="0.001" required defaultValue={relation?.minimum_order_quantity ?? 1} className={inputClass} /></label>
      <label className="text-xs font-bold text-slate-500">Días de entrega<input name="lead_time_days" type="number" min="0" step="1" required defaultValue={relation?.lead_time_days ?? 0} className={inputClass} /></label>
      <label className="flex items-center gap-3 pt-7 text-sm font-bold text-slate-600"><input name="preferred" type="checkbox" defaultChecked={relation?.preferred} className="h-4 w-4 accent-emerald-600" />Proveedor preferido</label>
      <label className="text-xs font-bold text-slate-500">Notas<input name="relation_notes" defaultValue={relation?.notes || ""} className={inputClass} placeholder="Condiciones de compra" /></label>
    </div>
  );
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string; editRelation?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("restaurant_members").select("restaurant_id").eq("user_id", user.id).limit(1).single();
  if (!membership) redirect("/");

  let supplierQuery = supabase.from("suppliers").select("id, business_name, trade_name, document_type, document_number, contact_name, phone, email, address, notes, active").eq("restaurant_id", membership.restaurant_id).order("active", { ascending: false }).order("business_name");
  const search = (params.q || "").trim();
  if (search) {
    const safeSearch = search.replace(/[%_,()]/g, " ");
    supplierQuery = supplierQuery.or(`business_name.ilike.%${safeSearch}%,trade_name.ilike.%${safeSearch}%,document_number.ilike.%${safeSearch}%`);
  }

  const [{ data: supplierData }, { data: productData }, { data: relationData }] = await Promise.all([
    supplierQuery,
    supabase.from("products").select("id, name, unit, active").eq("restaurant_id", membership.restaurant_id).order("name"),
    supabase.from("supplier_products").select("id, supplier_id, product_id, supplier_product_code, purchase_price, minimum_order_quantity, lead_time_days, preferred, active, notes").eq("restaurant_id", membership.restaurant_id).order("active", { ascending: false }).order("preferred", { ascending: false }),
  ]);

  const suppliers = (supplierData || []) as Supplier[];
  const products = (productData || []) as Product[];
  const relations = (relationData || []) as Relation[];
  const editingSupplier = suppliers.find(s => s.id === params.edit);
  const editingRelation = relations.find(r => r.id === params.editRelation);
  const activeCount = suppliers.filter(s => s.active).length;
  const supplierById = new Map(suppliers.map(s => [s.id, s]));
  const productById = new Map(products.map(p => [p.id, p]));

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white">P</div><div><div className="text-xl font-black">Plate<span className="text-emerald-600">IQ</span></div><p className="text-xs text-slate-400">Restaurant Intelligence</p></div></div>
        <nav className="mt-9 space-y-1"><p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Operaciones</p>{menuItems.map(([label, icon, href]) => <a key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${label === "Proveedores" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}><span className={`grid h-7 w-7 place-items-center rounded-lg ${label === "Proveedores" ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>{icon}</span>{label}</a>)}</nav>
        <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white"><p className="text-xs font-semibold text-emerald-300">Gestión de compras</p><p className="mt-2 text-sm font-bold">Relaciona productos con sus proveedores.</p></div>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur md:px-8"><div><a href="/" className="text-xs font-bold text-emerald-600">← Volver al resumen</a><h1 className="mt-1 text-xl font-extrabold md:text-2xl">Proveedores</h1></div><LogoutButton initials="DR" /></header>
        <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
          <section className="grid gap-4 sm:grid-cols-4">
            {[["Proveedores registrados", suppliers.length, ""], ["Proveedores activos", activeCount, "text-emerald-600"], ["Inactivos", suppliers.length - activeCount, "text-slate-400"], ["Productos vinculados", relations.filter(r => r.active).length, "text-blue-600"]].map(([label, value, color]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className={`mt-3 text-3xl font-black ${color}`}>{value}</p></article>)}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="mb-5"><h2 className="text-lg font-black">Registrar proveedor</h2><p className="mt-1 text-sm text-slate-400">Agrega los datos comerciales y de contacto.</p></div><form action={createSupplier} className="space-y-5"><SupplierFields /><div className="flex justify-end"><button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">+ Guardar proveedor</button></div></form></section>

          {editingSupplier && <section className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm md:p-6"><div className="mb-5 flex justify-between"><div><h2 className="text-lg font-black">Editar proveedor</h2><p className="text-sm text-slate-400">{editingSupplier.business_name}</p></div><a href="/proveedores" className="text-sm font-bold text-slate-400">Cerrar ×</a></div><form action={updateSupplier} className="space-y-5"><input type="hidden" name="supplier_id" value={editingSupplier.id} /><SupplierFields supplier={editingSupplier} /><div className="flex justify-end"><button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Guardar cambios</button></div></form></section>}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="mb-5"><h2 className="text-lg font-black">Asignar producto a proveedor</h2><p className="mt-1 text-sm text-slate-400">Registra precio, pedido mínimo y tiempo de entrega.</p></div>{suppliers.some(s => s.active) && products.some(p => p.active) ? <form action={createSupplierProduct} className="space-y-5"><RelationFields suppliers={suppliers} products={products} /><div className="flex justify-end"><button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">+ Vincular producto</button></div></form> : <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-700">Necesitas al menos un proveedor activo y un producto activo.</p>}</section>

          {editingRelation && <section className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-sm md:p-6"><div className="mb-5 flex justify-between"><div><h2 className="text-lg font-black">Editar producto vinculado</h2><p className="text-sm text-slate-400">Actualiza las condiciones de compra.</p></div><a href="/proveedores" className="text-sm font-bold text-slate-400">Cerrar ×</a></div><form action={updateSupplierProduct} className="space-y-5"><input type="hidden" name="relation_id" value={editingRelation.id} /><RelationFields suppliers={suppliers} products={products} relation={editingRelation} /><div className="flex justify-end"><button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Guardar relación</button></div></form></section>}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-black">Productos por proveedor</h2><p className="mt-1 text-sm text-slate-400">Condiciones actuales de abastecimiento.</p></div>{relations.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-400">Aún no hay productos vinculados.</div> : <div className="divide-y divide-slate-100">{relations.map(r => { const supplier = supplierById.get(r.supplier_id); const product = productById.get(r.product_id); return <article key={r.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{product?.name || "Producto"}</p>{r.preferred && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">Preferido</span>}<span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${r.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{r.active ? "Activo" : "Inactivo"}</span></div><p className="mt-1 text-xs text-slate-400">{supplier?.trade_name || supplier?.business_name || "Proveedor"} · {r.supplier_product_code || "Sin código"}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Compra</p><p className="mt-1 font-bold">S/ {Number(r.purchase_price).toFixed(2)}</p><p className="text-xs text-slate-400">Mínimo: {r.minimum_order_quantity} {product?.unit}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Entrega</p><p className="mt-1 text-sm font-semibold">{r.lead_time_days} día{r.lead_time_days === 1 ? "" : "s"}</p><p className="text-xs text-slate-400">{r.notes || "Sin observaciones"}</p></div><div className="flex gap-2"><a href={`/proveedores?editRelation=${r.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Editar</a><form action={toggleSupplierProductStatus}><input type="hidden" name="relation_id" value={r.id} /><input type="hidden" name="active" value={String(r.active)} /><button className={`rounded-lg px-3 py-2 text-xs font-bold ${r.active ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{r.active ? "Desactivar" : "Activar"}</button></form></div></article>; })}</div>}</section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Lista de proveedores</h2><p className="mt-1 text-sm text-slate-400">Consulta, edita y controla su estado.</p></div><form className="flex gap-2"><input name="q" defaultValue={search} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm sm:w-72" placeholder="Buscar por nombre o documento" /><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Buscar</button></form></div>{suppliers.length === 0 ? <div className="px-5 py-14 text-center text-sm text-slate-400">No se encontraron proveedores.</div> : <div className="divide-y divide-slate-100">{suppliers.map(s => <article key={s.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-center"><div><div className="flex items-center gap-2"><p className="font-bold">{s.trade_name || s.business_name}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${s.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{s.active ? "Activo" : "Inactivo"}</span></div>{s.trade_name && <p className="mt-1 text-xs text-slate-400">{s.business_name}</p>}<p className="text-xs text-slate-400">{s.document_type}: {s.document_number || "Sin número"}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Contacto</p><p className="mt-1 text-sm font-semibold">{s.contact_name || "Sin contacto"}</p><p className="text-xs text-slate-400">{s.phone || "Sin teléfono"}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Correo</p><p className="mt-1 break-all text-sm font-semibold">{s.email || "Sin correo"}</p><p className="truncate text-xs text-slate-400">{s.address || "Sin dirección"}</p></div><div className="flex gap-2"><a href={`/proveedores?edit=${s.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Editar</a><form action={toggleSupplierStatus}><input type="hidden" name="supplier_id" value={s.id} /><input type="hidden" name="active" value={String(s.active)} /><button className={`rounded-lg px-3 py-2 text-xs font-bold ${s.active ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{s.active ? "Desactivar" : "Activar"}</button></form></div></article>)}</div>}</section>
        </div>
      </section>
    </main>
  );
}