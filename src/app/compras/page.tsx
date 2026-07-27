import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addPurchaseOrderItem,
  cancelPurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrderItem,
  removePurchaseOrderItem,
  sendPurchaseOrder,
  updatePurchaseOrderItem,
} from "./actions";

type Supplier = { id: string; business_name: string; trade_name: string | null };
type Product = { id: string; name: string; unit: string };
type SupplierProduct = {
  supplier_id: string;
  product_id: string;
  purchase_price: number;
  minimum_order_quantity: number;
  preferred: boolean;
};
type Order = {
  id: string;
  supplier_id: string;
  order_number: string;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  subtotal: number;
  total_amount: number;
  notes: string | null;
};
type Item = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  line_total: number;
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  partially_received: "Recepción parcial",
  received: "Recibida",
  cancelled: "Cancelada",
};

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  partially_received: "bg-amber-50 text-amber-700",
  received: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "America/Lima",
  }).format(new Date(`${value}T12:00:00`));
}

export default async function PurchasesPage() {
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
    return <main className="grid min-h-screen place-items-center">Restaurante no encontrado.</main>;
  }

  const [
    { data: restaurant },
    { data: suppliersData },
    { data: productsData },
    { data: linksData },
    { data: ordersData },
    { data: itemsData },
  ] = await Promise.all([
    supabase.from("restaurants").select("name").eq("id", membership.restaurant_id).single(),
    supabase
      .from("suppliers")
      .select("id, business_name, trade_name")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("active", true)
      .order("business_name"),
    supabase
      .from("products")
      .select("id, name, unit")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("supplier_products")
      .select("supplier_id, product_id, purchase_price, minimum_order_quantity, preferred")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("active", true),
    supabase
      .from("purchase_orders")
      .select("id, supplier_id, order_number, status, order_date, expected_delivery_date, subtotal, total_amount, notes")
      .eq("restaurant_id", membership.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("purchase_order_items")
      .select("id, purchase_order_id, product_id, quantity, received_quantity, unit_price, line_total")
      .eq("restaurant_id", membership.restaurant_id)
      .order("created_at"),
  ]);

  const suppliers = (suppliersData || []) as Supplier[];
  const products = (productsData || []) as Product[];
  const links = (linksData || []) as SupplierProduct[];
  const orders = (ordersData || []) as Order[];
  const items = (itemsData || []) as Item[];
  const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const openOrders = orders.filter((order) =>
    ["draft", "sent", "partially_received"].includes(order.status),
  ).length;

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <Link href="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
              ← Volver al resumen
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Compras</h1>
            <p className="mt-1 text-sm text-slate-500">{restaurant?.name || "Mi restaurante"}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-5 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Órdenes abiertas</p>
            <p className="mt-1 text-2xl font-black text-blue-700">{openOrders}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[360px_1fr]">
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Nueva orden</h2>
          <p className="mt-1 text-sm text-slate-500">Crea un borrador para comenzar el pedido.</p>
          {suppliers.length ? (
            <form action={createPurchaseOrder} className="mt-6 space-y-4">
              <label className="block text-xs font-bold text-slate-600">
                Proveedor
                <select name="supplier_id" required defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <option value="" disabled>Selecciona un proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.trade_name || supplier.business_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Entrega esperada
                <input name="expected_delivery_date" type="date" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" />
              </label>
              <textarea name="notes" rows={3} placeholder="Notas opcionales" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3" />
              <button className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">
                Crear borrador
              </button>
            </form>
          ) : (
            <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              Primero registra un proveedor activo.
            </p>
          )}
        </section>

        <section className="space-y-5">
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              Todavía no hay órdenes de compra.
            </div>
          ) : (
            orders.map((order) => {
              const supplier = suppliersById.get(order.supplier_id);
              const orderItems = items.filter((item) => item.purchase_order_id === order.id);
              const linkedProducts = links.filter((link) => link.supplier_id === order.supplier_id);
              const canEdit = order.status === "draft";
              const canReceive = ["sent", "partially_received"].includes(order.status);

              return (
                <details key={order.id} open={orders[0]?.id === order.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-6">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black">{order.order_number}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[order.status]}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {supplier?.trade_name || supplier?.business_name || "Proveedor"} · {formatDate(order.order_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black">{formatMoney(order.total_amount)}</p>
                      <p className="text-xs text-slate-400">{orderItems.length} productos</p>
                    </div>
                  </summary>

                  <div className="border-t border-slate-200 p-6">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <p className="text-slate-500">
                        Entrega: <strong className="text-slate-700">{formatDate(order.expected_delivery_date)}</strong>
                      </p>
                      <p>Subtotal: <strong>{formatMoney(order.subtotal)}</strong></p>
                    </div>

                    {canEdit && (
                      <form action={addPurchaseOrderItem} className="mb-6 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_120px_130px_auto]">
                        <input type="hidden" name="purchase_order_id" value={order.id} />
                        <select name="product_id" required defaultValue="" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <option value="" disabled>Selecciona producto</option>
                          {linkedProducts.map((link) => {
                            const product = productsById.get(link.product_id);
                            return product ? (
                              <option key={link.product_id} value={link.product_id}>
                                {product.name} · S/ {Number(link.purchase_price).toFixed(2)}
                              </option>
                            ) : null;
                          })}
                        </select>
                        <input name="quantity" type="number" min="0.001" step="0.001" required placeholder="Cantidad" className="rounded-xl border border-slate-200 px-3 py-2.5" />
                        <input name="unit_price" type="number" min="0" step="0.01" required placeholder="Precio S/" className="rounded-xl border border-slate-200 px-3 py-2.5" />
                        <button className="rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white hover:bg-slate-800">Añadir</button>
                      </form>
                    )}

                    {canEdit && linkedProducts.length === 0 && (
                      <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                        Este proveedor todavía no tiene productos vinculados.
                      </p>
                    )}

                    <div className="space-y-3">
                      {orderItems.length === 0 ? (
                        <p className="py-5 text-center text-sm text-slate-500">Añade productos a este borrador.</p>
                      ) : (
                        orderItems.map((item) => {
                          const product = productsById.get(item.product_id);
                          const pending = Number(item.quantity) - Number(item.received_quantity);
                          return (
                            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-bold">{product?.name || "Producto"}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Recibido: {item.received_quantity} de {item.quantity} {product?.unit || ""}
                                  </p>
                                </div>
                                <p className="font-black">{formatMoney(item.line_total)}</p>
                              </div>

                              {canEdit && (
                                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                                  <form action={updatePurchaseOrderItem} className="flex flex-1 flex-wrap gap-2">
                                    <input type="hidden" name="item_id" value={item.id} />
                                    <input type="hidden" name="purchase_order_id" value={order.id} />
                                    <input name="quantity" type="number" min="0.001" step="0.001" defaultValue={item.quantity} className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                                    <input name="unit_price" type="number" min="0" step="0.01" defaultValue={item.unit_price} className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                                    <button className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Guardar</button>
                                  </form>
                                  <form action={removePurchaseOrderItem}>
                                    <input type="hidden" name="item_id" value={item.id} />
                                    <input type="hidden" name="purchase_order_id" value={order.id} />
                                    <button className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">Quitar</button>
                                  </form>
                                </div>
                              )}

                              {canReceive && pending > 0 && (
                                <form action={receivePurchaseOrderItem} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                                  <input type="hidden" name="item_id" value={item.id} />
                                  <input type="hidden" name="purchase_order_id" value={order.id} />
                                  <input name="received_quantity" type="number" min="0.001" max={pending} step="0.001" defaultValue={pending} className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                                  <span className="text-xs text-slate-500">Máximo pendiente: {pending} {product?.unit || ""}</span>
                                  <button className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Confirmar recepción</button>
                                </form>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                      {canEdit && (
                        <form action={sendPurchaseOrder}>
                          <input type="hidden" name="purchase_order_id" value={order.id} />
                          <button className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-700">Marcar como enviada</button>
                        </form>
                      )}
                      {["draft", "sent"].includes(order.status) && (
                        <form action={cancelPurchaseOrder}>
                          <input type="hidden" name="purchase_order_id" value={order.id} />
                          <button className="rounded-xl bg-rose-50 px-5 py-2.5 font-bold text-rose-700 hover:bg-rose-100">Cancelar orden</button>
                        </form>
                      )}
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
