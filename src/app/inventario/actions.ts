"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membershipError || !membership) {
    throw new Error("No se encontró el restaurante del usuario.");
  }

  if (!["owner", "manager"].includes(membership.role)) {
    throw new Error("No tienes permiso para registrar productos.");
  }

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const unit = String(formData.get("unit") || "unidad").trim();

  const costPrice = Number(formData.get("cost_price") || 0);
  const salePrice = Number(formData.get("sale_price") || 0);
  const currentStock = Number(formData.get("current_stock") || 0);
  const minimumStock = Number(formData.get("minimum_stock") || 0);

  if (!name) {
    throw new Error("El nombre del producto es obligatorio.");
  }

  if (
    [costPrice, salePrice, currentStock, minimumStock].some(
      (value) => Number.isNaN(value) || value < 0,
    )
  ) {
    throw new Error("Los valores numéricos no son válidos.");
  }

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

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un producto con ese SKU.");
    }

    throw new Error(`No se pudo guardar el producto: ${error.message}`);
  }

  revalidatePath("/inventario");
}