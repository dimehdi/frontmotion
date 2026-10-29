// Fluidité au défilement, section par section, avec un processeur ralenti pour imiter un ordinateur moyen.
// Mesure le temps entre deux images pendant qu'on parcourt toute la page.
//
// Usage :
//   node scripts/fluidite.mjs <adresse ou fichier.html> [options]
// Options :
//   --ralenti 4             facteur de ralentissement du processeur (4 = ordinateur moyen, 6 = téléphone modeste)
//   --largeur 1440 --hauteur 900
//   --telephone             profil de téléphone tactile (iPhone 13) au lieu d'un ordinateur
//   --sections "main > section, footer"   ce qui compte comme section (par défaut : les sections avec un id)
//   --seuil-moyenne 20 --seuil-lentes 5   seuils d'échec (ms par image en moyenne, % d'images de plus de 34 ms)
//   --entree 4000           mesure l'animation d'entrée au lieu du défilement : processeur ralenti dès le chargement,
//                          images comptées pendant 4000 ms sans toucher à la page (une section d'accueil, un écran seul)
// Les mesures dépendent de la charge de la machine : si elle est occupée, lance d'abord le script sur une page vide pour
// connaître le bruit, répète trois fois et garde la médiane.
// Code de sortie 1 si une section dépasse un seuil.
import { options, exigerAdresse, lancer, adresseDe, devices, stats } from "./lib.mjs";

const o = options(undefined, { ralenti: 4, largeur: 1440, hauteur: 900, sections: "section[id], footer", "seuil-moyenne": 20, "seuil-lentes": 5 });
const cible = exigerAdresse(o, "Usage : node scripts/fluidite.mjs <adresse ou fichier.html> [--ralenti 4] [--telephone]");
const { adresse, fermer } = await adresseDe(cible);

const navigateur = await lancer();
let contexte;
if (o.telephone) {
  const { defaultBrowserType, ...profil } = devices["iPhone 13"];
  contexte = await navigateur.newContext(profil);
} else contexte = await navigateur.newContext({ viewport: { width: o.largeur, height: o.hauteur } });
const page = await contexte.newPage();
if (o.entree) {
  // l'entrée : on enregistre les images dès le premier script de la page, processeur déjà ralenti
  const duree = o.entree === true ? 4000 : Number(o.entree);
  await page.addInitScript(() => {
    window.__images = [];
    let avant = performance.now();
    const boucle = (t) => {
      window.__images.push(t - avant);
      avant = t;
      requestAnimationFrame(boucle);
    };
    requestAnimationFrame(boucle);
  });
  const cdp = await contexte.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.ralenti });
  await page.goto(adresse, { waitUntil: "load" });
  await page.waitForTimeout(duree);
  const r = stats((await page.evaluate(() => window.__images)).filter((dt) => dt < 1000));
  await navigateur.close();
  await fermer();
  const mauvais = !r || r.moyenne > o["seuil-moyenne"] || r.lentes > o["seuil-lentes"];
  console.log(`${o.telephone ? "téléphone" : `${o.largeur}×${o.hauteur}`}, processeur ralenti ×${o.ralenti}, entrée sur ${duree} ms`);
  if (r) console.log(`${mauvais ? "✗" : "✓"} entrée ${String(r.images).padStart(4)} images  moyenne ${String(r.moyenne).padStart(5)} ms (${r.ips} i/s)  p95 ${r.p95} ms  lentes ${r.lentes} %`);
  console.log(mauvais ? "L'entrée est trop lente." : "L'entrée est fluide.");
  process.exit(mauvais ? 1 : 0);
}
await page.goto(adresse, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const cdp = await contexte.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.ralenti });

await page.evaluate(() => {
  window.__images = [];
  let avant = performance.now();
  const boucle = (t) => {
    window.__images.push([Math.round(scrollY + innerHeight / 2), t - avant]);
    avant = t;
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
});
const { total, hauteur } = await page.evaluate(() => ({ total: document.documentElement.scrollHeight - innerHeight, hauteur: innerHeight }));
const pas = Math.round(hauteur * 0.3);
for (let y = 0; y <= total + pas; y += pas) {
  if (o.telephone) await page.evaluate((v) => scrollTo(0, v), y);
  else {
    await page.mouse.move(o.largeur / 2, o.hauteur / 2);
    await page.mouse.wheel(0, pas);
  }
  await page.waitForTimeout(120);
}
await page.waitForTimeout(500);
const images = await page.evaluate(() => window.__images);
const sections = await page.evaluate((sel) =>
  [...document.querySelectorAll(sel)].map((s) => ({ nom: s.id || s.tagName.toLowerCase(), debut: s.getBoundingClientRect().top + scrollY, fin: s.getBoundingClientRect().bottom + scrollY })),
  o.sections,
);
await navigateur.close();
await fermer();

if (!sections.length) sections.push({ nom: "page", debut: 0, fin: Infinity });
console.log(`${o.telephone ? "téléphone" : `${o.largeur}×${o.hauteur}`}, processeur ralenti ×${o.ralenti}`);
let echec = false;
for (const s of sections) {
  const d = images.filter(([y, dt]) => y >= s.debut && y < s.fin && dt < 1000).map(([, dt]) => dt);
  const r = stats(d);
  if (!r) continue;
  const mauvais = r.moyenne > o["seuil-moyenne"] || r.lentes > o["seuil-lentes"];
  echec ||= mauvais;
  console.log(`${mauvais ? "✗" : "✓"} ${s.nom.padEnd(18)} ${String(r.images).padStart(4)} images  moyenne ${String(r.moyenne).padStart(5)} ms (${r.ips} i/s)  p95 ${r.p95} ms  lentes ${r.lentes} %`);
}
console.log(echec ? "Au moins une section est trop lente." : "Toutes les sections sont fluides.");
process.exitCode = echec ? 1 : 0;
