"use client";

import { useEffect } from "react";
import { site } from "@/config/site";
import { mountSecretHold } from "@/lib/acceso-secreto";
import { getAmbient } from "@/lib/audio/ambient";
import { entered } from "@/lib/audio/entry";
import { mountCycle } from "@/lib/ciclo";
import { mountMenuAdmin } from "@/lib/menu-admin";
import type {
  AjustesPrevision,
  MusicaUI,
  Prevision,
} from "@/lib/contenido/tipos";

/**
 * El ciclo de 3:33: la previsión (una foto con la canción final, o un video
 * con su sonido) y el regreso a "entrar". Todo viene del contenido (Supabase
 * o src/config): las previsiones, la canción final, cuánto dura la cuenta
 * regresiva y cuánto se ve una foto.
 * También la acción secreta: mantener presionada la cuenta abre el menú del
 * contador (login, panel, editar, salir).
 */
export default function Ciclo({
  images,
  final,
  prevision,
}: {
  images: readonly Prevision[];
  final: MusicaUI["final"];
  prevision: AjustesPrevision;
}) {
  useEffect(() => {
    const ambient = getAmbient(site.audio);
    const ciclo = {
      ...site.cycle,
      duration: prevision.duracionCiclo,
      hold: prevision.duracionFoto,
      palabras: { ...site.cycle.palabras, fuentes: prevision.fuentes },
    };
    return mountCycle(ciclo, images, entered, () => ambient.stop(), {
      // la canción final se descarga junto con la previsión y suena cuando aparece una foto
      prepare: () => final && void ambient.loadCue(final.src),
      show: () =>
        final && void ambient.playCue(final.src, final.gainDb, final.inicio),
      // los videos: su sonido va aparte, por el mismo motor (respeta "vol")
      decodificar: (data) => ambient.decodificar(data),
      silenciar: () => ambient.silenciar(),
      sonar: (audio, gainDb, offset) =>
        void ambient.sonar("prevision-video", audio, gainDb, offset),
    });
  }, [images, final, prevision]);
  useEffect(() => {
    const menu = mountMenuAdmin(site.admin);
    const quitar = mountSecretHold(site.admin, (cuenta) => menu.abrir(cuenta));
    return () => {
      quitar();
      menu.destroy();
    };
  }, []);
  return null;
}
