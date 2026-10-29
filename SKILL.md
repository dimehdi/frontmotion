---
name: frontmotion
description: Faire des animations web de haut niveau par des tours de critique, comme avec un directeur artistique exigeant. Un premier jet ambitieux, puis l'agent filme son animation image par image, la juge avec une grille de questions tirées de vrais retours (« ça s'arrête net », « c'est rigide », « on ne comprend pas ce que ça fait là »), corrige et recommence. À utiliser dès qu'on anime une page, une section, une illustration ou une interaction, ou qu'une animation paraît rigide, générique, pauvre ou trop chargée.
---

# Frontmotion

Un agent sait écrire une belle animation. Il la juge mal : il la regarde peu, et il est trop indulgent avec son propre
travail. Ce skill vient d'un site réel où aucune animation n'a été bonne du premier coup. Chacune est passée par deux ou
trois tours de critique précise avant d'être jugée excellente. C'est cette boucle qui fait la qualité, pas des règles.

Le skill ne donne ni style ni effets à copier. Chaque projet trouve son propre mouvement.

## La boucle

### 1. Un premier jet ambitieux

Vise haut dès le départ : une vraie mise en scène, un moment fort, un mouvement lié au sujet du site. La retenue viendra
au tour suivant, si la critique la demande. Un premier jet timide ne devient jamais excellent.

Écris en tête du code, en trois lignes : ce que l'animation raconte, son moment fort, et ce qu'on voit à la fin.

### 2. Regarder pour de vrai

- **Image par image**, avec une horloge figée : `node scripts/capture.mjs page.html --selecteur ".zone" --fin 6000 --pas 100`
  produit une planche. Pour le défilement : `--defilement 0:3000:40,3000:0:-60` (descente puis remontée). Pour un survol,
  un clic ou un glisser : `--parcours trajet.json`. Au téléphone : `--telephone`.
- **Le mouvement lui-même**, que des images fixes ne montrent pas : `--suivre ".titre,.visuel,.bouton"` trace la vitesse
  de chaque élément dans le temps (`courbes.png`) et signale une vitesse constante (rigide), un pic trop marqué, ou des
  éléments qui démarrent tous ensemble. `--animation webp` assemble les images en une animation à regarder.
- **L'image finale seule**, en grand, puis la page cinq secondes après la fin.
- **Avec un vrai geste** : molette, souris qui survole tout, clics rapides, changement de sens.
- **Sur un téléphone simulé** (profil tactile, pas une fenêtre étroite) : `node scripts/telephone.mjs page.html`.
- **Si tu reprends une page existante**, filme-la d'abord : c'est ton « avant ».

### 3. Critiquer avec la grille

Réponds par écrit à chaque question de la grille ci-dessous, avec une preuve : un instant, une image de la planche, une
mesure. **Trouve au moins trois défauts.** Si tu n'en trouves pas, tu n'as pas assez regardé : un regard exigeant en
trouve toujours.

### 4. Corriger les plus visibles, puis recommencer

Corrige les trois défauts qui se voient le plus, refilme, recritique. Deux ou trois tours. Ne change pas ce qui
marche : un tour qui corrige un défaut et en crée un autre ailleurs n'est pas un progrès.

Arrête quand ce qui reste relève du goût plutôt que du défaut : plus rien ne saute, ne traîne, ne se coupe ou ne
déçoit à la fin. Un défaut de fluidité passe avant un détail visuel : une saccade se voit plus qu'une nuance.

### 5. Présenter honnêtement

Montre la version d'avant à côté de celle d'après. Dis ce qui a été corrigé, avec la preuve, et ce qui reste faible.
N'écris jamais « corrigé » sans l'avoir revu.

## La grille

Chaque question vient d'un vrai retour. La piste sous chaque question est un principe, pas une recette : trouve la
réponse propre à ton projet.

1. **Que voit-on à la fin, et cinq secondes après ?** Une animation qui s'arrête et laisse une page morte déçoit : « quand
   elle s'arrête, plus rien ne se passe ». Piste : une image finale composée comme une affiche, et une vie discrète qui
   continue sans rejouer l'histoire.
