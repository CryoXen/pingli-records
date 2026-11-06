/**
 * Entrada de la vista previa: monta la misma portada que usa Next.js,
 * pero empaquetada en un solo HTML para publicarla como artefacto.
 * No se usa en el sitio real.
 */
import { createRoot } from "react-dom/client";
import InfiniteCanvas from "../src/components/InfiniteCanvas";
import "../src/app/fonts.css";
import "../src/app/globals.css";

const el = document.getElementById("root");
if (el) createRoot(el).render(<InfiniteCanvas />);
