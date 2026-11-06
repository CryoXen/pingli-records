import type { Metadata } from "next";
import AdminSitio from "@/components/admin/AdminSitio";
import "./admin.css";

export const metadata: Metadata = {
  title: "admin",
  robots: { index: false, follow: false },
};

/** /admin: pide usuario y contraseña (Supabase) y deja editar frases, lanzamientos y previsiones. */
export default function AdminPage() {
  return <AdminSitio />;
}
