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
  const supplier = readSupplier(formData);

  const { error } = await supabase.from("suppliers").insert({
    restaurant_id: membership.restaurant_id,
    ...supplier,
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
