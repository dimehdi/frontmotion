# Pièges techniques

Ce qui a réellement cassé, et comment l'éviter.

## Deux recettes que la grille demande souvent

**De la masse (question 3).** Ce qui suit la main la rattrape avec un léger retard, garde son élan, puis se pose là où
l'élan l'arrête, sans rebond ni recalage.

```js
let x = 0, v = 0, cible = 0;                          // cible : la molette, la souris, le doigt
const raideur = 150, amorti = 2 * Math.sqrt(raideur); // amortissement critique : il rattrape sans dépasser
function avancer(dt) {
  v += (raideur * (cible - x) - amorti * v) * dt;
  x += v * dt;
}
```

Une inclinaison de quelques degrés proportionnelle à `v`, qui se redresse à l'arrêt, et des voisins qui suivent avec
environ 60 ms de retard, donnent le mouvement secondaire.

**Un état par position (question 8).** Une transition pilotée par le défilement calcule son avancée depuis la position,
`t = clamp((scrollY - debut) / (fin - debut), 0, 1)`, et rien d'autre : on s'arrête, on remonte, la page montre toujours
la même chose au même endroit. On la ralentit par la distance et une courbe douce, jamais par un amorti lourd qui fait
traîner le texte. Une scène, elle, peut garder un léger lissage (0,3 à 0,6 s) pour ne pas « pulser » à chaque cran.

## Performance

- **Ne lis pas la mise en page à chaque image** (`getBoundingClientRect`, `offsetTop`, parfois même `scrollY` quand le
  style vient de changer). Mesure une fois, puis à chaque `ResizeObserver`, et calcule le reste depuis le défilement.
- **Rien ne tourne hors de l'écran.** Une animation infinie dans une section invisible fait recalculer les styles de toute
  la page à chaque image.
- **Anime `transform` et `opacity`**, pas `width`, `height`, `top`, ni la graisse d'une police.
- **N'anime pas une variable CSS posée sur `:root`** : tous les éléments de la page recalculent leur style. Pose-la sur
  l'élément concerné.
- **Teste un ordinateur moyen**, pas le tien : processeur ralenti quatre fois (`scripts/fluidite.mjs`). Une machine
  chargée fausse tout : mesure plusieurs fois et compare avec une page de référence mesurée au même moment.
- **Un mode allégé automatique.** Mesure les images par seconde peu après le chargement, une fois l'animation d'entrée
  finie ; en dessous de 40, ajoute une classe sur `<html>` qui coupe les effets secondaires (fond animé plus léger,
  curseur du système). Les animations principales restent.
- **Trouver le coupable** : `scripts/ralentissements.mjs` nomme le code qui force la mise en page ; sinon, masque un
  élément à la fois (`display: none`) et remesure.

## Ce qui ralentit une scène dessinée

- **Une caméra qui déplace tout un dessin SVG le fait redessiner en entier** à chaque image. Déplace un groupe placé dans
  sa propre couche (`will-change: transform` sur l'élément HTML qui contient le SVG), ou réduis ce qui est dedans.
- **Des centaines de petits éléments** (grains, feuilles, points) coûtent cher : regroupe-les dans un seul tracé, ou
  dessine-les dans un motif (`<pattern>`) ou un canvas.
- **Un masque ou un flou recalculé à chaque image** pèse lourd ; s'il ne bouge pas, fige-le.
- **Trouver le coupable** : retire une partie à la fois dans une copie de la page et remesure.

## GSAP

- **Dans une timeline, un `fromTo` affiche son état de départ dès sa création** : `immediateRender: false`, ou pose
  l'état de départ à la main. Sinon un élément apparaît avant son heure.
- **Une position décalée s'écrit en une fois** (`"etape+=1.6"`), jamais en deux décalages à la suite.
- **Une pilule dont le rayon s'anime** a un rayon égal à la moitié de sa hauteur. Avec `999px`, le rayon ne change
  visiblement qu'à la toute fin et la forme saute.
- **Un libellé masqué** a un masque de la hauteur de sa ligne, pour sortir en entier. Pendant que la ligne monte, le
  masque ne doit pas rogner les jambages (q, p, g) : agrandis-le un peu vers le bas.
- **Une transition CSS et GSAP sur la même propriété se battent** : l'élément s'arrête à mi-chemin ou reste vide. Retire
  la transition CSS de ce que GSAP anime (`transition` sur `transform` notamment).
- **Une animation créée en plein défilement** lit la mise en page une fois à sa création : ce n'est pas un problème, tant
  que ce n'est pas répété à chaque image.

## Téléphone

- **Un vrai profil d'appareil, pas une fenêtre étroite.** Une fenêtre de 390 px avec une souris ne déclenche ni les
  règles `(hover: none)`, ni le défilement au doigt. Simule un appareil (Playwright `devices["iPhone 13"]`) avec de vrais
  glissés, comme `scripts/telephone.mjs`.
- **Rejoue le passage ordinateur → mode appareil des outils de développement** sur une page déjà ouverte : tout ce qui a
  été mesuré en largeur d'ordinateur doit se remesurer. Vérifie que la page ne déborde pas (`scrollWidth` égal à
  `innerWidth`), sinon elle dézoome.
