// Trouve ce qui ralentit une animation :
// 1. les lectures de mise en page faites à chaque image (getBoundingClientRect, offsetTop, scrollY…), première cause de
//    saccades : elles forcent le navigateur à recalculer toute la page au milieu de l'image ;
// 2. les longues images (Long Animation Frames), avec le script responsable et le temps de recalcul forcé.
//
// Usage :
//   node scripts/ralentissements.mjs <adresse ou fichier.html> [options]
// Options :
//   --zone "#tarifs"        se place sur cette section avant de mesurer (sinon : parcourt toute la page)
//   --duree 3000            durée d'observation, en millisecondes
//   --ralenti 4             processeur ralenti
//   --seuil 1               lectures de mise en page par image tolérées en moyenne
// Code de sortie 1 si des lectures répétées à chaque image sont trouvées.
import { options, exigerAdresse, lancer, adresseDe } from "./lib.mjs";

const o = options(undefined, { duree: 3000, ralenti: 4, seuil: 1, largeur: 1440, hauteur: 900 });
const cible = exigerAdresse(o, "Usage : node scripts/ralentissements.mjs <adresse ou fichier.html> [--zone #section] [--duree 3000]");
const { adresse, fermer } = await adresseDe(cible);

const navigateur = await lancer();
const contexte = await navigateur.newContext({ viewport: { width: o.largeur, height: o.hauteur } });
// Compteur posé avant tout script de la page : chaque lecture de mise en page est comptée avec l'endroit qui l'a faite.
await contexte.addInitScript(() => {
  const compte = new Map();
  let image = 0;
  window.__lectures = { compte, images: () => image };
  const tick = () => {
    image++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const origine = () => {
    // pile : Error, origine, noter, l'enveloppe, puis l'appelant de la page
    const pile = new Error().stack.split("\n").slice(4, 5).join("").trim();
    return pile.replace(/^at\s+/, "").replace(/\(?https?:\/\/[^/]+\//, "(").replace(/^\((.*)\)$/, "$1").slice(0, 120);
  };
  const noter = (nom) => {
    if (!window.__mesure) return;
    const cle = `${nom} ← ${origine()}`;
    compte.set(cle, (compte.get(cle) || 0) + 1);
  };
  const envelopper = (proto, nom) => {
    const f = proto[nom];
    proto[nom] = function (...a) {
      noter(nom);
      return f.apply(this, a);
    };
  };
  envelopper(Element.prototype, "getBoundingClientRect");
  envelopper(Element.prototype, "getClientRects");
  envelopper(window, "getComputedStyle");
  for (const prop of ["offsetTop", "offsetLeft", "offsetWidth", "offsetHeight"]) {
    const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    Object.defineProperty(HTMLElement.prototype, prop, { get() { noter(prop); return d.get.call(this); } });
  }
  for (const prop of ["clientWidth", "clientHeight", "scrollTop"]) {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    Object.defineProperty(Element.prototype, prop, { get() { noter(prop); return d.get.call(this); }, set: d.set });
  }
});
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(adresse, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
if (o.zone) await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), o.zone);
await page.waitForTimeout(800);
const cdp = await contexte.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: o.ralenti });

await page.evaluate(() => {
  window.__longues = [];
  try {
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) =>
        window.__longues.push({
          duree: Math.round(e.duration),
          scripts: e.scripts.map((s) => ({ ou: `${(s.sourceURL || "").split("/").pop()} ${s.sourceFunctionName || ""}`.trim() || s.invoker, duree: Math.round(s.duration), force: Math.round(s.forcedStyleAndLayoutDuration) })),
        }),
      ),
    ).observe({ type: "long-animation-frame" });
  } catch {}
  window.__debutImages = window.__lectures.images();
  window.__mesure = true;
});
// pendant l'observation : on défile doucement (sur la zone) ou on parcourt la page
const fin = Date.now() + o.duree;
while (Date.now() < fin) {
  await page.mouse.move(o.largeur / 2, o.hauteur / 2);
  await page.mouse.wheel(0, o.zone ? 60 : 300);
  await page.waitForTimeout(o.zone ? 150 : 200);
}
const r = await page.evaluate(() => {
  window.__mesure = false;
  const images = window.__lectures.images() - window.__debutImages;
  const lignes = [...window.__lectures.compte.entries()].sort((a, b) => b[1] - a[1]);
  return { images, lignes, longues: window.__longues };
});
await navigateur.close();
await fermer();

const totalLectures = r.lignes.reduce((a, [, n]) => a + n, 0);
const parImage = r.images ? totalLectures / r.images : 0;
console.log(`${r.images} images observées, ${totalLectures} lectures de mise en page (${parImage.toFixed(1)} par image en moyenne)`);
const repetees = r.lignes.filter(([, n]) => n >= r.images * 0.8);
if (repetees.length) {
  console.log("\nLues à chaque image (à mesurer une fois puis dériver du défilement) :");
  repetees.slice(0, 10).forEach(([cle, n]) => console.log(`  ${String(n).padStart(5)}×  ${cle}`));
}
const longues = r.longues.filter((l) => l.duree > 50).sort((a, b) => b.duree - a.duree);
console.log(`\n${longues.length} images de plus de 50 ms.`);
longues.slice(0, 6).forEach((l) => console.log(`  ${l.duree} ms : ${l.scripts.map((s) => `${s.ou} (${s.duree} ms, dont ${s.force} ms de recalcul forcé)`).join(" ; ") || "rendu ou décodage"}`));
if (erreurs.length) console.log("\nErreurs de la page :", erreurs);
const echec = repetees.length > 0 && parImage > o.seuil;
console.log(echec ? "\nDes lectures de mise en page sont répétées à chaque image." : "\nAucune lecture de mise en page répétée à chaque image.");
process.exitCode = echec ? 1 : 0;
