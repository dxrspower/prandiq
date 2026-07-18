import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProduct } from "./actions";

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
          <p className="mt-2 text-slate-500">
            Tu usuario todavía no está asociado con un restaurante.
          </p>
        </div>
      </main>
    );
  }

  const [{ data: restaurant }, { data: productsData }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("name")
      .eq("id", membership.restaurant_id)
      .single(),

    supabase
      .from("products")
      .select(
        "id, name, category, sku, unit, cost_price, sale_price, current_stock, minimum_stock, active",
      )
      .eq("restaurant_id", membership.restaurant_id)
      .order("name"),
  ]);

  const products = (productsData || []) as Product[];

  const criticalProducts = products.filter(
    (product) => product.current_stock <= product.minimum_stock,
  );

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <Link
              href="/"
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700"
            >
              ← Volver al resumen
            </Link>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Inventario
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {restaurant?.name || "Mi restaurante"}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 px-5 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
              Stock crítico
            </p>

            <p className="mt-1 text-2xl font-black text-amber-700">
              {criticalProducts.length}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[380px_1fr]">
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Nuevo producto</h2>

          <p className="mt-1 text-sm text-slate-500">
            Registra un ingrediente o producto del restaurante.
          </p>

          <form action={createProduct} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Nombre *
              </span>

              <input
                name="name"
                required
                placeholder="Ej. Carne de res"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Categoría
                </span>

                <input
                  name="category"
                  placeholder="Proteínas"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">SKU</span>

                <input
                  name="sku"
                  placeholder="CAR-001"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 uppercase outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Unidad de medida
              </span>

              <select
                name="unit"
                defaultValue="unidad"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
              >
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo</option>
                <option value="g">Gramo</option>
                <option value="l">Litro</option>
                <option value="ml">Mililitro</option>
                <option value="paquete">Paquete</option>
                <option value="caja">Caja</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Costo
                </span>

                <input
                  name="cost_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Precio de venta
                </span>

                <input
                  name="sale_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Stock actual
                </span>

                <input
                  name="current_stock"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Stock mínimo
                </span>

                <input
                  name="minimum_stock"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              Guardar producto
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-black">Productos</h2>

              <p className="mt-1 text-sm text-slate-500">
                {products.length} productos registrados
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl">▦</div>

              <h3 className="mt-4 text-lg font-bold">
                Todavía no hay productos
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Registra el primer producto utilizando el formulario.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Costo</th>
                    <th className="px-6 py-4">Venta</th>
                    <th className="px-6 py-4">Estado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => {
                    const isCritical =
                      product.current_stock <= product.minimum_stock;

                    return (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-bold">{product.name}</p>

                          <p className="mt-1 text-xs text-slate-400">
                            {product.category || "Sin categoría"}
                            {product.sku ? ` · ${product.sku}` : ""}
                          </p>
                        </td>

                        <td className="px-6 py-4 font-semibold">
                          {product.current_stock} {product.unit}
                        </td>

                        <td className="px-6 py-4 text-slate-600">
                          {formatMoney(product.cost_price)}
                        </td>

                        <td className="px-6 py-4 font-semibold">
                          {formatMoney(product.sale_price)}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              isCritical
                                ? "bg-rose-50 text-rose-600"
                                : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {isCritical ? "Stock bajo" : "Disponible"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}