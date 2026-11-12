import Portada from "@/components/Portada";
import { cifrar } from "@/lib/cifrado";
import { getContenido } from "@/lib/contenido/servidor";

export const revalidate = 300;

export default async function Home() {
  const contenido = await getContenido();
  const blob = cifrar(JSON.stringify(contenido));
  return <Portada blob={blob} />;
}