2. **Combien de temps attend-on ?** Chronomètre. Le texte doit se lire tout de suite, et le moment fort ne doit pas
   arriver au bout de sept secondes : un visiteur pressé ne le verra pas. Piste : resserrer, avancer le moment fort.
3. **Est-ce rigide ?** Des trajets en ligne droite, tout qui démarre et s'arrête en même temps, rien qui réagit à la
   vitesse. Piste : des arcs, des éléments qui suivent avec un léger retard, de la masse (rattraper, garder l'élan, se
   poser), un mouvement secondaire.
4. **Est-ce que tout bouge en même temps ?** Plusieurs mouvements autonomes qui se disputent l'œil donnent « mal à la
   tête ». Piste : une hiérarchie, un moment fort, le reste attend ou réagit.
5. **Est-ce pauvre ?** Une seule petite action, peu d'amplitude : « il n'y a que la grue qui bouge, ce n'est pas très
   perceptible ». Piste : plusieurs actions nettes, dans des zones différentes, reliées entre elles. « Moins
   d'animation » vise ce qui ne sert pas ; ce n'est pas une demande de tout calmer.
6. **Comprend-on le rôle de chaque élément ?** Un contour, un trait ou une étiquette dont on ne voit pas la raison est du
   bruit. Un mot qui annonce une action (« Validé ») vaut moins que l'action montrée. Piste : retirer, ou montrer.
7. **Quelque chose apparaît-il de nulle part, saute ou se traverse ?** Regarde chaque transition à sa première et à sa
   dernière image. Une ombre avant son objet, un élément visible avant son heure, deux objets qui se croisent, une forme
   qui gonfle depuis rien. Piste : un ordre d'apparition qui dit la cause, une entrée physique.
8. **Est-ce le bon tempo ?** « Trop rapide » se mesure en secondes à l'écran, sous un vrai geste, pas en pixels de
   défilement. Une courbe raide entasse tout au milieu ; trop d'unités qui bougent (des lettres plutôt que des mots)
   paraissent rapides. Un texte piloté par le défilement ne doit jamais traîner derrière le doigt.
9. **Est-ce générique ?** Ce mouvement existerait-il sur n'importe quel site ? Le fondu vers le haut sur chaque bloc, le
   même décalage partout, le zoom au survol, la forme qui suit la souris. Piste : une idée liée au sujet du site,
   poussée plus loin que prévu.
10. **Est-ce cohérent ?** Une partie soignée à côté d'une partie brute « fait tache ». Une matière, une lumière, une
    famille de courbes, un dessin pour tous les boutons. Piste : monter tout au même niveau.
11. **Et si on l'interrompt ?** Clic rapide, changement de sens, survol en passant. Une animation qui repart de zéro ou
    saute est cassée. Piste : partir de l'état où l'élément se trouve.
12. **Est-ce vu cent fois ?** Un geste répété toute la journée (un menu, un bouton) doit être court, ou ne pas bouger du
    tout. Le spectacle se réserve à ce qu'on voit une fois.
13. **Le contenu reste-t-il lisible et à sa place ?** L'animation ne décale rien d'un pixel à la fin, ne cache pas le
    titre ou le bouton, ne pousse pas l'essentiel sous le bas de l'écran. Compare les positions avant et après.
14. **Est-ce que ça tient partout ?** Une saccade se lit comme un défaut, pas comme un effet : 60 images par seconde sur
    un ordinateur moyen (`node scripts/fluidite.mjs page.html`, `--entree 4000` pour une animation d'entrée) et au
    téléphone, sur plusieurs formats (téléphone, tablette en hauteur, ordinateur). Aucun bord net coupant une scène en
    mouvement. Rien qui tourne hors de l'écran.

## Lire un retour humain

- « Plus original » : la même forme, plus de détail. « Plus design » : une composition plus soignée, pas des éléments en
  moins.
- « Rigide » : question 3. « Trop rapide » : question 8. « Bizarre », « trop » : souvent un réglage, pas une idée à jeter.
- Ne surinterprète pas : corrige ce qui est dit, garde le reste.

## Les pièges techniques

Performance, téléphone, vidéo, 3D et réglage « réduire les animations » : `references/pieges.md`, à lire quand la grille
signale un problème de ce côté.