- **Plusieurs hauteurs.** La barre d'adresse réduit la hauteur visible ; un petit téléphone n'a qu'environ 550 px.
  Préfère `svh` ou `dvh` à `vh`.
- **Simplifier plutôt que réduire.** Une section épinglée de huit écrans devient un supplice au doigt. Un mode compact :
  contenu en flux normal, rangées qui glissent au doigt (`scroll-snap`) avec le bord de l'élément suivant visible.
- **Un seul interrupteur de mode**, posé avant le premier affichage par un script en ligne dans `<head>` (une classe sur
  `<html>`), quand le JavaScript change de comportement selon le format. Si seul le CSS change, une requête `@media`
  suffit.
- **Un fond animé fixe qui suit le défilement aura toujours une image de retard au doigt** : le défilement tactile ne
  passe pas par le même fil que le dessin. Fige-le à l'écran.
- **Le focus est un piège au toucher.** Ne ferme rien au départ du focus : la mise en page bouge entre le doigt posé et le
  doigt levé, et le toucher suivant est perdu. N'ouvre au focus qu'au clavier (`:focus-visible`).
- **Un menu plein écran part d'en haut et peut défiler**, sinon il déborde sur les petits écrans. Échap le ferme et rend
  le focus au bouton.
- **Zones de toucher de 44 px au moins.**
- **La tablette en hauteur** est un format à part : ni téléphone ni ordinateur. Regarde-la.

## Vidéo

- **Ne précharge pas ce que la personne ne verra peut-être pas** (`preload="none"`, source posée à l'approche).
- **Une version par taille d'écran** (`<source media="(max-width: 760px)">`) : la même image à l'écran pour une fraction
  du poids.
- **Une boucle est un plan entier**, de sa première à sa dernière image, sans une image du plan suivant. Repère les coupes
  avec la détection de scènes de ffmpeg, et vérifie image par image.
- **L'image d'attente est la première image de la boucle** : aucun saut quand la lecture démarre.
- **Safari exige les requêtes par morceaux** (réponse 206). Un hébergeur qui renvoie toujours le fichier entier casse les
  vidéos sur iPhone. Vérifie avec `curl -H "Range: bytes=0-1"`.
- **Ne retire jamais le son d'une vidéo de ta propre initiative.**

## 3D

- **Seulement quand la profondeur raconte quelque chose** : un objet qu'on fait tourner, une caméra qui traverse un
  espace. Sinon une scène dessinée est plus légère et plus nette.
- **Une seule scène et une seule horloge** pour tout ce qui est 3D sur la page ; plusieurs contextes WebGL se battent.
- **Pas de bord net** : la scène se fond dans le fond, et ne remplit jamais tout son cadre.
- **Au téléphone**, une rangée simple au doigt vaut souvent mieux qu'un carrousel 3D. Prévois aussi une version sans
  WebGL.

## Le réglage « réduire les animations »

Certaines personnes activent `prefers-reduced-motion` dans leur système. Le respecter ou non est **un choix du projet** :
certains le respectent, d'autres non, par exemple parce que l'expérience du site repose sur son mouvement. Dis le choix
fait.

Si le projet le respecte, réduis plutôt que de tout couper :

- retire ce qui fatigue : grands déplacements liés au défilement, zooms et rotations amples, ce qui suit la souris en
  permanence, mouvements continus de grande surface ;
- garde ce qui informe : changements d'état, révélations courtes, scènes qui se construisent dans leur cadre ;
- une seule variable suffit (`const A = reduit ? 0.3 : 1`, qui multiplie les amplitudes), plutôt qu'une seconde version.

Pour tout le monde : jamais plus de trois clignotements par seconde.

## Les outils du dépôt

Tous prennent une adresse ou un fichier HTML local, et demandent Node 20 et Playwright (`pnpm install`).

| Script | Ce qu'il fait |
|---|---|
| `capture.mjs` | images exactes à horloge figée, planche, animation WebP ou GIF ; `--suivre` (courbes de mouvement), `--telephone`, `--defilement`, `--parcours` (survols, clics, glisser-déposer, clavier), `--reduire` |
| `fluidite.mjs` | durée des images par section, processeur ralenti ; `--telephone`, `--entree` |
| `ralentissements.mjs` | le code qui force la mise en page, et le temps perdu |
| `telephone.mjs` | profil tactile, glissés, débordements, passage ordinateur → mode appareil |
