// Capture image par image d'une animation, avec une horloge contrôlée : aucune image ratée, aucun décalage, le même
// résultat à chaque fois. Produit les images, une planche pour tout voir d'un coup et, si ffmpeg est installé, une
// animation (WebP animé ou GIF) prête pour un README.
//
// Usage :
//   node scripts/capture.mjs <adresse ou fichier.html> [options]
// Options :
//   --selecteur ".scene"   zone à capturer (par défaut : toute la fenêtre)
//   --debut 0 --fin 3000   instants de début et de fin, en millisecondes. « 0 ms » est pris 300 ms après le chargement
//                          (le temps que la page se pose) : ajoute 300 pour avoir le temps depuis le chargement. Une animation lancée par un
//                          IntersectionObserver ne démarre qu'à la première image dessinée, c'est-à-dire à la première
//                          capture ; compte alors les instants depuis le début de l'animation, pas depuis le chargement
//   --pas 100              intervalle entre deux images (100 = 10 images par seconde, assez pour juger la fluidité)
//   --sortie captures      dossier de sortie
//   --largeur 1440 --hauteur 900 --densite 1
//   --colonnes 8           images par ligne sur la planche (moins de colonnes, images plus grandes)
//   --telephone            profil de téléphone tactile (iPhone 13 : écran, densité, toucher) au lieu d'une fenêtre
//   --suivre ".titre,.carte"   courbes de mouvement : position, vitesse et opacité de ces éléments à chaque image
//                          (courbes.png). Montre ce qu'une planche cache : vitesse constante (rigide), pic de vitesse
//                          (courbe trop raide), éléments qui démarrent ou s'arrêtent tous ensemble
//   --defiler              amène la zone au centre de l'écran avant de commencer
//   --souris               fait tourner le pointeur autour de la zone (parallaxe, survols)
//   --masquer "header"     masque des éléments pendant la capture (en-tête, bandeau…)
//   --animation webp|gif   assemble les images en une animation (ffmpeg requis)
//   --gpu                  vraie carte graphique (scènes WebGL)
//   --reduire              simule le réglage « réduire les animations » du système, pour vérifier la version réduite
//   --parcours souris.json   filme une interaction : la souris suit un parcours (survols, clics), une image par --pas.
//                          Le fichier est une liste d'étapes : { "vers": ".bouton", "x": 0.5, "y": 0.5, "images": 8,
//                          "clic": false }. x et y sont la position dans l'élément (0 à 1, débordement permis) ; la
//                          souris y va en « images » images, sur une courbe douce. Le parcours démarre après --debut
//                          (pour filmer une interaction après l'animation d'entrée) ; --fin est ignoré. Une cible hors
//                          de l'écran est amenée au centre avant que la souris y aille.
//                          Une étape { "touche": "Tab", "images": 6 } appuie sur une touche (parcours au clavier :
//                          vérifier que le contour de focus se voit en entier). Pour un glisser-déposer : "appui": true
//                          enfonce le bouton au début de l'étape, "relache": true le relève à la fin.
//   --defilement 0:3000:150   capture pilotée par le défilement : de 0 à 3000 px, une image tous les 150 px (chaque position
//                          laisse --pas millisecondes à la page pour se poser). Plusieurs trajets à la suite, séparés
//                          par des virgules : « 0:3000:40,3000:0:-60 » descend puis remonte (pour montrer que chaque
//                          position donne le même état dans les deux sens)
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { options, exigerAdresse, lancer, adresseDe, ffmpeg, devices } from "./lib.mjs";

const o = options(undefined, { debut: 0, fin: 3000, pas: 100, sortie: "captures", largeur: 1440, hauteur: 900, densite: 1 });
const cible = exigerAdresse(o, "Usage : node scripts/capture.mjs <adresse ou fichier.html> [--selecteur .scene] [--debut 0] [--fin 3000] [--pas 100] [--sortie captures] [--animation webp]");
const { adresse, fermer } = await adresseDe(cible);
const dossier = resolve(o.sortie);
mkdirSync(dossier, { recursive: true });

