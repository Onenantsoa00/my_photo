# MyPhoto Mada

Application web de **photobooks pour Madagascar** : livres photo en papier A4, A5, A6
ou carré, avec un **atelier de création en ligne type Canva**.

Le client compose son visuel dans le navigateur (texte, photos, formes, calques,
filtres, fonds à motif) et le commande depuis l'atelier. Le fichier PNG/JPG prêt pour
l'impression 300 dpi se télécharge **uniquement pour l'équipe** (admin) : c'est elle
qui l'imprime et fabrique le livre. Le paiement se fait par **Mobile Money** (MVola,
Orange Money) : le client saisit la référence de SMS reçue, l'administration valide
quand elle reçoit les fonds et annonce le délai de livraison. La production se pilote
depuis un back-office.

---

## 1. Stack technique

| Couche             | Choix                                                  | Pourquoi                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Next.js 16.4** (App Router, React 19, Turbopack)     | Rendu serveur des pages catalogue, Server Actions pour le panier et les commandes, et un Route Handler pour l'upload de fichiers. Un seul déploiement pour la boutique et le back-office. |
| Langage            | **TypeScript 5.9**, mode `strict`                      | Les montants, statuts et documents de l'éditeur sont manipulés partout : le typage évite les régressions silencieuses.                                                                    |
| Interface          | **Tailwind CSS 4**                                     | Palette et composants définis une fois dans `globals.css` via `@theme`, sans bibliothèque de composants à maintenir.                                                                      |
| Base de données    | **PostgreSQL 14** + **Prisma 7.10**                    | Le modèle métier est fortement relationnel (commandes, formats, zones, créations). Prisma apporte les migrations versionnées et les types générés.                                        |
| Éditeur graphique  | **Konva 10 + react-konva 19**                          | Canevas avec hiérarchie de calques, poignées de transformation et surtout `toDataURL({ pixelRatio })`, qui permet l'export à la résolution d'impression réelle.                           |
| Traitement d'image | **sharp 0.35**                                         | Redressement EXIF (photos de téléphone), redimensionnement, conversion WebP, vignettes côté serveur.                                                                                      |
| Authentification   | **jose** (JWT HS256) + **bcryptjs**, cookie `httpOnly` | Sessions signées sans dépendance à un service externe. Le rôle (`CUSTOMER` / `ADMIN`) est porté par le jeton puis revérifié en base à chaque requête.                                     |
| Connexion sociale  | **OAuth 2.0 écrit à la main** (Google, Facebook) + **code à usage unique WhatsApp** | Deux fournisseurs seulement, et `jose` + `fetch` natif suffisent : le flux complet (état signé, PKCE, échange de code) tient dans `src/server/oauth.ts`, sans bibliothèque à maintenir. WhatsApp n'expose pas de « Se connecter avec WhatsApp » : la connexion passe par un code à 6 chiffres envoyé via la WhatsApp Business Cloud API. |
| Photobooks         | Combinaisons papier × orientation × couverture générées dans `src/lib/photobook.ts` | Un photobook est un **produit du catalogue** dont les formats sont générés : le panier, la commande, le back-office et le calcul des 300 dpi fonctionnent sans code spécifique. L'assistant `/creer` et le seed partagent la même source, donc la référence de format ne peut pas diverger. |
| Validation         | **zod 4**                                              | Contrôle des formulaires d'inscription, de connexion et de commande avant toute écriture.                                                                                                 |
| Langues            | Dictionnaire maison **français / malgache**            | Deux langues seulement, quelques centaines de chaînes : `next-intl` aurait ajouté une dépendance et un middleware pour rien.                                                              |
| Vérification       | **puppeteer-core** + Chrome système                    | Parcours réel dans un navigateur (voir §8).                                                                                                                                               |

### Contraintes d'environnement

- **Node.js ≥ 24 obligatoire.** Prisma 7 refuse explicitement les versions intermédiaires
  (l'erreur d'installation est levée par un `preinstall`). Un fichier `.nvmrc` fixe la
  version : `nvm use`.
- **Prisma 7 est ESM.** Le projet est en `"type": "module"`, la configuration passe par
  `prisma.config.ts`, et le client est généré dans `src/generated/prisma` (plus dans
  `node_modules`) : il faut donc importer `@/generated/prisma/client`.

---

## 2. Démarrage

```bash
nvm use                       # Node 24 (voir .nvmrc)
npm install
cp .env.example .env          # puis renseigner DATABASE_URL et AUTH_SECRET
npx prisma generate           # génère le client dans src/generated/prisma
npx prisma migrate dev        # crée les tables
npx prisma db seed            # catalogue + zones de livraison + comptes de démo
npm run dev                   # http://localhost:3000
```

Création d'une base locale si besoin :

```bash
sudo -u postgres psql -c "CREATE ROLE myphoto WITH LOGIN PASSWORD 'myphoto_dev_pwd' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE myphoto OWNER myphoto;"
```

Le rôle doit pouvoir **créer une base** : `prisma migrate dev` s'en sert pour la base
« shadow » qui calcule les différences de schéma.

### Variables d'environnement

| Variable                                                                                                  | Rôle                                                                  |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                            | Chaîne de connexion PostgreSQL.                                       |
| `AUTH_SECRET`                                                                                             | Clé de signature des sessions (32 caractères minimum).                |
| `PAYMENT_MVOLA_NUMBER`, `PAYMENT_ORANGE_MONEY_NUMBER`, `PAYMENT_AIRTEL_MONEY_NUMBER`, `PAYMENT_BANK_IBAN` | Numéros / comptes marchand affichés au client au moment du paiement.  |
| `UPLOAD_DIR`                                                                                              | Dossier de stockage des photos et aperçus (défaut `storage/uploads`). |
| `APP_URL`                                                                                                 | Adresse publique du site, utilisée pour les URL de retour OAuth. Absente, l'origine de la requête est utilisée (développement). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                 | Connexion Google. Redirection à déclarer : `https://votre-domaine/api/auth/google/callback`. Sans ces valeurs, le bouton Google est désactivé avec la variable manquante en infobulle. |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`                                                                   | Connexion Facebook. Redirection à déclarer : `https://votre-domaine/api/auth/facebook/callback`. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`                                                               | Connexion par code WhatsApp (WhatsApp Business Cloud API, Meta). Sans elles, en développement le code est affiché dans la page pour permettre les tests ; en production la connexion WhatsApp répond « non configuré ». |

### Comptes de démonstration

| Rôle           | Identifiant         | Mot de passe  |
| -------------- | ------------------- | ------------- |
| Administrateur | `admin@myphoto.mg`  | `Admin1234!`  |
| Client         | `client@myphoto.mg` | `Client1234!` |

### Commandes

```bash
npm run dev            # serveur de développement
npm run build          # build de production
npm run start          # serveur de production
npm run typecheck      # tsc --noEmit
npm run verify:e2e     # parcours nominal complet dans un vrai Chrome (serveur démarré requis)
npm run probe          # sondes de robustesse : cas limites, entrées forgées, contrôle d'accès
npm run db:migrate     # nouvelle migration
npm run db:seed        # (re)remplit le catalogue
npm run db:studio      # explorateur de base Prisma
```

---

## 3. Base de données

PostgreSQL, schéma déclaré dans `prisma/schema.prisma`, migrations versionnées dans
`prisma/migrations/`. **14 modèles**, **5 énumérations**.

### 3.1 Modèles

