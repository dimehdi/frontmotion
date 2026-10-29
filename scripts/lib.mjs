// Outils communs aux scripts de Frontmotion : lecture des options, lancement du navigateur, petit serveur local.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, normalize, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, devices } from "playwright";

export { chromium, devices };

/** Lit `--cle valeur` et `--drapeau` ; les arguments sans tiret vont dans `_`. */
export function options(argv = process.argv.slice(2), defauts = {}) {
  const o = { ...defauts, _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      o._.push(a);
      continue;
    }
    const cle = a.slice(2);
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.startsWith("--")) o[cle] = true;
    else {
      o[cle] = isNaN(+suivant) ? suivant : +suivant;
      i++;
    }
  }
  return o;
}

/** Arrête le script avec un message d'usage si l'adresse manque. */
export function exigerAdresse(o, usage) {
  if (!o._[0]) {
    console.error(usage);
    process.exit(2);
  }
  return o._[0];
}

/** Lance Chromium ; `gpu: true` utilise la vraie carte graphique (rendu 3D fidèle). */
export function lancer({ gpu = false } = {}) {
  return chromium.launch({ args: gpu ? ["--enable-gpu", "--ignore-gpu-blocklist"] : [] });
}

/** Chemin de ffmpeg (variable FFMPEG, sinon celui du système), ou null s'il est absent. */
export function ffmpeg() {
  const candidat = process.env.FFMPEG || "ffmpeg";
  const r = spawnSync(candidat, ["-version"], { encoding: "utf8" });
  return r.status === 0 ? candidat : null;
}

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".woff2": "font/woff2" };

/** Sert un dossier en local (pour tester un fichier HTML sans outil de construction). Renvoie { adresse, fermer }. */
export async function servir(dossier, port = 0) {
  const racine = resolve(dossier);
  const serveur = createServer(async (req, res) => {
    try {
      let chemin = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let fichier = normalize(join(racine, chemin));
      if (!fichier.startsWith(racine)) throw new Error("hors du dossier");
      if ((await stat(fichier)).isDirectory()) fichier = join(fichier, "index.html");
      res.writeHead(200, { "Content-Type": types[extname(fichier)] || "application/octet-stream" });
      res.end(await readFile(fichier));
    } catch {
      res.writeHead(404);
      res.end("introuvable");
    }
  });
  await new Promise((ok) => serveur.listen(port, "127.0.0.1", ok));
  const adresse = `http://127.0.0.1:${serveur.address().port}/`;
  return { adresse, fermer: () => new Promise((ok) => serveur.close(ok)) };
}

/** Un fichier local devient une adresse servie ; une adresse http reste telle quelle. */
export async function adresseDe(cible) {
  if (/^https?:\/\//.test(cible)) return { adresse: cible, fermer: async () => {} };
  // un fichier local peut porter des paramètres d'adresse (page.html?qa&t=3) : on les garde tels quels
  const [fichier, ...reste] = cible.split("?");
  const requete = reste.length ? "?" + reste.join("?") : "";
  const plein = resolve(fichier);
  const dossier = plein.slice(0, plein.lastIndexOf(sep));
  const nom = plein.slice(plein.lastIndexOf(sep) + 1);
  const s = await servir(dossier);
  return { adresse: s.adresse + encodeURIComponent(nom) + requete, fermer: s.fermer };
}

/** Statistiques de durées d'images (ms). */
export function stats(durees) {
  if (!durees.length) return null;
  const tri = [...durees].sort((a, b) => a - b);
  const moy = durees.reduce((a, b) => a + b, 0) / durees.length;
  return {
    images: durees.length,
    moyenne: +moy.toFixed(1),
    ips: Math.round(1000 / moy),
    p95: Math.round(tri[Math.floor(tri.length * 0.95)]),
    lentes: Math.round((durees.filter((d) => d > 34).length / durees.length) * 100),
  };
}