const navigateur = await lancer({ gpu: !!o.gpu });
let page;
if (o.telephone) {
  const { defaultBrowserType, ...profil } = devices["iPhone 13"];
  page = await (await navigateur.newContext(profil)).newPage();
} else page = await navigateur.newPage({ viewport: { width: o.largeur, height: o.hauteur }, deviceScaleFactor: o.densite });
// Les courbes de mouvement : pour chaque élément suivi, son centre et son opacité à chaque image.
const suivis = o.suivre ? String(o.suivre).split(",").map((x) => x.trim()).filter(Boolean) : [];
const releves = [];
async function noter(t) {
  if (!suivis.length) return;
  releves.push({ t, mesures: await page.evaluate((sel) => sel.map((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, o: +getComputedStyle(e).opacity };
  }), suivis) });
}
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
// L'horloge de la page n'avance que quand on le décide. install() seul ne suffit pas : le temps continuerait de couler
// pendant chaque capture d'écran (environ 90 ms à chaque fois), et l'animation paraîtrait accélérée. pauseAt() la fige.
const zero = new Date("2026-01-01T00:00:00Z").getTime();
await page.clock.install({ time: zero });
if (o.reduire) await page.emulateMedia({ reducedMotion: "reduce" });
await page.clock.pauseAt(zero + 1000);
// Les transitions et animations CSS n'obéissent pas à cette horloge : elles avancent en temps réel, même page figée.
// À chaque pas, on les met en pause et on les avance nous-mêmes d'autant (elles sont toutes dans document.getAnimations()).
async function avancer(ms) {
  await page.clock.runFor(ms);
  await page.evaluate((ms) => {
    const suivi = (window.__captureCss ||= new WeakMap());
    for (const a of document.getAnimations()) {
      if (a.playState === "paused" && !suivi.has(a)) continue; // mise en pause par la page elle-même : on n'y touche pas
      const t = (suivi.get(a) ?? 0) + ms;
      suivi.set(a, t);
      a.pause();
      a.currentTime = t;
    }
  }, ms);
}
await page.goto(adresse, { waitUntil: "domcontentloaded" });
if (o.masquer) await page.addStyleTag({ content: `${o.masquer}{visibility:hidden!important}` });
await avancer(300);
if (o.defiler && o.selecteur) await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), o.selecteur);
await avancer(o.debut);

