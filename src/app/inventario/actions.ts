"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MANAGER_ROLES = ["owner", "manager"];
const MOVEMENT_TYPES = [
  "entrada",
  "salida",
  "perdida",
  "devolucion",
  "ajuste",
] as const;

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
    throw new Error("No tienes permiso para modificar el inventario.");
  }

  return { supabase, membership };
}

function readNumber(formData: FormData, field: string) {
  const value = Number(formData.get(field));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`El campo ${field} contiene un valor no válido.`);
  }
  return value;
}

export async function createProduct(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const sku = String(formData.get("sku") || "").trim().toUpperCase();
  const unit = String(formData.get("unit") || "unidad").trim();
  const costPrice = readNumber(formData, "cost_price");
  const salePrice = readNumber(formData, "sale_price");
  const currentStock = readNumber(formData, "current_stock");
  const minimumStock = readNumber(formData, "minimum_stock");

  if (!name) throw new Error("El nombre del producto es obligatorio.");

  const { error } = await supabase.from("products").insert({
    restaurant_id: membership.restaurant_id,
    name,
    category: category || null,
    sku: sku || null,
    unit,
    cost_price: costPrice,
    sale_price: salePrice,
    current_stock: currentStock,
    minimum_stock: minimumStock,
  });

  if (error?.code === "23505") {
    throw new Error("Ya existe un producto con ese SKU.");
  }
  if (error) throw new Error(`No se pudo guardar el producto: ${error.message}`);

  revalidatePath("/inventario");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const productId = String(formData.get("product_id") || "");
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const sku = String(formData.get("sku") || "").trim().toUpperCase();
  const unit = String(formData.get("unit") || "unidad").trim();

  if (!productId || !name) {
    throw new Error("El producto y su nombre son obligatorios.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      name,
      category: category || null,
      sku: sku || null,
      unit,
      cost_price: readNumber(formData, "cost_price"),
      sale_price: readNumber(formData, "sale_price"),
      minimum_stock: readNumber(formData, "minimum_stock"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error?.code === "23505") {
    throw new Error("Ya existe otro producto con ese SKU.");
  }
  if (error) throw new Error(`No se pudo actualizar: ${error.message}`);

  revalidatePath("/inventario");
  revalidatePath("/");
}

export async function registerMovement(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const productId = String(formData.get("product_id") || "");
  const movementType = String(formData.get("movement_type") || "");
  const quantity = readNumber(formData, "quantity");
  const rawUnitCost = String(formData.get("unit_cost") || "").trim();
  const unitCost = rawUnitCost === "" ? null : Number(rawUnitCost);
  const notes = String(formData.get("notes") || "").trim();

  if (!productId) throw new Error("Selecciona un producto.");
  if (!MOVEMENT_TYPES.includes(movementType as (typeof MOVEMENT_TYPES)[number])) {
    throw new Error("El tipo de movimiento no es válido.");
  }
  if (quantity <= 0) throw new Error("La cantidad debe ser mayor que cero.");
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
    throw new Error("El costo unitario no es válido.");
  }

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("restaurant_id", membership.restaurant_id)
    .single();

  if (!product) throw new Error("El producto no pertenece a tu restaurante.");

  const { error } = await supabase.rpc("register_inventory_movement", {
    p_product_id: productId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_unit_cost: unitCost,
    p_notes: notes || null,
  });

  if (error) throw new Error(`No se pudo registrar el movimiento: ${error.message}`);

  revalidatePath("/inventario");
  revalidatePath("/");
}