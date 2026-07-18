"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LogoutButtonProps = {
  initials: string;
};

export function LogoutButton({ initials }: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
      onClick={handleLogout}
      disabled={isLoading}
      className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white transition hover:bg-rose-600 disabled:cursor-wait disabled:opacity-60"
    >
      {isLoading ? "…" : initials}
    </button>
  );
}