let zone = o.selecteur ? await page.locator(o.selecteur).first().boundingBox() : null;
if (o.selecteur && !zone) {
  console.error(`Zone introuvable : ${o.selecteur}`);
  process.exit(1);
}
const noms = [];
if (o.defilement) {
  // une image par position de défilement : l'animation pilotée par le défilement doit montrer un seul état par position
  const trajets = String(o.defilement).split(",").map((t) => t.split(":").map(Number));
  let i = 0;
  for (const [de, a, saut] of trajets) for (let y = de; saut > 0 ? y <= a : y >= a; y += saut, i++) {
    // l'évènement de défilement n'arrive qu'au prochain dessin réel, après l'avance de l'horloge : on l'envoie tout de suite,
    // sinon chaque image montrerait l'état de la position précédente
    await page.evaluate((v) => {
      scrollTo(0, v);
      dispatchEvent(new Event("scroll"));
    }, y);
    await avancer(o.pas);
    const nom = `image-${String(i).padStart(4, "0")}.png`;
    await page.screenshot({ path: join(dossier, nom), clip: zone || undefined });
    noms.push({ nom, t: `${y} px` });
    await noter(i * o.pas);
  }
}
if (o.parcours) {
  // la souris suit le parcours ; chaque étape part de la position atteinte par la précédente
  const etapes = JSON.parse(readFileSync(resolve(o.parcours), "utf8"));
  const douce = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  let ici = null, i = 0;
  for (const e of etapes) {
    if (e.touche) {
      await page.keyboard.press(e.touche);
      for (let k = 0; k < (e.images ?? 1); k++, i++) {
        await avancer(o.pas);
        const nom = `image-${String(i).padStart(4, "0")}.png`;
        await page.screenshot({ path: join(dossier, nom), clip: zone || undefined });
        noms.push({ nom, t: i * o.pas });
      await noter(i * o.pas);
        await noter(i * o.pas);
      }
      continue;
    }
    const cible = page.locator(e.vers).first();
    const visible = await cible.evaluate((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).catch(() => false);
    if (!visible) {
      await cible.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await avancer(o.pas);
      if (o.selecteur) zone = await page.locator(o.selecteur).first().boundingBox(); // la zone filmée a bougé avec la page
    }
    const b = await cible.boundingBox();
    if (!b) throw new Error(`Élément introuvable dans le parcours : ${e.vers}`);
    const vers = { x: b.x + b.width * (e.x ?? 0.5), y: b.y + b.height * (e.y ?? 0.5) };
    const de = ici || vers;
    const n = Math.max(1, e.images ?? 1);
    for (let k = 1; k <= n; k++, i++) {
      const q = douce(k / n);
      if (e.appui && k === 1) await page.mouse.down();
      await page.mouse.move(de.x + (vers.x - de.x) * q, de.y + (vers.y - de.y) * q);
      if (e.relache && k === n) await page.mouse.up();
      if (e.clic && k === n) await page.mouse.down();
      await avancer(o.pas);
      if (e.clic && k === n) await page.mouse.up();
      const nom = `image-${String(i).padStart(4, "0")}.png`;
      await page.screenshot({ path: join(dossier, nom), clip: zone || undefined });
      noms.push({ nom, t: i * o.pas });
    }
    ici = vers;
  }
}
for (let t = o.debut, i = 0; !o.defilement && !o.parcours && t <= o.fin; t += o.pas, i++) {
  if (o.souris && zone) {
    const a = (i / 12) * Math.PI * 2;
    await page.mouse.move(zone.x + zone.width * (0.5 + 0.4 * Math.cos(a)), zone.y + zone.height * (0.5 + 0.4 * Math.sin(a)));
  }
  const nom = `image-${String(i).padStart(4, "0")}.png`;
  await page.screenshot({ path: join(dossier, nom), clip: zone || undefined });
  noms.push({ nom, t });
  await noter(t);
  await avancer(o.pas);
}

// La planche : toutes les images en grille, avec leur instant, pour juger d'un coup d'œil.
const colonnes = Math.min(Number(o.colonnes) || 8, noms.length); // --colonnes 4 : images plus grandes sur la planche
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#ddd;font:12px system-ui;display:grid;grid-template-columns:repeat(${colonnes},1fr);gap:4px;padding:4px}
figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 0}</style>
${noms.map((n) => `<figure><img src="${n.nom}"><figcaption>${typeof n.t === "number" ? n.t + " ms" : n.t}</figcaption></figure>`).join("")}`;
writeFileSync(join(dossier, "planche.html"), html);
const vue = await navigateur.newPage({ viewport: { width: 1600, height: 200 } });
await vue.goto("file:///" + join(dossier, "planche.html").replace(/\\/g, "/"));
await vue.waitForTimeout(300);
await vue.screenshot({ path: join(dossier, "planche.png"), fullPage: true });
let bilanCourbes = [];
if (releves.length > 2) {
  // vitesse de chaque élément entre deux images (px par seconde), puis un graphique par élément
  const L = 900, H = 120, T = releves[releves.length - 1].t - releves[0].t || 1;
  const blocs = suivis.map((sel, k) => {
    const pts = releves.map((r) => ({ t: r.t, m: r.mesures[k] })).filter((p) => p.m);
    const v = pts.slice(1).map((p, i) => ({ t: p.t, v: (Math.hypot(p.m.x - pts[i].m.x, p.m.y - pts[i].m.y) / Math.max(1, p.t - pts[i].t)) * 1000 }));
    const vmax = Math.max(1, ...v.map((x) => x.v));
    const enMouvement = v.filter((x) => x.v > 5);
    let note = "immobile";
    if (enMouvement.length) {
      const moy = enMouvement.reduce((a, b) => a + b.v, 0) / enMouvement.length;
      const pic = Math.max(...enMouvement.map((x) => x.v));
      const ecart = Math.sqrt(enMouvement.reduce((a, b) => a + (b.v - moy) ** 2, 0) / enMouvement.length) / moy;
      const debut = enMouvement[0].t, fin = enMouvement[enMouvement.length - 1].t;
      note = `bouge de ${debut} à ${fin} ms, pic ${Math.round(pic)} px/s (${(pic / moy).toFixed(1)} fois la moyenne)`;
      if (enMouvement.length >= 4 && ecart < 0.15) note += " · vitesse presque constante : mouvement mécanique, rigide";
      if (pic / moy > 3) note += " · pic très marqué : tout le trajet tient dans un instant";
      bilanCourbes.push({ sel, debut, fin });
    }
    const x = (t) => ((t - releves[0].t) / T) * L;
    const ligneV = v.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${(H - (p.v / vmax) * (H - 8)).toFixed(1)}`).join("");
    const ligneO = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${(H - p.m.o * (H - 8)).toFixed(1)}`).join("");
    return `<h3>${sel}</h3><p>${note}</p><svg width="${L}" height="${H}" viewBox="0 0 ${L} ${H}"><rect width="${L}" height="${H}" fill="#1b1b1b"/><path d="${ligneO}" fill="none" stroke="#777" stroke-dasharray="4 4"/><path d="${ligneV}" fill="none" stroke="#f2a65a" stroke-width="2"/></svg>`;
  });
  const ensemble = bilanCourbes.length > 2 && new Set(bilanCourbes.map((b) => b.debut)).size === 1 ? "<p><b>Tous les éléments suivis démarrent à la même image</b> : rien ne mène, rien ne suit.</p>" : "";
  writeFileSync(join(dossier, "courbes.html"), `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#111;color:#ddd;font:13px system-ui}h3{margin:16px 0 2px;font-size:13px}p{margin:0 0 6px;color:#aaa}</style><p>Orange : vitesse (le haut = la plus grande vitesse de cet élément). Gris pointillé : opacité. Axe horizontal : ${releves[0].t} à ${releves[releves.length - 1].t} ms.</p>${ensemble}${blocs.join("")}`);
  await vue.goto("file:///" + join(dossier, "courbes.html").replace(/\\/g, "/"));
  await vue.screenshot({ path: join(dossier, "courbes.png"), fullPage: true });
}
await navigateur.close();
await fermer();

