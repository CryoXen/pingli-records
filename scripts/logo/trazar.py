"""Traza el texto del sitio y el logo como contornos emparejados para la mutación.
Unidades: milésimas de em, con origen en la esquina de arriba a la izquierda del h1."""
import json, sys
import cv2, numpy as np
from scipy.optimize import linear_sum_assignment

ALTO_LOGO = 3.3   # em
PASO = 0.034      # em entre puntos
LINEA = 0.95      # alto de la caja del h1 (line-height)

def contornos(bin_img, escala, dx, dy, min_area):
    cs, _ = cv2.findContours(bin_img, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        p = c[:, 0, :].astype(np.float64)
        if len(p) < 8: continue
        p = np.column_stack([(p[:, 0] - dx) * escala, (p[:, 1] - dy) * escala])
        a = 0.5 * np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1])
        if abs(a) < min_area: continue
        if a < 0: p = p[::-1]          # todos giran igual
        out.append(p)
    return out

# —— texto
caja = json.load(open("texto.json"))
t = cv2.imread("texto.png", cv2.IMREAD_GRAYSCALE)
_, tb = cv2.threshold(t, 128, 255, cv2.THRESH_BINARY_INV)
texto = contornos(tb, 1 / 400, caja["x"], caja["y"], 1e-4)

# —— logo (sin el letrero de abajo)
g = cv2.imread("logo.jpg", cv2.IMREAD_GRAYSCALE)
g = g[:905, :]
g = cv2.resize(g, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
g = cv2.GaussianBlur(g, (0, 0), 2.2)
_, lb = cv2.threshold(g, 140, 255, cv2.THRESH_BINARY_INV)
ys, xs = np.nonzero(lb)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
esc = ALTO_LOGO / (y1 - y0)
logo = contornos(lb, esc, x0, y0, 4e-4)
# abajo a la izquierda: su base en la base de la caja del texto
for p in logo: p[:, 1] += LINEA - ALTO_LOGO
ancho_logo = (x1 - x0) * esc

def largo(p): return np.sum(np.linalg.norm(np.roll(p, -1, 0) - p, axis=1))
def centro(p): return p.mean(0)
def remuestrear(p, n):
    q = np.vstack([p, p[:1]])
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(q, axis=0), axis=1))])
    s = np.linspace(0, d[-1], n, endpoint=False)
    return np.column_stack([np.interp(s, d, q[:, 0]), np.interp(s, d, q[:, 1])])
def caja_de(cs):
    a = np.vstack(cs); return a.min(0), a.max(0)

print("contornos texto", len(texto), "logo", len(logo), "ancho logo", round(ancho_logo, 2), file=sys.stderr)

# —— emparejar por lugar (cada uno dentro de la caja de su figura)
tm, tM = caja_de(texto); lm, lM = caja_de(logo)
nt = np.array([(centro(p) - tm) / (tM - tm) for p in texto])
nl = np.array([(centro(p) - lm) / (lM - lm) for p in logo])
costo = np.abs(nt[:, None, 0] - nl[None, :, 0]) + 0.35 * np.abs(nt[:, None, 1] - nl[None, :, 1])
fi, co = linear_sum_assignment(costo)
pares = [(texto[i], logo[j]) for i, j in zip(fi, co)]
usados_t, usados_l = set(fi), set(co)

def punto_cercano(cs, objetivo):
    a = np.vstack(cs); return a[np.argmin(np.linalg.norm(a - objetivo, axis=1))]
# los que sobran nacen de (o se recogen en) un punto del borde de la otra figura
for j, p in enumerate(logo):
    if j in usados_l: continue
    pares.append((punto_cercano(texto, tm + nl[j] * (tM - tm)), p))
for i, p in enumerate(texto):
    if i in usados_t: continue
    pares.append((p, punto_cercano(logo, lm + nt[i] * (lM - lm))))

salida = []; total = 0
for a, b in pares:
    pa, pb = a.ndim == 1, b.ndim == 1
    L = max(0 if pa else largo(a), 0 if pb else largo(b))
    n = int(np.clip(round(L / PASO), 20, 900))
    A = np.repeat(a[None], n, 0) if pa else remuestrear(a, n)
    B = np.repeat(b[None], n, 0) if pb else remuestrear(b, n)
    if not pa and not pb:
        # mismo punto de arranque: el giro que menos tuerce la forma
        na = (A - A.mean(0)) / (A.std() + 1e-9); nb = (B - B.mean(0)) / (B.std() + 1e-9)
        mejor = min(range(0, n, max(1, n // 120)), key=lambda k: np.sum((na - np.roll(nb, -k, 0)) ** 2))
        B = np.roll(B, -mejor, 0)
    total += n
    salida.append({"t": np.round(A * 1000).astype(int).ravel().tolist(), "l": np.round(B * 1000).astype(int).ravel().tolist()})
json.dump({"linea": LINEA, "pares": salida}, open("logo-datos.json", "w"), separators=(",", ":"))
print("pares", len(salida), "puntos", total, file=sys.stderr)
