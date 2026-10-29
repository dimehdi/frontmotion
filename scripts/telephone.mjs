// Parcours d'un vrai téléphone : écran tactile, densité de pixels réelle, glissés du doigt (évènements tactiles), plus la
// bascule « mode appareil » des outils de développement sur une page ouverte en taille ordinateur. Une fenêtre étroite
// avec une souris n'est pas un téléphone : les règles (hover: none) et le défilement au doigt n'y existent pas.
//
// Usage :
//   node scripts/telephone.mjs <adresse ou fichier.html> [options]
// Options :
//   --appareil "iPhone 13"     profil Playwright (iPhone SE, Pixel 7, iPad Mini…)
//   --sections "section[id], footer"
//   --max-glisses 8            glissés de doigt au-delà desquels une section est trop longue
//   --captures dossier         enregistre une capture par glissé
// Code de sortie 1 si : débordement horizontal, erreur de page, ou section trop longue.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { options, exigerAdresse, lancer, adresseDe, devices } from "./lib.mjs";

const o = options(undefined, { appareil: "iPhone 13", sections: "section[id], footer", "max-glisses": 8 });
const cible = exigerAdresse(o, "Usage : node scripts/telephone.mjs <adresse ou fichier.html> [--appareil \"iPhone 13\"] [--captures dossier]");
const { adresse, fermer } = await adresseDe(cible);
if (!devices[o.appareil]) {
  console.error(`Appareil inconnu : ${o.appareil}`);
  process.exit(2);
}
if (o.captures) mkdirSync(o.captures, { recursive: true });

const navigateur = await lancer();
const problemes = [];

// 1. Le parcours au doigt
const { defaultBrowserType, ...profil } = devices[o.appareil];
const contexte = await navigateur.newContext(profil);
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(adresse, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const cdp = await contexte.newCDPSession(page);
const { width: l, height: h } = profil.viewport;
const glisser = async () => {
  const x = l / 2, y0 = h * 0.75, dy = h * 0.5;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - (dy * i) / 12 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const sections = await page.evaluate((sel) =>
  [...document.querySelectorAll(sel)].map((s) => ({ nom: s.id || s.tagName.toLowerCase(), debut: s.getBoundingClientRect().top + scrollY, fin: s.getBoundingClientRect().bottom + scrollY, glisses: 0 })),
  o.sections,
);
let debordement = 0, hauteurs = new Set();
for (let i = 0; i < 200; i++) {
  const avant = await page.evaluate(() => scrollY);
  await glisser();
  await page.waitForTimeout(900);
  // un contenu trop large fait dézoomer le téléphone : la fenêtre s'élargit avec lui, on compare donc à la largeur de l'écran
  const e = await page.evaluate((ecran) => ({ y: scrollY, H: document.documentElement.scrollHeight, ox: Math.max(document.documentElement.scrollWidth, innerWidth) - ecran, vh: innerHeight }), l);
  debordement = Math.max(debordement, e.ox);
  hauteurs.add(e.H);
  const milieu = e.y + e.vh / 2;
  const s = sections.find((q) => milieu >= q.debut && milieu < q.fin);
  if (s) s.glisses++;
  if (o.captures) await page.screenshot({ path: join(o.captures, `glisse-${String(i).padStart(3, "0")}.png`) });
  if (e.y === avant) break;
}
console.log(`${o.appareil} (${l}×${h}), parcours au doigt :`);
for (const s of sections) {
  const trop = s.glisses > o["max-glisses"];
  if (trop) problemes.push(`section « ${s.nom} » : ${s.glisses} glissés`);
  console.log(`  ${trop ? "✗" : "✓"} ${s.nom.padEnd(18)} ${s.glisses} glissés`);
}
if (debordement > 0) problemes.push(`débordement horizontal de ${debordement} px`);
if (hauteurs.size > 2) problemes.push(`la hauteur de la page a changé pendant la lecture (${[...hauteurs].join(", ")} px)`);
await contexte.close();

// 2. La bascule « mode appareil » sur une page ouverte en taille ordinateur
const bureau = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await bureau.newPage();
p2.on("pageerror", (e) => erreurs.push(e.message));
await p2.goto(adresse, { waitUntil: "networkidle" });
await p2.waitForTimeout(1500);
await p2.mouse.wheel(0, 1200);
await p2.waitForTimeout(800);
const cdp2 = await bureau.newCDPSession(p2);
await cdp2.send("Emulation.setDeviceMetricsOverride", { width: l, height: h, deviceScaleFactor: profil.deviceScaleFactor || 3, mobile: true });
await p2.waitForTimeout(1500);
const apres = await p2.evaluate(() => ({ largeur: innerWidth, contenu: document.documentElement.scrollWidth }));
if (apres.contenu > apres.largeur + 1 || apres.largeur !== l) problemes.push(`après passage en mode appareil, la page fait ${apres.contenu} px pour un écran de ${l} px (elle dézoome)`);
console.log(`  bascule ordinateur → téléphone : contenu ${apres.contenu} px pour ${apres.largeur} px de fenêtre`);
await navigateur.close();
await fermer();

if (erreurs.length) problemes.push(`erreurs de la page : ${erreurs.slice(0, 3).join(" | ")}`);
console.log(problemes.length ? `\nÀ corriger :\n- ${problemes.join("\n- ")}` : "\nAucun problème trouvé.");
process.exitCode = problemes.length ? 1 : 0;