let animation = null;
if (o.animation) {
  const ff = ffmpeg();
  if (!ff) console.warn("ffmpeg est introuvable : pas d'animation assemblée (installe ffmpeg ou renseigne la variable FFMPEG).");
  else {
    const ips = Math.round(1000 / o.pas);
    const entree = ["-framerate", String(ips), "-i", join(dossier, "image-%04d.png")];
    const largeurSortie = o["largeur-animation"] || 800;
    animation = join(dossier, `animation.${o.animation === "gif" ? "gif" : "webp"}`);
    const filtre = `scale=${largeurSortie}:-2:flags=lanczos`;
    const args = o.animation === "gif"
      ? ["-y", ...entree, "-vf", `${filtre},split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a`, "-loop", "0", animation]
      : ["-y", ...entree, "-vf", filtre, "-c:v", "libwebp", "-quality", "78", "-compression_level", "6", "-loop", "0", animation];
    const r = spawnSync(ff, args, { encoding: "utf8" });
    if (r.status !== 0) {
      console.error(r.stderr.slice(-400));
      animation = null;
    }
  }
}

console.log(`${noms.length} images dans ${dossier}`);
console.log(`planche : ${join(dossier, "planche.png")}`);
if (animation) console.log(`animation : ${animation}`);
if (releves.length > 2) console.log(`courbes : ${join(dossier, "courbes.png")}`);
if (erreurs.length) {
  console.log("erreurs de la page :", erreurs);
  process.exitCode = 1;
}
