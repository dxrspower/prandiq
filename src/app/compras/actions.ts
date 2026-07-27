"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MANAGER_ROLES = ["owner", "manager"];

async function getAuthorizedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !membership) {
    throw new Error("No se encontró el restaurante del usuario.");
  }
  if (!MANAGER_ROLES.includes(membership.role)) {
    throw new Error("No tienes permiso para administrar compras.");
  }

  return { supabase, user, membership };
}

function readPositiveNumber(formData: FormData, field: string) {
  const value = Number(formData.get(field));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`El campo ${field} debe ser mayor que cero.`);
  }
  return value;
}

async function assertOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  orderId: string,
  allowedStatuses?: string[],
) {
  const { data: order, error } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !order) throw new Error("No se encontró la orden de compra.");
  if (allowedStatuses && !allowedStatuses.includes(order.status)) {
    throw new Error("La orden ya no permite realizar esta acción.");
  }
  return order;
}

async function recalculateOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  orderId: string,
) {
  const [{ data: order }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("tax_amount, shipping_cost, discount_amount")
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .single(),
    supabase
      .from("purchase_order_items")
      .select("line_total")
      .eq("purchase_order_id", orderId)
      .eq("restaurant_id", restaurantId),
  ]);

  if (!order || itemsError) throw new Error("No se pudo recalcular la orden.");

  const subtotal = (items || []).reduce(
    (sum, item) => sum + Number(item.line_total || 0),
    0,
  );
  const total = Math.max(
    0,
    subtotal +
      Number(order.tax_amount) +
      Number(order.shipping_cost) -
      Number(order.discount_amount),
  );

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      subtotal,
      total_amount: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(`No se pudo actualizar el total: ${error.message}`);
}

export async function createPurchaseOrder(formData: FormData) {
  const { supabase, user, membership } = await getAuthorizedContext();
  const supplierId = String(formData.get("supplier_id") || "");
  const expectedDeliveryDate =
    String(formData.get("expected_delivery_date") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!supplierId) throw new Error("Selecciona un proveedor.");

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", supplierId)
    .eq("restaurant_id", membership.restaurant_id)
    .eq("active", true)
    .single();

  if (!supplier) throw new Error("El proveedor no está disponible.");

  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
  const orderNumber = `OC-${stamp}-${suffix}`;

  const { error } = await supabase.from("purchase_orders").insert({
    restaurant_id: membership.restaurant_id,
    supplier_id: supplierId,
    order_number: orderNumber,
    expected_delivery_date: expectedDeliveryDate,
    notes,
    created_by: user.id,
  });

  if (error) throw new Error(`No se pudo crear la orden: ${error.message}`);
  revalidatePath("/compras");
}

export async function addPurchaseOrderItem(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const orderId = String(formData.get("purchase_order_id") || "");
  const productId = String(formData.get("product_id") || "");
  const quantity = readPositiveNumber(formData, "quantity");
  const unitPrice = Number(formData.get("unit_price"));
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!orderId || !productId) throw new Error("Selecciona la orden y el producto.");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("El precio unitario no es válido.");
  }

  await assertOrder(supabase, membership.restaurant_id, orderId, ["draft"]);

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("restaurant_id", membership.restaurant_id)
    .eq("active", true)
    .single();

  if (!product) throw new Error("El producto no está disponible.");

  const { error } = await supabase.from("purchase_order_items").insert({
    purchase_order_id: orderId,
    restaurant_id: membership.restaurant_id,
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    notes,
  });

  if (error?.code === "23505") {
    throw new Error("Ese producto ya está incluido en la orden.");
  }
  if (error) throw new Error(`No se pudo añadir el producto: ${error.message}`);

  await recalculateOrder(supabase, membership.restaurant_id, orderId);
  revalidatePath("/compras");
}

export async function updatePurchaseOrderItem(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const itemId = String(formData.get("item_id") || "");
  const orderId = String(formData.get("purchase_order_id") || "");
  const quantity = readPositiveNumber(formData, "quantity");
  const unitPrice = Number(formData.get("unit_price"));

  if (!itemId || !orderId) throw new Error("No se indicó el producto de la orden.");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("El precio unitario no es válido.");
  }

  await assertOrder(supabase, membership.restaurant_id, orderId, ["draft"]);
  const { error } = await supabase
    .from("purchase_order_items")
    .update({
      quantity,
      unit_price: unitPrice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("purchase_order_id", orderId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw new Error(`No se pudo editar el producto: ${error.message}`);
  await recalculateOrder(supabase, membership.restaurant_id, orderId);
  revalidatePath("/compras");
}

export async function removePurchaseOrderItem(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const itemId = String(formData.get("item_id") || "");
  const orderId = String(formData.get("purchase_order_id") || "");

  await assertOrder(supabase, membership.restaurant_id, orderId, ["draft"]);
  const { error } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("id", itemId)
    .eq("purchase_order_id", orderId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw new Error(`No se pudo quitar el producto: ${error.message}`);
  await recalculateOrder(supabase, membership.restaurant_id, orderId);
  revalidatePath("/compras");
}

export async function sendPurchaseOrder(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const orderId = String(formData.get("purchase_order_id") || "");
  await assertOrder(supabase, membership.restaurant_id, orderId, ["draft"]);

  const { count } = await supabase
    .from("purchase_order_items")
    .select("id", { count: "exact", head: true })
    .eq("purchase_order_id", orderId)
    .eq("restaurant_id", membership.restaurant_id);

  if (!count) throw new Error("Añade al menos un producto antes de enviar la orden.");

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw new Error(`No se pudo enviar la orden: ${error.message}`);
  revalidatePath("/compras");
}

export async function receivePurchaseOrderItem(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const itemId = String(formData.get("item_id") || "");
  const orderId = String(formData.get("purchase_order_id") || "");
  const quantity = readPositiveNumber(formData, "received_quantity");

  await assertOrder(supabase, membership.restaurant_id, orderId, [
    "sent",
    "partially_received",
  ]);

  const { data: item } = await supabase
    .from("purchase_order_items")
    .select("id")
    .eq("id", itemId)
    .eq("purchase_order_id", orderId)
    .eq("restaurant_id", membership.restaurant_id)
    .single();

  if (!item) throw new Error("El producto no pertenece a esta orden.");

  const { error } = await supabase.rpc("receive_purchase_order_item", {
    p_item_id: itemId,
    p_quantity: quantity,
  });

  if (error) throw new Error(`No se pudo recibir el producto: ${error.message}`);
  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/");
}

export async function cancelPurchaseOrder(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const orderId = String(formData.get("purchase_order_id") || "");
  await assertOrder(supabase, membership.restaurant_id, orderId, ["draft", "sent"]);

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw new Error(`No se pudo cancelar la orden: ${error.message}`);
  revalidatePath("/compras");
}