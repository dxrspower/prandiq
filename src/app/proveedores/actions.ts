"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MANAGER_ROLES = ["owner", "manager"];
const DOCUMENT_TYPES = ["RUC", "DNI", "CE", "OTRO"];

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
    throw new Error("No tienes permiso para modificar proveedores.");
  }

  return { supabase, membership };
}

function readNonNegativeNumber(formData: FormData, field: string) {
  const value = Number(formData.get(field));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`El campo ${field} contiene un valor no válido.`);
  }
  return value;
}

function readSupplier(formData: FormData) {
  const businessName = String(formData.get("business_name") || "").trim();
  const documentType = String(formData.get("document_type") || "RUC");
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!businessName) throw new Error("La razón social es obligatoria.");
  if (!DOCUMENT_TYPES.includes(documentType)) {
    throw new Error("El tipo de documento no es válido.");
  }

  return {
    business_name: businessName,
    trade_name: String(formData.get("trade_name") || "").trim() || null,
    document_type: documentType,
    document_number:
      String(formData.get("document_number") || "").trim() || null,
    contact_name: String(formData.get("contact_name") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    email: email || null,
    address: String(formData.get("address") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

function handleSupplierError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "23505") {
    throw new Error("Ya existe un proveedor con ese número de documento.");
  }
  throw new Error(`No se pudo guardar el proveedor: ${error.message}`);
}

export async function createSupplier(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const { error } = await supabase.from("suppliers").insert({
    restaurant_id: membership.restaurant_id,
    ...readSupplier(formData),
  });

  handleSupplierError(error);
  revalidatePath("/proveedores");
}

export async function updateSupplier(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const supplierId = String(formData.get("supplier_id") || "");
  if (!supplierId) throw new Error("No se indicó el proveedor que se editará.");

  const { error } = await supabase
    .from("suppliers")
    .update({ ...readSupplier(formData), updated_at: new Date().toISOString() })
    .eq("id", supplierId)
    .eq("restaurant_id", membership.restaurant_id);

  handleSupplierError(error);
  revalidatePath("/proveedores");
}

export async function toggleSupplierStatus(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const supplierId = String(formData.get("supplier_id") || "");
  const active = String(formData.get("active")) === "true";
  if (!supplierId) throw new Error("No se indicó el proveedor.");

  const { error } = await supabase
    .from("suppliers")
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("id", supplierId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  revalidatePath("/proveedores");
}

function readSupplierProduct(formData: FormData) {
  const supplierId = String(formData.get("supplier_id") || "");
  const productId = String(formData.get("product_id") || "");
  const minimumOrderQuantity = readNonNegativeNumber(
    formData,
    "minimum_order_quantity",
  );

  if (!supplierId || !productId) {
    throw new Error("Selecciona un proveedor y un producto.");
  }
  if (minimumOrderQuantity <= 0) {
    throw new Error("La cantidad mínima debe ser mayor que cero.");
  }

  return {
    supplierId,
    productId,
    values: {
      supplier_product_code:
        String(formData.get("supplier_product_code") || "").trim() || null,
      purchase_price: readNonNegativeNumber(formData, "purchase_price"),
      minimum_order_quantity: minimumOrderQuantity,
      lead_time_days: readNonNegativeNumber(formData, "lead_time_days"),
      preferred: formData.get("preferred") === "on",
      notes: String(formData.get("relation_notes") || "").trim() || null,
    },
  };
}

async function verifySupplierAndProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  supplierId: string,
  productId: string,
) {
  const [{ data: supplier }, { data: product }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id")
      .eq("id", supplierId)
      .eq("restaurant_id", restaurantId)
      .single(),
    supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("restaurant_id", restaurantId)
      .single(),
  ]);

  if (!supplier || !product) {
    throw new Error("El proveedor o producto no pertenece a tu restaurante.");
  }
}

async function clearPreferredSupplier(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  productId: string,
  exceptId?: string,
) {
  let query = supabase
    .from("supplier_products")
    .update({ preferred: false, updated_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId)
    .eq("product_id", productId)
    .eq("preferred", true);

  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) {
    throw new Error(`No se pudo actualizar el proveedor preferido: ${error.message}`);
  }
}

export async function createSupplierProduct(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const relation = readSupplierProduct(formData);

  await verifySupplierAndProduct(
    supabase,
    membership.restaurant_id,
    relation.supplierId,
    relation.productId,
  );

  if (relation.values.preferred) {
    await clearPreferredSupplier(
      supabase,
      membership.restaurant_id,
      relation.productId,
    );
  }

  const { error } = await supabase.from("supplier_products").insert({
    restaurant_id: membership.restaurant_id,
    supplier_id: relation.supplierId,
    product_id: relation.productId,
    ...relation.values,
  });

  if (error?.code === "23505") {
    throw new Error("Ese producto ya está vinculado con el proveedor.");
  }
  if (error) throw new Error(`No se pudo crear la relación: ${error.message}`);
  revalidatePath("/proveedores");
}

export async function updateSupplierProduct(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const relationId = String(formData.get("relation_id") || "");
  const relation = readSupplierProduct(formData);
  if (!relationId) throw new Error("No se indicó la relación que se editará.");

  await verifySupplierAndProduct(
    supabase,
    membership.restaurant_id,
    relation.supplierId,
    relation.productId,
  );

  if (relation.values.preferred) {
    await clearPreferredSupplier(
      supabase,
      membership.restaurant_id,
      relation.productId,
      relationId,
    );
  }

  const { error } = await supabase
    .from("supplier_products")
    .update({
      supplier_id: relation.supplierId,
      product_id: relation.productId,
      ...relation.values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", relationId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error?.code === "23505") {
    throw new Error("Ese producto ya está vinculado con el proveedor.");
  }
  if (error) throw new Error(`No se pudo actualizar la relación: ${error.message}`);
  revalidatePath("/proveedores");
}

export async function toggleSupplierProductStatus(formData: FormData) {
  const { supabase, membership } = await getAuthorizedContext();
  const relationId = String(formData.get("relation_id") || "");
  const active = String(formData.get("active")) === "true";
  if (!relationId) throw new Error("No se indicó la relación.");

  const { error } = await supabase
    .from("supplier_products")
    .update({
      active: !active,
      preferred: active ? false : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", relationId)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  revalidatePath("/proveedores");
}