| Modèle              | Rôle                            | Points notables                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`              | Compte client ou administrateur | `role` (`CUSTOMER`/`ADMIN`), `passwordHash` bcrypt **optionnel** (compte ouvert par Google, Facebook ou WhatsApp), `email` **optionnel** (un client WhatsApp n'a pas forcément d'adresse), `phone` non unique (voir §3.3, décision 7).                                                                                                                                   |
| `OAuthAccount`      | Identité externe rattachée      | `provider` + `providerAccountId` uniques : un même client peut avoir Google *et* Facebook, et un compte existant peut être relié à un fournisseur sans être dupliqué.                                                                                                                                                                                                          |
| `LoginCode`         | Code de connexion WhatsApp      | `codeHash` (HMAC-SHA256, **jamais le code en clair**), `expiresAt` (5 min), `attempts` (5 essais), `consumedAt`. Sans ces trois compteurs, six chiffres se devineraient en quelques secondes.                                                                                                                                                                                 |
| `Address`           | Carnet d'adresses               | Rattaché à l'utilisateur, supprimé en cascade.                                                                                                                                                                                                                                                                                                                                  |
| `Category`          | Univers du catalogue            | Bilingue (`nameFr` / `nameMg`), `sortOrder` pour l'ordre d'affichage.                                                                                                                                                                                                                                                                                                           |
| `Product`           | Produit vendable                | `basePriceMga` de référence, `leadTimeDays`, `isActive`, `isFeatured`.                                                                                                                                                                                                                                                                                                          |
| `ProductVariant`    | Format / support                | `label` (« 10 × 15 cm »), `widthMm` / `heightMm` — **c'est ce couple qui pilote le format de l'atelier et le calcul des 300 dpi** —, `sku` unique, `priceMga`, `isDefault`.                                                                                                                                                                                                     || `Design` | Création de l'atelier | `document` en `Json` (le document complet, calques et filtres), `canvasWidth/Height` en pixels de travail, `targetWidthMm/HeightMm` pour la cible d'impression, `previewPath` / `thumbnailPath`. Propriété portée par **`userId`** pour un client connecté, ou par **`guestSessionId`** pour un visiteur (voir §3.3, décision 6). |
| `Cart` / `CartItem` | Panier                          | Un panier appartient soit à un `userId`, soit à un `sessionId` de cookie. `unitPriceMga` est **figé** à l'ajout : un changement de tarif ne réécrit pas rétroactivement un panier en cours.                                                                                                                                                                                     |
| `DeliveryZone`      | Zone de livraison               | `feeMga`, `etaDaysMin/Max`, par ville et région.                                                                                                                                                                                                                                                                                                                                |
| `Order`             | Commande                        | Référence lisible unique (`MP-2026-A1B2C3`), coordonnées client **recopiées** (pas de jointure vers `User`, une commande doit rester lisible même si le compte est supprimé), sous-total, frais de port, total, moyen et statut de paiement, `paymentReference` (numéro de transaction Mobile Money) et `paymentTarget` (numéro marchand à créditer, figé pour la traçabilité). |
| `OrderItem`         | Ligne de commande               | **Instantané** du nom produit, du libellé de format et du prix : modifier le catalogue ne réécrit pas l'historique. Lien optionnel vers `Design` et `Product`.                                                                                                                                                                                                                  |
| `OrderEvent`        | Journal de la commande          | Un enregistrement par changement de statut, avec l'auteur (`customer`, e-mail admin, `system`). C'est ce qui alimente la timeline de suivi côté client.                                                                                                                                                                                                                         |

### 3.2 Énumérations

`Role`, `DeliveryMode` (`PICKUP`, `HOME_DELIVERY`), `PaymentMethod`
(`CASH_ON_DELIVERY`, `MVOLA`, `ORANGE_MONEY`, `AIRTEL_MONEY`, `BANK_TRANSFER`),
`PaymentStatus` (`PENDING`, `AWAITING_VERIFICATION`, `PAID`, `FAILED`, `REFUNDED`),
`OrderStatus` (`PENDING`, `CONFIRMED`, `IN_PRODUCTION`, `READY_FOR_PICKUP`,
`SHIPPED`, `DELIVERED`, `CANCELLED`).

### 3.3 Décisions de modélisation

1. **Montants en entiers d'Ariary.** La devise n'a pas de subdivision en circulation :
   pas de flottant, donc pas d'erreur d'arrondi sur les totaux.
2. **Instantanés plutôt que jointures** pour `OrderItem` et les coordonnées de `Order`.
   Une commande est une pièce comptable : elle ne doit pas changer quand le catalogue
   ou l'adresse évolue.
3. **Le libellé de zone est stocké en plus de la clé étrangère** (`deliveryZoneLabel` +
   `deliveryZoneId`) : renommer une zone ne réécrit pas les commandes passées, mais le
   lien reste exploitable pour les statistiques.
4. **`designId` nullable sur `CartItem`** : un tirage peut être commandé sans création
   (le client utilise ses fichiers en boutique), mais l'atelier le signale.
5. **Index** sur `Order(status, createdAt)`, `Order(paymentStatus)`,
   `Order(userId, createdAt)`, `Product(categoryId, isActive)`,
   `Design(userId, updatedAt)` et `Design(guestSessionId, updatedAt)` — ce sont les
   requêtes réelles de l'interface.
6. **`Design.guestSessionId` : pourquoi `userId` seul ne suffisait pas.** Un visiteur
   n'avait pas de compte, donc ses créations avaient `userId = null`. Une clause
   `where: { userId: null }` faisait alors correspondre les créations de **tous** les
   visiteurs entre elles — c'est la cause racine du bug n°1 décrit au §9. Un
   identifiant de session visiteur a donc été ajouté, en réutilisant le cookie
   `mp_cart` déjà en place. Toute lecture ou écriture de création passe par
   `designOwnerWhere()` (`src/server/designs.ts`), qui renvoie `null` — donc un
   refus — quand le visiteur n'a pas encore de session. **Depuis que l'atelier exige
   un compte, cette colonne n'est plus alimentée** : elle est conservée pour les
   créations antérieures, et le contrôle d'accès reste testé entre deux comptes
   (sondes B4/B5).
7. **Le numéro de téléphone n'est pas unique, et c'est assumé pour l'instant.**
   La connexion WhatsApp identifie un compte par son numéro : deux comptes partageant
   un numéro introduiraient une ambiguïté, et c'est le **compte le plus ancien** qui
   est retenu, de façon déterministe. Une contrainte d'unicité a été écartée parce que
   la base de développement contient déjà des doublons (comptes de test créés par les
   scripts) : l'ajouter aurait fait échouer la migration. À traiter avec la
   vérification des numéros, en même temps que les e-mails transactionnels (§10).
8. **`email` et `passwordHash` nullables.** Google et Facebook fournissent une
   adresse, pas WhatsApp : rendre `email` nullable est le seul moyen de représenter
   honnêtement un client « téléphone seul », sans inventer une adresse bidon qui
   polluerait les statistiques et les envois. `passwordHash` l'est par la même
   logique — un compte ouvert par un fournisseur n'a pas de mot de passe.

### 3.4 Jeu de données initial (`npm run db:seed`)

- **6 catégories** : tirages, cadres, albums, objets, cartes, affiches.
- **14 produits** et **61 formats** tarifés en Ariary, de 800 Ar (10 × 15 cm) à
  520 000 Ar (album de mariage 35 × 35). Le produit **`photobook`** apporte à lui
  seul 20 formats : 5 papiers (A5, A4, A3, carré 20 × 20, carré 30 × 30) × 2
  orientations (portrait, paysage) × 2 couvertures (solide, moyen solide).
- **12 zones de livraison** couvrant Antananarivo, Antsirabe, Toamasina,
  Fianarantsoa, Mahajanga, Toliara, Morondava, Antsiranana et Nosy Be,
  de 8 000 à 45 000 Ar.
- **2 comptes** de démonstration.

Le seed est **idempotent** (upserts par `slug` / `sku`) et **ne réécrit jamais les mots
de passe existants** : relancer `db:seed` après un changement de mot de passe
administrateur ne le réinitialise pas.

---

## 4. Ce qui a été fait de crucial

### 4.1 Export d'impression réellement calculé en 300 dpi

C'est la fonctionnalité qui justifie l'atelier. Le plan de travail travaille à une
résolution d'écran confortable (1500 px de large), mais l'export ne réutilise pas ces
pixels : il recalcule le facteur à appliquer pour atteindre 300 dpi sur le support
commandé.

Exemple mesuré : tirage 10 × 15 cm, plan de travail 1500 × 2250 px →
`100 mm / 25,4 × 300 = 1181 px` de large visés ; le facteur tombe sous 1 et est
remonté à 1, ce qui donne **1500 × 2250 px, soit 381 dpi réels**, affichés en direct
sous le canevas. Si la résolution descend sous 200 dpi, l'interface le signale.
Le facteur est plafonné (8×, et 16 000 px de côté) pour ne pas produire un canevas que
les navigateurs refusent de dessiner. Voir `src/lib/editor/export.ts`.

**Ce téléchargement est réservé à l'administration.** Le bouton « PNG » / « JPG » n'est
rendu que si la session est `ADMIN` (`canExport` passé par `/editeur`) : le client voit
une mention « Téléchargement réservé à l'atelier d'impression » et commande depuis le
panier. L'administrateur, lui, ouvre la création du client depuis la fiche commande et
tlécharge le fichier à imprimer. Le rôle est lu côté serveur à l'affichage de la page :
un client ne peut pas réactiver le bouton côté navigateur.

### 4.2 Atelier : modèle de document découplé de Konva

Le document de l'éditeur est un **JSON pur** (`src/lib/editor/types.ts`) sérialisé tel
quel dans `Design.document`. Konva n'est qu'un moteur de rendu parmi d'autres possibles.
Conséquence directe : on peut rouvrir une création plus tard, la réinjecter côté serveur
pour générer des aperçus, ou changer de bibliothèque de canevas sans migrer les données.

Fonctionnalités : texte (police, graisse, alignement, interlettrage, interligne),
photos, 5 formes (rectangle, ellipse, triangle, étoile, ligne), panneau de calques
(réordonnancement, visibilité, verrouillage, duplication, suppression), transformation
à la souris (déplacement, redimensionnement, rotation), filtres image (luminosité,
contraste, saturation, flou, noir et blanc, sépia), annuler/rétablir, 6 modèles de
départ, export PNG et JPG.

L'historique est construit sur un **instantané pris au début d'un geste** : glisser un
calque ne crée qu'une seule entrée d'annulation, pas une par pixel parcouru.

### 4.3 Paiement Mobile Money adapté au marché malgache

Il n'existe pas d'agrégateur unique couvrant MVola, Orange Money et Airtel Money :
chacun exige un contrat marchand séparé. Le flux retenu est donc **déclaratif** :

1. Au moment du paiement, le client voit le numéro marchand correspondant à son
   opérateur et le montant exact à envoyer.
2. Il effectue le transfert, puis saisit le **numéro de transaction** reçu par SMS.
3. La commande part en `AWAITING_VERIFICATION`.
4. Un administrateur compare avec son relevé et valide dans le back-office : la
   commande passe en `PAID` et, si elle était `PENDING`, en `CONFIRMED`.

Toute la configuration est isolée dans `src/lib/payment.ts`. Brancher plus tard une API
de collecte automatique revient à modifier `initialPaymentStatus()` et à ajouter un
webhook : le reste du tunnel ne bouge pas. Le **paiement à la livraison** reste le
moyen par défaut, car c'est le plus courant localement.

### 4.4 Stockage des fichiers hors de `/public`, avec défenses

Les photos clients et les aperçus de créations ne sont **jamais** déposés dans
`public/` : ils vont dans `storage/uploads/<année>/<mois>/<uuid>.webp` et sont servis
par `/api/files/[...path]`.

- `resolveStoragePath()` neutralise les segments `..` et vérifie que le chemin résolu
  reste sous la racine de stockage.
- L'extension est sur liste blanche (`.webp`, `.png`, `.jpg`) : un fichier non image
  n'est jamais renvoyé.
- Les réponses sont en `Cache-Control: immutable` — le nom de fichier contient
  l'empreinte du contenu.
- À l'upload : type MIME contrôlé, 25 Mo maximum, densité limitée à 4000 px, conversion
  WebP, et **redressement EXIF** — sans lui, les photos prises en portrait sur
  téléphone sortiraient couchées à l'impression.

Testé : `../../package.json`, `..%2f..%2f.env`, `../../etc/passwd` et les variantes
encodées renvoient 404 ou 415, jamais le contenu du fichier.

### 4.5 Sessions et panier

JWT HS256 signé avec `AUTH_SECRET`, stocké dans un cookie `httpOnly`, `SameSite=Lax`,
`Secure` en production. Le rôle du jeton est **revérifié en base** à chaque requête
(`getSessionUser()`), donc retirer les droits d'un administrateur est immédiat.

Un visiteur non connecté a un **panier lié à son cookie**. S'il s'inscrit ou se
connecte, `mergeGuestCartIntoUser()` rattache ce panier au compte et fusionne les lignes
identiques : personne ne perd ce qu'il avait mis de côté.

### 4.6 Bilinguisme français / malgache

Le dictionnaire vit dans `src/lib/i18n.ts` (clés typées, une seule source de vérité pour
les deux langues). Le serveur lit la langue dans un cookie et les composants clients
reçoivent la locale par contexte, sans embarquer les deux dictionnaires.

Le **français est la langue par défaut**, le malgache est accessible par le sélecteur
FR/MG de l'en-tête.

### 4.7 Pièges rencontrés et traités

| Problème                                                                                 | Traitement                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Prisma 7 refuse Node 23 (`^20.19 \|\| ^22.12 \|\| >=24`)                                 | Node 24 LTS installé et `.nvmrc` + `engines` ajoutés.                                                                                      |
| `npm` bloque les scripts d'installation (`preinstall` Prisma, `postinstall` esbuild)     | `npm install-scripts approve @prisma/engines esbuild prisma`.                                                                              |
| Prisma 7 : plus d'import de `.env`, plus de `output` implicite, plus de seed automatique | `prisma.config.ts` avec `import "dotenv/config"`, générateur `prisma-client` avec `output`, et `prisma db seed` lancé explicitement.       |
| Prisma 7 impose un _driver adapter_                                                      | `@prisma/adapter-pg` + `pg` dans `src/lib/prisma.ts`, avec un singleton pour ne pas ouvrir un pool à chaque rechargement en développement. |
| `prisma migrate dev` échoue faute de base « shadow »                                     | `ALTER ROLE myphoto CREATEDB`.                                                                                                             |
| Tailwind 4 interdit `@apply` sur une classe personnalisée                                | Les classes `.btn-*` et `.badge-*` partagent la base par une liste de sélecteurs.                                                          |
| Turbopack traçait tout le projet à cause du chemin de stockage dynamique                 | `storageUrl()` isolé dans `src/lib/storage-url.ts` (sans `node:fs`) et marqueur `turbopackIgnore`.                                         |
| `react-konva` ne peut pas être rendu côté serveur                                        | Import dynamique `ssr: false` depuis le composant client de l'atelier.                                                                     |

### 4.8 Assistant photobook : le format est choisi avant d'ouvrir l'atelier

« Commencer une création » n'ouvre plus un canevas vierge : l'assistant `/creer` pose
quatre questions, dans cet ordre, et l'atelier s'ouvre ensuite **au bon format**.

| Étape           | Choix                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Taille du papier | A5, A4, A3, carré 20 × 20, carré 30 × 30                                                                 |
| Orientation      | Portrait ou paysage (les dimensions sont inversées, le prix ne change pas)                              |
| Couverture       | Solide (cartonnée, +45 000 Ar) ou moyen solide (semi-rigide)                                            |
| Point de départ  | Page blanche, modèle précis (8 mises en page de livre) ou thème (5 thèmes de 3 à 4 mises en page)        |

Le choix n'est pas qu'un filtre d'interface : il devient le **format du catalogue**
utilisé ensuite par le panier et la commande. Papier × orientation × couverture =
20 formats `photobook-<papier>-<orientation>-<couverture>` générés par
`src/lib/photobook.ts`, la même source pour le seed et pour l'assistant. La référence
transmise à l'atelier (`?product=photobook&variant=…&template=…`) est donc toujours
cohérente avec ce que le client a vu, y compris le prix affiché à l'écran, qui est
**lu** dans le catalogue et non recalculé dans le navigateur.

Côté atelier, le modèle choisi est adapté au format commandé par `fitDocument()` :
mise à l'échelle uniforme puis recentrage, pour ne pas déformer les textes. Un A3
paysage donne un plan de travail de 1500 × 1061 px, et l'export reste calculé en 300 dpi
sur 42 × 29,7 cm.

### 4.9 Création réservée aux comptes, et trois moyens d'y entrer

Le catalogue se consulte librement ; la création, non. `/creer` et `/editeur` renvoient
un visiteur vers `/connexion?next=…`, et le retour le ramène exactement là où il
s'était arrêté (le `next` est validé : seuls les chemins internes sont acceptés, sinon
la connexion deviendrait une redirection ouverte).

Trois entrées, en plus de l'e-mail et du mot de passe :

- **Google** — OAuth 2.0 avec PKCE (`code_verifier` / `code_challenge` S256) ;
- **Facebook** — OAuth 2.0 sans PKCE (non supporté par le fournisseur) ;
- **WhatsApp** — pas de « Se connecter avec WhatsApp » chez Meta : le parcours est un
  **code à 6 chiffres** envoyé par la WhatsApp Business Cloud API, valable 5 minutes,
  5 essais, 3 demandes par quart d'heure et par numéro. Le code n'est jamais stocké en
  clair (HMAC-SHA256 avec `AUTH_SECRET`) et n'est utilisable qu'une fois.

Deux points de sécurité qui ne se devinent pas en lisant le code de plus près :

1. **Le retour après connexion voyage dans le jeton d'état signé, jamais dans l'URL du
   callback.** Un `next=https://ailleurs.test` est donc impossible à faire aboutir, même
   en forgeant la requête de retour — la sonde S13 le vérifie.
