"use client";

import { supabaseStore } from "@/lib/admin/store-supabase";
import Admin from "./Admin";

/** El admin del sitio, contra Supabase. */
export default function AdminSitio() {
  return <Admin store={supabaseStore} />;
}
