// Lance les trois contrôles automatiques sur une adresse : fluidité, ralentissements, téléphone.
// La capture image par image se lance à part : elle demande de choisir une zone et des instants.
//
// Usage : node scripts/verifier-tout.mjs <adresse ou fichier.html>
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cible = process.argv[2];
if (!cible) {
  console.error("Usage : node scripts/verifier-tout.mjs <adresse ou fichier.html>");
  process.exit(2);
}
const ici = dirname(fileURLToPath(import.meta.url));
const etapes = [
  ["Fluidité (ordinateur, processeur ralenti ×4)", ["fluidite.mjs", cible]],
  ["Fluidité (téléphone)", ["fluidite.mjs", cible, "--telephone"]],
  ["Ralentissements", ["ralentissements.mjs", cible]],
  ["Téléphone tactile", ["telephone.mjs", cible]],
];
let echecs = 0;
for (const [titre, [script, ...args]] of etapes) {
  console.log(`\n=== ${titre} ===`);
  const r = spawnSync(process.execPath, [join(ici, script), ...args], { stdio: "inherit" });
  if (r.status !== 0) echecs++;
}
console.log(`\n${echecs ? `${echecs} contrôle(s) à reprendre.` : "Tous les contrôles passent."}`);
process.exitCode = echecs ? 1 : 0;