2. **Le rattachement automatique à un compte existant n'a lieu que si le fournisseur
   garantit l'adresse** (Google `email_verified`). Facebook ne renvoie pas cette
   information : préférer un message d'erreur explicite (« connectez-vous avec votre mot
   de passe ») à un rattachement silencieux, qui permettrait à un tiers de revendiquer un
   compte en créant une identité au même e-mail.

En développement, si aucun jeton WhatsApp n'est configuré, le code est **affiché dans la
page** avec un avertissement : c'est le seul moyen de tester le parcours sans compte
WhatsApp Business. En production, ce comportement est désactivé et l'API répond
« non configuré » (variable manquante nommée à la fois dans l'interface et dans le
message d'erreur).

---

## 5. Structure

```
prisma/
  schema.prisma          14 modèles, 5 énumérations
  migrations/            migrations versionnées
  seed.ts                catalogue, zones, comptes de démonstration
prisma.config.ts         configuration Prisma 7 (schéma, seed, URL)
scripts/e2e.mjs          parcours nominal complet dans Chrome
scripts/probe.mjs        sondes de robustesse (entrées forgées, contrôle d'accès)
src/
  app/
    (site)/              vitrine : accueil, produits, panier, commande, compte, admin
      creer/             assistant photobook (papier, orientation, couverture, départ)
      layout.tsx         en-tête + pied de page
    editeur/             atelier plein écran, hors du gabarit vitrine
    api/auth/            démarrage et retour des connexions Google, Facebook, WhatsApp
    api/uploads/         réception des photos
    api/files/[...path]  service des fichiers stockés
    icon.svg             favicon
  components/editor/     atelier : canevas, calques, réglages, modèles, aperçus
  components/photobook/  assistant de création (4 étapes)
  components/social-auth.tsx  boutons Google / Facebook / WhatsApp
  lib/editor/            modèle de document, modèles de départ, calcul d'export
  lib/photobook.ts       papiers, orientations, couvertures, prix et références
  lib/return-to.ts       validation du retour après connexion (`next`)
  lib/i18n.ts            dictionnaire FR / MG
  lib/payment.ts         moyens de paiement et règles Mobile Money
  server/oauth.ts        flux OAuth 2.0 Google et Facebook (état signé, PKCE)
  server/whatsapp.ts     codes de connexion, normalisation des numéros, envoi
  server/                accès base, sessions, panier, et Server Actions
  generated/prisma/      client Prisma généré (ignoré par git)
storage/uploads/         photos et aperçus (ignoré par git)
```

Le groupe de routes `(site)` porte l'en-tête et le pied de page ; `/editeur` en est
volontairement exclu pour occuper tout l'écran.

---

## 6. Parcours utilisateur

1. **Accueil** — univers, produits les plus commandés, fonctionnements, moyens de paiement.
   Le bouton « Commencer une création » mène à l'assistant, pas directement à l'atelier.
2. **Produits** — 6 catégories, prix « à partir de » calculé sur les formats actifs.
3. **Fiche produit** — choix du format, quantité, total recalculé en direct, et un bouton
   qui ouvre l'atelier **avec le produit et le format déjà préselectionnés**.
4. **Compte obligatoire** — à la première création, le visiteur est envoyé vers
   `/connexion` (ou `/inscription`), puis ramené exactement sur la page demandée.
5. **Assistant photobook** — papier, orientation, couverture, point de départ
   (page blanche, modèle ou thème), avec le prix du format affiché en direct.
6. **Atelier** — le canevas s'ouvre au format choisi, avec le modèle adapté si un thème a
   été retenu. Puis « Commander cette création » : la création est enregistrée et ajoutée
   au panier.
7. **Panier / Commande** — quantité, zone de livraison (frais et délai affichés), moyen
   de paiement, récapitulatif.
8. **Suivi** — référence `MP-AAAA-XXXXXX`, timeline des statuts, instruction de paiement
   si Mobile Money.
9. **Compte** — commandes et créations enregistrées, rouvrables dans l'atelier.
10. **Back-office** — indicateurs (CA encaissé, commandes à traiter, paiements à vérifier),
    validation des paiements Mobile Money, changement de statut, édition des prix,
    des produits et des zones de livraison.

---

## 7. Sécurité

- Mots de passe hachés en **bcrypt** (10 tours), jamais renvoyés par une requête.
- Sessions **JWT signées** dans un cookie `httpOnly` ; rôle relu en base à chaque requête.
- Le back-office est protégé **deux fois** : par son layout et par `assertAdmin()` au
  début de **chaque** Server Action. Masquer un bouton ne suffit jamais.
- Toute mutation passe par une Server Action validée par **zod** avant écriture.
- Une commande nominative n'est consultable que par son propriétaire ou l'équipe ; les
  commandes invitées restent accessibles par leur référence.
- **Toute création est vérifiée avant d'être rattachée** à un panier ou rouverte dans
  l'atelier : un identifiant fourni par un formulaire n'est jamais considéré comme une
  preuve de propriété (`assertOwnsDesign()`). Un visiteur ne peut donc pas rattacher la
  composition d'un autre à sa commande.
- Aucun secret n'est exposé au navigateur : les numéros marchand sont passés au
  formulaire en propriétés, jamais en variables `NEXT_PUBLIC_`.
- **L'atelier et l'assistant exigent une session** : plus aucune écriture de création
  n'est possible sans compte, donc plus aucune donnée n'est rattachée à un cookie
  anonyme.
- **Connexion externe** : l'état du flux OAuth est signé (HS256) et conservé dans un
  cookie `httpOnly` de 10 minutes ; le nonce reçu est comparé à celui du cookie, ce qui
  bloque un retour forgé depuis un autre site (CSRF). Google utilise PKCE. Les jetons
  d'accès des fournisseurs ne sont jamais persistés : ils ne servent qu'à lire le profil.
- **Codes WhatsApp** : stockés en HMAC-SHA256, valables 5 minutes, 5 essais, 3 demandes
  par quart d'heure et par numéro, comparaison à temps constant et usage unique.
- **`next` validé** avant tout `redirect()` : chemin interne commençant par un seul `/`,
  sans caractère de contrôle (`sanitizeReturnTo()`, `src/lib/return-to.ts`).
- **Connexion par mot de passe** : le message d'erreur reste générique, y compris pour un
  compte sans mot de passe (créé par un fournisseur). Distinguer les deux cas révélerait
  quelles adresses existent déjà.

---

## 8. Vérification

```bash
npm run typecheck      # 0 erreur
npm run build          # 23 routes, aucun avertissement
npm run dev            # puis, dans un autre terminal :
npm run verify:e2e     # parcours nominal
npm run probe          # sondes de robustesse
```

> **À lancer depuis `http://localhost:3000`, jamais `http://127.0.0.1:3000`.**
> Avec l'adresse IP littérale, le canal HMR du serveur de développement Next 16 est
> refusé (`net::ERR_INVALID_HTTP_RESPONSE`) et **plus aucun composant client ne
> s'hydrate** : les clics sont silencieusement perdus, sans erreur JavaScript. Les deux
> scripts utilisent donc `localhost` par défaut, et `BASE_URL` permet de viser autre
> chose. C'est un piège d'environnement, pas un défaut de l'application — voir §9, bug n°6.

`scripts/e2e.mjs` pilote un **vrai Chrome** (aucun navigateur téléchargé, il utilise
celui du système) et exécute **72 vérifications** :

- catalogue et tarifs lus depuis PostgreSQL, total recalculé selon le format et la
  quantité ;
- **garde d'accès** : `/creer` et `/editeur` renvoient un visiteur vers la connexion en
  conservant la destination, et l'inscription ramène directement sur l'assistant ;
- **assistant photobook** : A3, paysage, couverture moyen solide, thème Mariage, jusqu'à
  l'atelier ouvert en 1500 × 1061 px (42 × 29,7 cm) avec les 6 calques du modèle ;
- **connexion WhatsApp** : demande de code, lecture du code de développement, ouverture de
  session, puis refus d'un code erroné ;
- atelier : rendu du canevas Konva, calcul des 300 dpi, upload d'une photo générée par
  sharp et service effectif du fichier en `image/webp`, filtre de luminosité appliqué au
  clavier, **déplacement d'un calque à la souris** avec position resynchronisée dans le
  panneau de réglages, application d'un modèle ;
- commande complète avec MVola puis paiement en attente de vérification ;
- compte : commande **et** création du photobook retrouvées dans l'espace du client ;
- back-office, validation du paiement, édition des produits (14) et des zones ;
- bascule en malgache ;
- absence d'erreur JavaScript et de ressource manquante.

Dernier passage : **72/72**.

Une vérification complémentaire de **50 contrôles** (nouveaux modèles, fond à motif,
cadrage des photos, suivi de commande, vitrine, recherche et tri du back-office,
notifications, thème, langue, responsive) a été jouée lors de la dernière campagne :
**50/50**. Ses anomalies sont documentées en §9.

```
PASS  Assistant : orientation paysage prise en compte (42 cm × 29,7 cm) — dimensions inversées
PASS  Atelier : plan de travail au format A3 paysage (1500×1061 px)
PASS  WhatsApp : compte ouvert par le code et session active — compte Client WhatsApp
PASS  Upload : photo servie par /api/files — image/webp — 200
PASS  Atelier : calque déplacé à la souris et position synchronisée — X 150 → 400
PASS  Admin : paiement validé
...
72/72 vérifications passées.
```

La protection contre la traversée de chemin a en outre été vérifiée à la main :
`/api/files/../../package.json`, `/api/files/..%2f..%2f.env` et
`/api/files/../../etc/passwd` renvoient 404 ou 415, sans jamais laisser filtrer de
contenu.

### 8.1 Sondes de robustesse (`npm run probe`)

`scripts/e2e.mjs` suit le chemin prévu ; `scripts/probe.mjs` fait l'inverse. Il **attaque**
l'application pour révéler ce que le parcours nominal ne montre jamais : identifiants
forgés, valeurs hors bornes, accès croisés entre comptes, codes devinés, fichiers
malformés. **40 à 42 sondes** selon que Google est configuré ou non sur le serveur testé
(la sonde lit la réponse du serveur au lieu de deviner sa configuration) :

| Sonde | Ce qu'elle tente | Résultat attendu |
|---|---|---|
| S1–S5 | upload sans fichier, script déguisé, image corrompue, fichier de 26 Mo, extension interdite | 400 / 415 / 422 / 413 / 415 |
| S6–S8 | produit inconnu, back-office en invité, référence de commande inconnue | 404 / 307 → `/connexion` / 404 |
| S9 / S10 | ouvrir `/editeur` puis `/creer` sans compte | 307 → `/connexion`, destination conservée |
| S11 | démarrer la connexion Google | 307 vers le fournisseur avec `state` et PKCE S256, ou message « non configuré » |
| S12 | renvoyer un état OAuth forgé | 307 → `/connexion?erreur=etat`, aucune session |
| S12b / S12c | état valide + code bidon | échec d'échange maîtrisé, **aucun compte créé** |
| S13 | `next=https://exemple.test/phishing` | redirection interne uniquement |
| S14 / S15 | numéro WhatsApp invalide, corps illisible | 400 sans erreur serveur |
| S16 | demander quatre codes pour le même numéro | 429 après trois demandes |
| S17 | cinq essais infructueux puis le bon code | code invalidé, refus |
| B1 | ouvrir le tunnel de commande avec un panier vide | redirection vers `/panier` |
| B2 | forger `productId` **et** `variantId` dans le formulaire d'ajout | aucune ligne créée |
| B3 | forger `quantity = 999999` | plafonnée à 500 |
| B3b | vérifier que la création d'un client est réellement écrite | 1 ligne créée, rattachée au **compte** |
| B4 | injecter l'identifiant de création d'un autre client dans le panier | refusé |
| B5 / B5b | essayer de rouvrir cette création | refusé pour l'attaquant, **autorisé pour le propriétaire** |
| B6 / B7 | encaisser une commande payée à la livraison | contrôle présent, `PAID` + `paidAt` + CA compté |
| B8 | retrait en boutique | frais nuls, `total = sous-total` |
| B9 / B10 / B11 | livraison sans zone, MVOLA sans numéro de transaction, numéro trop court | commande refusée |
| B12 | ouvrir la commande nominative d'un autre client | 404 |
| B13 / B14 / B15 | e-mail déjà pris, mot de passe de 5 caractères, mauvais mot de passe | refusés |
| B16 | accéder à `/admin` en tant que client connecté | redirigé |
| B17 | soumettre deux fois le formulaire de commande | pas de doublon |
| B18 / B18b | un client ouvre l'atelier, puis l'administrateur télécharge | côté client : 0 bouton d'export et message « réservé » ; côté admin : 2 boutons, export exécuté sans erreur |
| B19 | enregistrer un canevas vide | aucune erreur, aucune création vide en base |
| B20 | commande invitée puis inscription avec le même e-mail | non rattachée (comportement assumé, voir §10) |

Derniers passages : **40 sondes (sans Google configuré) et 42 sondes (avec), 0 bug,
1 avertissement documenté** dans les deux cas.

---

## 9. Simulation : bugs trouvés et corrigés

Les anomalies ci-dessous ont été **observées**, pas déduites d'une lecture de code :
chacune a d'abord été reproduite par une sonde, puis corrigée, puis la sonde a été
rejouée. Le détail des allers-retours est donné à la fin de la section. Les anomalies
1 à 5 datent de la première campagne ; les anomalies 6 à 9 de la campagne « photobooks et
connexion sociale » (voir la sous-section « Anomalies de la campagne photobooks ») ; les
anomalies 10 et 11, la campagne « atelier, vitrine et commande » ; l'anomalie 12, la
campagne « téléchargement réservé à l'équipe ».

### Bug n°1 — Un visiteur pouvait s'attribuer la création d'un autre

**Gravité : élevée.** Sonde B4 : en remplaçant la valeur du champ caché `designId` du
formulaire « Ajouter au panier » par l'identifiant d'une création appartenant à un autre
visiteur, cette création était bel et bien rattachée au panier de l'attaquant. Sonde B5 :
`GET /editeur?design=<id>` rechargeait la composition d'un autre visiteur.

**Cause racine.** `Design.userId` vaut `null` pour un visiteur, donc la clause
`where: { userId: user?.id ?? null }` faisait correspondre les créations de **tous** les
visiteurs entre elles — le commentaire du code affirmait exactement l'inverse de ce qu'il
faisait. Aggravant : `addToCartAction` n'effectuait **aucun** contrôle de propriété sur le
`designId` reçu du formulaire, et faisait donc confiance à une donnée du client.

**Correctif.** Nouvelle colonne `Design.guestSessionId` (migration
`20261016194653_scope_guest_designs_to_session`), alimentée par le cookie de session
visiteur `mp_cart` qui existait déjà. `designOwnerWhere()` centralise la règle
d'appartenance et **refuse** (renvoie `null`) quand le visiteur n'a pas encore de session.
`assertOwnsDesign()` est appelé par `addToCartAction` avant tout rattachement, et
`saveDesignAction` ne réutilise un enregistrement que s'il appartient déjà à l'appelant.

**Après correctif :** B4 « refusé », B5 « 0 calque chargé », **B5b « 1 calque
restauré »** — le propriétaire légitime n'est pas bloqué par le durcissement.

**Impact résiduel :** les créations écrites avant la migration ont
`guestSessionId = null` et ne sont plus ouvrables par un visiteur. Concerne uniquement les
données de développement.

### Bug n°2 — Aucune commande payée à la livraison ne pouvait être encaissée

**Gravité : élevée.** Sondes B6 et B7 : le back-office n'affichait le bloc de validation
que pour `paymentStatus = AWAITING_VERIFICATION`. Or une commande payée à la livraison
reste en `PENDING`, et aucun autre contrôle n'existait pour la passer en « Payée ».

**Conséquence mesurée :** l'indicateur « Chiffre d'affaires payé » excluait **toute** la
part encaissée à la livraison. Au moment de la mesure, il affichait 379 000 Ar alors que
la commande payée à la livraison testée, à elle seule, valait 415 800 Ar et n'était donc
comptabilisée nulle part. Le moyen de paiement le plus courant à Madagascar était
invisible dans les statistiques.

**Correctif.** Le bloc d'encaissement s'affiche dès que le paiement est `PENDING` **ou**
`AWAITING_VERIFICATION`, avec un libellé et des champs adaptés (le numéro de transaction
n'a pas de sens pour des espèces). `reviewPaymentAction` renseigne `paidAt` et fait passer
la commande de `PENDING` à `CONFIRMED`.

**Après correctif :** `paiement=PAID · statut=CONFIRMED · payé le=renseigné · CA
compté=415 000 Ar`.

### Bug n°3 — Message d'erreur trompeur en cas d'échec d'enregistrement de commande

**Gravité : faible.** `createOrderAction` renvoyait la clé `checkout.placeOrder`, c'est-à-dire
le libellé du bouton « Confirmer la commande » (« Alaina ny baiko » en malgache). En cas
d'échec réel, le client aurait lu une invitation à cliquer plutôt qu'une erreur. Clé
`checkout.orderFailed` ajoutée dans les deux langues.

### Bug n°4 — Champ téléphone absent : inscription rejetée sans message exploitable

**Gravité : faible.** `formData.get("phone")` renvoie `null` pour un champ absent, valeur
que `z.string().optional()` **refuse** (il n'accepte que `undefined`). Le formulaire envoie
toujours le champ, donc le cas ne se produisait pas par l'interface, mais toute autre
source aurait échoué avec une erreur de champ incompréhensible. Normalisé en `undefined`.

### Bug n°5 — Compteur de produits annoncé comme « formats disponibles »

**Gravité : cosmétique.** La page d'accueil affichait « 3 formats disponibles » sous une
catégorie contenant 3 **produits**. Clés `products.productCount` et
`products.productCountPlural` ajoutées dans les deux langues.

### Défauts trouvés dans les scripts de vérification eux-mêmes

À signaler par honnêteté : pendant cette campagne, trois défauts de l'outillage ont rendu
la vérification temporairement **menteuse**, et les corriger a compté autant que corriger
l'application.

1. **Une sonde passait au vert en testant une ligne périmée.** Elle ne vérifiait pas que
   l'enregistrement de la création avait réussi, puis allait chercher « la création
   anonyme la plus récente » en base — qui datait d'avant la migration. Elle a donc
   rapporté des succès sans rapport avec le code testé. La sonde B3b, ajoutée pour
   combler ce trou, a immédiatement révélé la vraie cause : **le serveur de développement
   gardait l'ancien client Prisma en cache sur `globalThis`**, donc l'écriture du nouveau
   champ échouait. À retenir : **redémarrer `next dev` après tout changement de
   schéma Prisma.**
2. **Les champs de contact préremplis faussaient les saisies.** Pour un client connecté,
   `#customerName` et `#customerEmail` arrivent remplis ; `page.type()` concaténait donc
   un second e-mail et produisait une adresse invalide, faisant échouer des commandes qui
   auraient dû passer. Les champs sont désormais vidés avant saisie.
3. **Trois contextes navigateur étaient fermés via une propriété inexistante**
   (`context.close()` sur un objet qui *est* déjà le contexte), ce qui interrompait la
   sonde au milieu du scénario.

### Anomalies de la campagne « photobooks et connexion sociale »

#### Bug n°6 — L'outillage de vérification passait à côté de tout clic

**Gravité : moyenne, mais insidieuse.** Les contrôles sur l'assistant échouaient avec
« élément introuvable », et pourtant les boutons étaient bien dans la page :
`aria-pressed` ne basculait jamais. Diagnostic : **aucun composant client ne s'hydratait**
dans ce navigateur.

**Cause racine.** Les scripts visaient `http://127.0.0.1:3000`. Sur Next 16 en
développement, le canal HMR (`ws://…/_next/hmr`) est alors refusé
(`net::ERR_INVALID_HTTP_RESPONSE`) et le client ne prend jamais la main. Aucun message
d'erreur : seulement des clics sans effet.

**Preuve que l'application n'était pas en cause :** la même vérification a été jouée sur
un composant client **non modifié** (le choix de format de la fiche produit, qui
recalcule le total). En `127.0.0.1` le total ne bougeait pas (800 Ar → 800 Ar) ; en
`localhost` il passait bien à 5 000 Ar.

**Correctif.** `BASE_URL` vaut `http://localhost:3000` par défaut dans les deux scripts,
avec un commentaire qui explique pourquoi — sans lui, la prochaine personne à voir un
contrôle échouer serait tentée de « corriger » du code sain.

#### Bug n°7 — Une action du back-office ignorée en silence

**Gravité : moyenne.** `assertAdmin()` renvoyait l'e-mail de l'administrateur, et
`updateOrderStatusAction` commence par `if (!actor) return;`. Depuis que l'e-mail peut
être absent (compte ouvert via un fournisseur), un administrateur sans adresse faisait
échouer **silencieusement** tout changement de statut : l'écran ne signalait rien, le
statut ne changeait pas.

**Correctif.** L'acteur journalisé est désormais `email ?? phone ?? \`admin:<id>\`` :
jamais vide, donc jamais d'action avalée sans trace dans `OrderEvent`.

#### Bug n°8 — « null » affiché comme adresse dans l'espace client

**Gravité : cosmétique.** Pour un compte ouvert par WhatsApp, la page `/compte`
affichait « Connecté en tant que Client WhatsApp · null ». Corrigé : l'adresse n'est
affichée que si elle existe, sinon le numéro de téléphone.

#### Bug n°9 — Deux comptes peuvent partager un numéro de téléphone

**Gravité : faible aujourd'hui, réelle demain.** La connexion WhatsApp retrouve un
compte par son numéro ; la contrainte d'unicité n'a pas pu être ajoutée (doublons déjà
présents en base, voir §3.3 décision 7). Le comportement est **déterministe** (le compte
le plus ancien est retenu) mais un numéro partagé connecterait le client sur le premier
compte créé avec ce numéro.

**Non corrigé, assumé** : la correction passe par la vérification des numéros et le
nettoyage des doublons, en même temps que les e-mails transactionnels (§10).

#### Défauts trouvés dans les sondes elles-mêmes

1. **Cinq sondes ne testaient plus rien.** B3b, B4, B5 et B5b reposaient sur des
   créations de **visiteur**. Depuis que l'atelier exige un compte, elles auraient été
   redirigées vers `/connexion` — et B5 (« 0 calque chargé ») aurait rapporté un succès
   en n'ouvrant aucun document, tandis que B3b aurait lu une ligne périmée en base.
   Toutes quatre ont été réécrites entre **deux comptes**: un client enregistre une
   création, un second tente de se l'attribuer (panier puis atelier), le propriétaire
   rouvre la sienne. B3b vérifie maintenant que la création est rattachée au **compte**.
2. **Une sonde a rapporté un faux bug.** S11 déduisait la configuration du serveur de
   ses propres variables d'environnement. Lancée sans clés Google contre un serveur qui
   en avait, elle a signalé un bug inexistant (redirection vers `accounts.google.com` au
   lieu de « non configuré »). Elle lit désormais la réponse du serveur et vérifie la
   forme de cette réponse : plus de dépendance à la façon dont le serveur a été lancé.
3. **Les champs préremplis faussaient les saisies du parcours de commande.** Le e2e
   s'inscrivait **après** la commande ; comme l'inscription a été déplacée **avant** la
   création (le compte est désormais obligatoire), les champs de contact arrivaient
   remplis et `type()` concaténait la saisie. `scripts/e2e.mjs` a reçu le même helper
   `setField()` que `scripts/probe.mjs`, qui vide le champ avant de saisir.

### Anomalies de la campagne « atelier, vitrine et commande »

Cette campagne a ajouté les nouveaux modèles, l'agrandissement / réduction / ajustement du
fond à motif, le cadrage des photos dans chaque forme, le suivi de commande côté client,
les meilleures ventes et le catalogue vitrine, la rubrique « Produit », les champs
obligatoires de commande, le retrait en boutique grisé, la recherche et le tri du
back-office, et la notification d'enregistrement. La vérification finale porte sur
**50 contrôles** (modèles, fond, cadrage, commande, suivi, vitrine, back-office, thème,
langue, responsive, absence d'erreur JavaScript) : **50/50 au dernier passage**.

#### Bug n°10 — La notification « Modifications enregistrées » restait affichée en permanence

**Gravité : moyenne (ergonomie).** Reproduit : après un enregistrement dans le
back-office, la notification apparaissait bien, mais 3,2 s plus tard elle était toujours à
l'écran et l'adresse conservait `?saved=1`.

**Cause racine.** `AdminToast` faisait **tout** dans un unique `useEffect` dépendant de
`saved` : affichage, nettoyage de l'adresse **et** minuteur de masquage. Le
`router.replace` qui retire `saved` de l'adresse modifie `saved` → React relance l'effet
et exécute le nettoyage du précédent : le `window.clearTimeout` annulait le minuteur avant
qu'il ne se déclenche. Le `if (!saved) return` suivant ne laissait plus rien régler,
`visible` restait donc `true` jusqu'au rechargement de la page.

**Correctif.** Trois effets séparés : l'un affiche, l'un nettoie l'adresse, un troisième
(ne dépendant que de `visible`) masque après 2,8 s. Le nettoyage d'adresse ne peut plus
annuler le minuteur.

**Après correctif :** notification affichée → adresse nettoyée → notification disparue
seule : les trois contrôles passent.

#### Bug n°11 — Le libellé « numéro de transaction » survivait au passage à « référence de SMS »

**Gravité : faible, mais contradictoire avec la consigne.** Le champ portait déjà
« Référence de SMS », mais l'aide du bloc Mobile Money (« …saisissez le numéro de
transaction reçu par SMS ») et l'étape 3 des instructions gardaient l'ancienne
formulation — en français **et** en malgache.

**Correctif.** Les trois chaînes réécrites dans les deux langues. La vérification
contrôle désormais que « numéro de transaction » n'apparaît **plus** sur la page de
commande et que le libellé du champ vaut exactement « Référence de SMS ».

#### Défauts trouvés dans la simulation de cette campagne

1. **L'empreinte du canevas ne regardait qu'un calque.** Konva superpose un canevas par
   calque (fond, puis objets) : l'empreinte ne prenait que le premier. Tous les contrôles
   « la photo change-t-elle ? » échouaient alors que le rendu était correct — un faux bug
   pris au départ pour une régression du cadrage. L'empreinte agrège désormais tous les
   canevas.
2. **Un clic sur « Photobook » n'aboutissait pas.** Le libellé existe trois fois dans le
   catalogue (sommaire, carte produit, navigation) ; le test cliquait sur l'ancre de
   sommaire, qui ne change pas d'adresse. Ciblage par la carte qui contient un visuel.
3. **Un formulaire sur deux dans les lignes de zone.** Chaque ligne porte « Enregistrer »
   **et** « Supprimer », tous deux avec un champ `zoneId` : le test choisissait le premier
   trouvé — celui de suppression. Ciblage conditionné à la présence du champ de tarif.
4. **La connexion admin était vérifiée par une condition toujours vraie.**
   `pathname.startsWith("/")` est vrai sur toutes les pages : un échec de connexion
   passait inaperçu et se révélait plusieurs étapes plus loin par « formulaire
   introuvable ». Condition remplacée par « la page n'est plus sur /connexion ».
5. **Un identifiant d'action serveur périmé pendant une recompilation.** Juste après la
   modification d'un fichier importé par le formulaire, le HTML servi contenait encore
   l'ancien identifiant : la soumission partait sans erreur, sans session et sans
   redirection — un échec **silencieux**, longtemps faussé pour un vrai bug de
   connexion. Écarté par une requête HTTP brute rejouée à la main (elle rend bien
   **303 + cookie `mp_session`**), puis par l'attente de la fin de la recompilation.
   À retenir : ne lancer aucune vérification juste après une modification de fichier.
6. **Un double `pool.end()`** faisait planter le script en fin d'exécution et masquait le
   rapport des vérifications.

### Anomalies de la campagne « téléchargement réservé à l'équipe »

#### Bug n°12 — La création d'un client s'ouvrait vierge pour l'administrateur

**Gravité : moyenne.** `getOwnedDesign()` n'acceptait que le propriétaire de la
création. Or la fiche commande admin propose un lien « 🎨 titre de la création » vers
`/editeur?design=<id>` : pour un administrateur, la clause d'appartenance ne
correspondait jamais et l'atelier s'ouvrait sur un **document vierge**, sans aucun
message. Impossible, dans cet état, de télécharger le fichier à imprimer — le cas
d'usage de la fonctionnalité. L'anomalie est constatée sur la règle de propriété en
place (inventée pour le bug n°1), puis le comportement corrigé est vérifié en
navigateur.

**Correctif.** `DesignOwner.admin` est renseigné depuis le rôle de session : un
administrateur charge n'importe quelle création, et son enregistrement se pose sur
l'enregistrement d'origine (`saveDesignAction`) au lieu de créer une copie au nom de
l'équipe. Aucun autre rôle n'a ce passe-droit ; l'atelier reste réservé aux comptes
connectés, et l'appartenance des clients entre eux n'a pas bougé (sondes B4 / B5).

**Vérification :** côté client, 0 bouton d'export et la mention « Téléchargement réservé
à l'atelier d'impression » (sonde B18) ; côté admin, 2 boutons, ouverture de la création
du client et export en 3508 × 2481 px (A4 à 300 dpi) sans erreur JavaScript (sonde
B18b + contrôle ciblé 7/7).

### Bugs non corrigés, assumés et documentés

| Point | Pourquoi il n'est pas corrigé |
|---|---|
| Une commande passée en **invité** n'est pas rattachée au compte créé ensuite avec le même e-mail (sonde B20). Elle reste consultable par sa référence. | Le rattachement automatique par e-mail serait une faille tant qu'il n'y a **pas de vérification d'adresse** : n'importe qui pourrait revendiquer les commandes d'un tiers. À traiter en même temps que les e-mails transactionnels. |
| **Aucune limitation du nombre de tentatives de connexion.** | Nécessite un compteur par IP et par compte (Redis ou table dédiée) : c'est un chantier à part, à faire avant la mise en production. |
| Références de commande invitées courtes (`MP-AAAA-XXXXXX`, 3 octets). | Suffisant contre l'énumération fortuite, pas contre un balayage déterminé. Des références plus longues casseraient la lisibilité au téléphone. |
| **Deux comptes peuvent partager un numéro de téléphone** (bug n°9). | La contrainte d'unicité n'a pas pu être ajoutée : des doublons existent déjà en base, hérités des comptes de test des scripts. À traiter avec la vérification des numéros. |
| **Le code WhatsApp est affiché dans la page en développement** quand aucun fournisseur n'est configuré. | Impossible de tester le parcours autrement sans compte WhatsApp Business. Le comportement est désactivé dès que `NODE_ENV=production`, et l'avertissement est affiché dans l'interface. |
| **Aucune possibilité de relier un compte existant à Google/Facebook depuis l'interface.** | Le rattachement automatique par adresse n'a lieu que si le fournisseur garantit l'adresse. Un client qui a déjà un mot de passe et clique sur « Facebook » reçoit un message explicite plutôt qu'une fusion silencieuse (voir §4.9). |

---

## 10. Limites connues et suites

### Améliorations proposées, par ordre d'impact

1. **Éditeur de photobook réellement paginé.** L'atelier reste un document d'une page :
   le nombre de pages choisi (20 minimum, puis 1 000 Ar la page) est affiché et facturé
   mais pas composable page par page. Une table des pages (duplication, réordonnancement,
   ajout au cours de la création) et un export PDF multipage seraient la suite la plus
   utile et la plus directement rentable.
2. **Export d'impression groupé.** Télécharger les exports 300 dpi d'une commande en une
   fois (ZIP par commande) plutôt qu'un document à la fois, une fois les volumes réels
   d'impression connus.
3. **Export CSV des commandes** (référence, date, client, total, moyen de paiement,
   statut) pour la comptabilité et le rapprochement des paiements MVola / Orange Money
   validés à la main.
4. **Journal d'activités du back-office.** Seul le statut de commande est historisé :
   étendre `OrderEvent` à un journal générique (qui a modifié quel produit, quel tarif de
   zone, quel paiement, quand) pour retrouver une valeur modifiée par erreur.
5. **Recherche et filtres côté produits** dans le back-office, comme pour les commandes,
   dès que le catalogue sortira du photobook.
6. **Rappel de suivi plus visible côté client.** L'espace client liste déjà les commandes
   et leur statut ; ajouter une pastille dans l'en-tête (« 1 commande à vérifier ») et un
   rappel de l'étape suivante réduirait les relances par téléphone.
7. **Limitation des tentatives de connexion** et **récupération de mot de passe** — les
   deux trous documentés du tableau des bugs non corrigés (§9) ; à traiter avant toute
   mise en production.
8. **Confort de l'atelier** : annuler / rétablir au clavier, navigation de page aux
   flèches, repère de focus visible sur tous les contrôles (accessibilité).
9. **Mise en cache des visuels** (miniatures de modèles, images de produits) et
   préchargement des modèles voisins dans le sélecteur, pour que l'atelier s'ouvre plus
   vite sur une connexion malgache.

### Limites à connaître

- **Le téléchargement réservé à l'administration est une règle d'interface.** Le fichier
  d'impression est rendu par le navigateur à partir du JSON de la création : le bouton
  n'existe que pour un admin (rôle lu côté serveur à l'affichage de la page), mais un
  client suffisamment déterminé pourrait reconstruire une image depuis son propre
  document. Le verrou définitif demanderait un rendu côté serveur (Konva + canvas Node)
  puis un téléchargement authentifié — prolongement natureux de cette demande.
- **Les traductions malgaches doivent être relues par un locuteur natif.** Le vocabulaire
  utilisé est courant (Fandraisana, Vokatra, Harona, Tehirizo…) mais une relecture
  professionnelle est nécessaire avant une mise en production.
- **Aucune intégration Mobile Money officielle.** Le flux est déclaratif et validé à la
  main, faute de contrat marchand et de clés API. L'architecture est prête pour un
  branchement automatique (`src/lib/payment.ts`).
- **Stockage sur disque local.** Adapté à un serveur unique ; pour un déploiement
  distribué ou serverless, remplacer `src/lib/storage.ts` par un stockage objet
  compatible S3 (les fonctions `writeStorageFile` / `storageUrl` sont les seuls points
  de contact).
- **Aucun e-mail transactionnel.** Pas de confirmation de commande ni de réinitialisation
  de mot de passe : les statuts se consultent depuis `/compte`.
- **Pas d'upload depuis un mobile sans compte** ni d'import direct depuis Google Photos.
- **Pas de facturation PDF** ni de mention légale (NIF/STAT) sur les documents.
- **Le photobook n'a pas d'éditeur multi-pages.** L'assistant choisit bien papier,
  orientation, couverture et point de départ, mais l'atelier reste un document **d'une
  page** : le nombre de pages (20) est indicatif et affiché, pas composable page par page.
  C'est la suite la plus utile : un document paginé (tableau de pages, duplication,
  réordonnancement) et un export PDF multipage pour l'impression.
- **Le type de couverture et les options de l'assistant ne sont pas mémorisés sur la
  création** (`Design`) : ils sont portés par le **format du catalogue** choisi, donc par
  la ligne de panier et la commande. Rouvrir une création depuis `/compte` ramène le bon
  format, mais l'assistant ne peut pas préremplir les cases A4/paysage/rigide pour autant
  — il faudrait stocker ces trois valeurs dans `Design`.
- **Connexion Google et Facebook non vérifiée de bout en bout.** Sans identifiants réels
  (client OAuth déclaré chez chaque fournisseur), seules la redirection, l'état signé,
  PKCE et la gestion des échecs ont pu être testées. Le chemin heureux (échange de code
  réel puis lecture du profil) reste à valider avec de vrais identifiants.
- **WhatsApp : aucun fournisseur branché.** L'envoi passe par la WhatsApp Business Cloud
  API si `WHATSAPP_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID` sont fournis ; sans compte Meta
  validé, la fonctionnalité reste déclarative (comme le paiement Mobile Money).
- **Aucune récupération de mot de passe ni de définition de mot de passe** pour un compte
  créé par Google, Facebook ou WhatsApp : ces clients n'ont aujourd'hui aucun moyen de
  s'ajouter un mot de passe.
- **Pas de tests unitaires.** La vérification repose sur un parcours de bout en bout et
  sur des sondes de robustesse (§8) ; ajouter des tests unitaires sur
  `computeExportInfo`, `resolveStoragePath`, `normalizePhone`, `sanitizeReturnTo` et le
  calcul des totaux serait la suite logique.
- **Le menu « Choisissez un format » de l'atelier liste les 20 formats du photobook.**
  Fonctionnel, mais long : le filtrer sur le papier déjà choisi serait plus lisible.
- **Aucune limitation du nombre de tentatives de connexion** et **commandes invitées non
  rattachées au compte** : ces deux points sont détaillés et justifiés dans le tableau des
  bugs non corrigés (§9).
- **Le back-office n'a pas de facturation, d'export CSV comptable ni de gestion de stock.**

## 11. Déploiement

Prévu pour un serveur Node unique (VPS, Docker, PM2) :

1. `npm ci && npx prisma migrate deploy` (les migrations, pas `migrate dev`).
2. `npm run build && npm run start`.
3. Renseigner `DATABASE_URL`, `AUTH_SECRET` (valeur aléatoire de 32+ caractères),
   les numéros marchand, `UPLOAD_DIR` et **`APP_URL`**.
4. Monter `UPLOAD_DIR` sur un volume persistant.
5. Placer un reverse proxy TLS devant le serveur : le cookie de session passe en
   `Secure` automatiquement dès que `NODE_ENV=production`.
6. Pour la connexion sociale, **déclarer les URL de retour chez les fournisseurs**, à
   l'identique de `APP_URL` :

   ```
   https://votre-domaine/api/auth/google/callback
   https://votre-domaine/api/auth/facebook/callback
   ```

   Puis renseigner `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`,
   `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`, et `WHATSAPP_TOKEN` /
   `WHATSAPP_PHONE_NUMBER_ID`. Sans ces valeurs, l'application reste utilisable : les
   boutons concernés sont simplement désactivés, avec la variable manquante en infobulle.
7. **Vérifier qu'aucun code WhatsApp n'est affiché** : l'affichage de secours est réservé
   à `NODE_ENV ≠ production`. Après déploiement, une demande de code sans
   `WHATSAPP_TOKEN` doit répondre « non configuré » (sonde S13, §8.1).
