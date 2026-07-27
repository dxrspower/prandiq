import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProduct, registerMovement, updateProduct } from "./actions";

type Product = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  unit: string;
  cost_price: number;
  sale_price: number;
  current_stock: number;
  minimum_stock: number;
  active: boolean;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
};

const units = ["unidad", "kg", "g", "l", "ml", "paquete", "caja"];

const menuItems = [
  ["Resumen", "⌂", "/"],
  ["Ventas", "↗", "/ventas"],
  ["Inventario", "▦", "/inventario"],
  ["Compras", "◎", "/compras"],
  ["Proveedores", "◇", "/proveedores"],
  ["Facturación", "▤", "/facturacion"],
  ["Reportes", "◫", "/reportes"],
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

const movementLabels: Record<string, string> = {
  entrada: "Entrada",
  purchase: "Compra",
  salida: "Salida",
  perdida: "Pérdida",
  devolucion: "Devolución",
  ajuste: "Ajuste positivo",
};

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold">Restaurante no encontrado</h1>
          <p className="mt-2 text-slate-500">Tu usuario todavía no está asociado con un restaurante.</p>
        </div>
      </main>
    );
  }

  const [{ data: restaurant }, { data: productsData }, { data: movementsData }] =
    await Promise.all([
      supabase.from("restaurants").select("name").eq("id", membership.restaurant_id).single(),
      supabase
        .from("products")
        .select("id, name, category, sku, unit, cost_price, sale_price, current_stock, minimum_stock, active")
        .eq("restaurant_id", membership.restaurant_id)
        .eq("active", true)
        .order("name"),
      supabase
        .from("inventory_movements")
        .select("id, product_id, movement_type, quantity, unit_cost, notes, created_at")
        .eq("restaurant_id", membership.restaurant_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const products = (productsData || []) as Product[];
  const movements = (movementsData || []) as Movement[];
  const productsById = new Map(products.map((product) => [product.id, product]));
  const criticalProducts = products.filter(
    (product) => Number(product.current_stock) <= Number(product.minimum_stock),
  );

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white">
            P
          </div>
          <div>
            <div className="text-xl font-black">
              Plate<span className="text-emerald-600">IQ</span>
            </div>
            <p className="text-xs text-slate-400">Restaurant Intelligence</p>
          </div>
        </div>

        <nav className="mt-9 space-y-1">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Operaciones
          </p>
          {menuItems.map(([label, icon, href]) => {
            const active = href === "/inventario";
            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>
                  {icon}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white">
          <p className="text-xs font-semibold text-emerald-300">Control de inventario</p>
          <p className="mt-2 text-sm font-bold">Gestiona productos, existencias y movimientos.</p>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <Link href="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
              ← Volver al resumen
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Inventario</h1>
            <p className="mt-1 text-sm text-slate-500">{restaurant?.name || "Mi restaurante"}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-5 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Stock crítico</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{criticalProducts.length}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Nuevo producto</h2>
            <p className="mt-1 text-sm text-slate-500">Registra un ingrediente o producto.</p>
            <form action={createProduct} className="mt-6 space-y-4">
              <input name="name" required placeholder="Nombre *" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
              <div className="grid grid-cols-2 gap-3">
                <input name="category" placeholder="Categoría" className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
                <input name="sku" placeholder="SKU" className="rounded-xl border border-slate-200 px-4 py-3 uppercase outline-none focus:border-emerald-500" />
              </div>
              <select name="unit" defaultValue="unidad" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-600">Costo
                  <input name="cost_price" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
                <label className="text-xs font-bold text-slate-600">Precio de venta
                  <input name="sale_price" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
                <label className="text-xs font-bold text-slate-600">Stock actual
                  <input name="current_stock" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
                <label className="text-xs font-bold text-slate-600">Stock mínimo
                  <input name="minimum_stock" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
              </div>
              <button type="submit" className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Guardar producto</button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Registrar movimiento</h2>
            <p className="mt-1 text-sm text-slate-500">Actualiza el stock y guarda el historial.</p>
            {products.length ? (
              <form action={registerMovement} className="mt-5 space-y-3">
                <select name="product_id" required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <option value="">Selecciona un producto</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.current_stock} {product.unit}</option>)}
                </select>
                <select name="movement_type" defaultValue="entrada" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <option value="entrada">Entrada (+)</option>
                  <option value="salida">Salida (-)</option>
                  <option value="perdida">Pérdida (-)</option>
                  <option value="devolucion">Devolución (+)</option>
                  <option value="ajuste">Ajuste positivo (+)</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input name="quantity" type="number" required min="0.001" step="0.001" placeholder="Cantidad" className="rounded-xl border border-slate-200 px-4 py-3" />
                  <input name="unit_cost" type="number" min="0" step="0.01" placeholder="Costo unitario" className="rounded-xl border border-slate-200 px-4 py-3" />
                </div>
                <textarea name="notes" rows={2} placeholder="Nota opcional" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3" />
                <button type="submit" className="w-full rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800">Registrar movimiento</button>
              </form>
            ) : <p className="mt-4 text-sm text-slate-500">Primero registra un producto.</p>}
          </section>
        </div>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-black">Productos</h2>
              <p className="mt-1 text-sm text-slate-500">{products.length} productos registrados</p>
            </div>
            {products.length === 0 ? (
              <div className="p-12 text-center text-slate-500">Todavía no hay productos.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {products.map((product) => {
                  const isCritical = Number(product.current_stock) <= Number(product.minimum_stock);
                  return (
                    <details key={product.id} className="group p-5 open:bg-slate-50">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                        <div>
                          <p className="font-bold">{product.name}</p>
                          <p className="mt-1 text-xs text-slate-400">{product.category || "Sin categoría"}{product.sku ? ` · ${product.sku}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div><p className="font-black">{product.current_stock} {product.unit}</p><p className="text-xs text-slate-400">{formatMoney(product.cost_price)}</p></div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isCritical ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{isCritical ? "Stock bajo" : "Disponible"}</span>
                        </div>
                      </summary>
                      <form action={updateProduct} className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
                        <input type="hidden" name="product_id" value={product.id} />
                        <label className="text-xs font-bold text-slate-600">Nombre<input name="name" required defaultValue={product.name} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
                        <label className="text-xs font-bold text-slate-600">Categoría<input name="category" defaultValue={product.category || ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
                        <label className="text-xs font-bold text-slate-600">SKU<input name="sku" defaultValue={product.sku || ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 uppercase" /></label>
                        <label className="text-xs font-bold text-slate-600">Unidad<select name="unit" defaultValue={product.unit} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                        <label className="text-xs font-bold text-slate-600">Costo<input name="cost_price" type="number" min="0" step="0.01" defaultValue={product.cost_price} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
                        <label className="text-xs font-bold text-slate-600">Precio de venta<input name="sale_price" type="number" min="0" step="0.01" defaultValue={product.sale_price} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
                        <label className="text-xs font-bold text-slate-600">Stock mínimo<input name="minimum_stock" type="number" min="0" step="0.001" defaultValue={product.minimum_stock} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
                        <button type="submit" className="self-end rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700">Guardar cambios</button>
                      </form>
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-black">Historial reciente</h2>
              <p className="mt-1 text-sm text-slate-500">Últimos 20 movimientos de inventario</p>
            </div>
            {movements.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Aún no hay movimientos registrados.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Producto</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Cantidad</th><th className="px-5 py-3">Nota</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((movement) => {
                      const product = productsById.get(movement.product_id);
                      const addsStock = ["entrada", "purchase", "devolucion", "ajuste"].includes(movement.movement_type);
                      return <tr key={movement.id}><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatDate(movement.created_at)}</td><td className="px-5 py-4 font-bold">{product?.name || "Producto"}</td><td className="px-5 py-4">{movementLabels[movement.movement_type] || movement.movement_type}</td><td className={`px-5 py-4 font-black ${addsStock ? "text-emerald-600" : "text-rose-600"}`}>{addsStock ? "+" : "−"}{movement.quantity} {product?.unit || ""}</td><td className="max-w-[220px] truncate px-5 py-4 text-slate-500">{movement.notes || "—"}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
      </div>
    </main>
  );
}