import type { Metadata, Viewport } from "next";
import { bootScript } from "@/lib/side";
import "./fonts.css";
import "./globals.css";
import "./audio.css";
import "./panel.css";
import "./phrases.css";
import "./ciclo.css";
import "./muro.css";
import "./zona.css";

export const metadata: Metadata = {
  title: "pingli records",
  description: "Sello discográfico: ambient, noise, drone, industrial, electrónica, idm.",
};

// el pellizco sobre el lienzo lo maneja el motor (touch-action: none en .stage)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
