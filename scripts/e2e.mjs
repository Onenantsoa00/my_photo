/**
 * Vérification de bout en bout du parcours client et du back-office.
 *
 * Prérequis : Google Chrome installé et le serveur Next démarré.
 *   npm run dev
 *   npm run verify:e2e
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer-core";
import sharp from "sharp";

// `localhost` est nécessaire : avec `127.0.0.1`, le canal HMR du serveur de
// développement Next 16 est refusé et les composants clients ne s'hydratent
// pas — les clics seraient alors perdus sans aucune erreur visible.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ARTIFACTS = path.resolve(".e2e-artifacts");
const DOWNLOADS = path.join(ARTIFACTS, "downloads");
// `CHROME_PATH` permet de viser un autre binaire (Chromium, Brave…).
const CHROME =
  process.env.CHROME_PATH ??
  ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(
    (candidate) => existsSync(candidate),
  ) ??
  "/usr/bin/google-chrome";

const results = [];
const pageErrors = [];
const notFoundUrls = [];
const apiCalls = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function clickByText(page, text, selector = "button, a") {
  const clicked = await page.evaluate(
    (needle, sel) => {
      const nodes = [...document.querySelectorAll(sel)];
      const target = nodes.find((node) => (node.textContent ?? "").trim().includes(needle));
      if (!target) return false;
      target.click();
      return true;
    },
    text,
    selector,
  );

  if (!clicked) throw new Error(`Élément introuvable : "${text}" (${selector})`);
}

/**
 * Les champs de contact sont préremplis pour un client connecté : `type()`
 * concaténerait la saisie au prénom du compte. On vide donc avant de saisir.
 */
async function setField(page, selector, value) {
  await page.$eval(selector, (element) => {
    element.value = "";
  });
  await page.type(selector, value);
}

/**
 * Clique un choix de l'assistant et vérifie qu'il est bien retenu.
 *
 * En développement, le premier clic peut précéder l'hydratation React et être
 * perdu : on réessaie jusqu'à ce que l'état `aria-pressed` bascule.
 */
async function clickChoice(page, needle, label) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await clickByText(page, needle, "button");

    const pressed = await page
      .waitForFunction(
        (text) => {
          const node = [...document.querySelectorAll("button[aria-pressed]")].find((button) =>
            (button.textContent ?? "").includes(text),
          );
          return node?.getAttribute("aria-pressed") === "true";
        },
        { timeout: 1500 },
        needle,
      )
      .then(() => true)
      .catch(() => false);

    if (pressed) return;
  }

  throw new Error(`Sélection non prise en compte : ${label} ("${needle}")`);
}

async function main() {
  await rm(DOWNLOADS, { recursive: true, force: true });
  await mkdir(DOWNLOADS, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1500,950"],
    defaultViewport: { width: 1500, height: 950 },
  });

  const page = await browser.newPage();
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() === 404) notFoundUrls.push(response.url());
    const url = response.url();
    if (url.includes("/api/uploads") || url.includes("/api/files/")) {
      apiCalls.push({ url, status: response.status(), type: response.headers()["content-type"] });
    }
  });

  const client = await page.createCDPSession();
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DOWNLOADS,
  });

  try {
    // ---------------------------------------------------------------- 1. Accueil
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    const heroText = await page.$eval("h1", (node) => node.textContent ?? "");
    check("Accueil : titre affiché", heroText.length > 10, heroText.slice(0, 48));

    const heroCta = await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((node) =>
        (node.textContent ?? "").includes("Commencer une création"),
      );
      return link?.getAttribute("href") ?? "";
    });
    check(
      "Accueil : « Commencer une création » mène à l'assistant",
      heroCta === "/creer",
      `href=${heroCta}`,
    );

    // ---------------------------------------- 2. Création réservée aux comptes
    // Le visiteur peut consulter le catalogue, mais pas créer de photobook.
    await page.goto(`${BASE}/creer`, { waitUntil: "networkidle2" });
    check(
      "Assistant : visiteur renvoyé vers la connexion",
      page.url().includes("/connexion") && page.url().includes("next=%2Fcreer"),
      page.url(),
    );

    await page.goto(`${BASE}/editeur?product=tirage-standard`, { waitUntil: "networkidle2" });
    check(
      "Atelier : visiteur renvoyé vers la connexion, destination conservée",
      page.url().includes("/connexion") && page.url().includes("editeur"),
      page.url(),
    );

    const signInHint = await page.evaluate(() => document.body.innerText);
    check(
      "Connexion : message de poursuite de création affiché",
      signInHint.includes("continuer votre création"),
    );

    const socialProviders = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        google: text.includes("Google"),
        facebook: text.includes("Facebook"),
        whatsapp: text.includes("WhatsApp"),
        disabled: [...document.querySelectorAll("button[disabled]")].some((button) =>
          (button.textContent ?? "").includes("Google"),
        ),
      };
    });
    check(
      "Connexion : moyens de connexion e-mail, Google, Facebook et WhatsApp proposés",
      socialProviders.google && socialProviders.facebook && socialProviders.whatsapp,
      `Google ${socialProviders.disabled ? "désactivé (clés absentes)" : "actif"}`,
    );

    // Les champs du formulaire sont visés par identifiant : on repart de la
    // page d'inscription avec la destination conservée.
    await page.goto(`${BASE}/creer`, { waitUntil: "networkidle2" });
    await clickByText(page, "Créer un compte");
    await page.waitForSelector("#name", { timeout: 20000 });
    check(
      "Inscription : destination conservée vers l'assistant",
      page.url().includes("/inscription") && page.url().includes("next=%2Fcreer"),
      page.url(),
    );

    const shopperEmail = `rakoto.${Date.now()}@example.mg`;
    await page.type("#name", "Rakoto Jean");
    await page.type("#email", shopperEmail);
    await page.type("#phone", "+261 34 11 223 34");
    await page.type("#password", "MotDePasse123");
    await clickByText(page, "Créer mon compte");
    await page.waitForFunction(() => window.location.pathname === "/creer", {
      timeout: 30000,
    });
    const afterSignUp = await page.evaluate(() => document.body.innerText);
    check(
      "Inscription : retour direct sur l'assistant de création",
      afterSignUp.includes("Créer un photobook"),
    );

    // ------------------------------------------------ 3. Assistant photobook
    // L'assistant est un composant client : on attend que le navigateur ait
    // repris la main avant de cliquer, sinon la sélection serait perdue.
    await page.waitForFunction(() => document.body.innerText.includes("Taille du papier"));
    await new Promise((resolve) => setTimeout(resolve, 500));

    await clickChoice(page, "A3 —", "taille du papier A3");
    await clickByText(page, "Continuer", "button");

    await page.waitForFunction(() => document.body.innerText.includes("Un livre vertical"));
    await clickChoice(page, "Paysage", "orientation paysage");
    const landscapeSummary = await page.evaluate(() => document.body.innerText);
    check(
      "Assistant : orientation paysage prise en compte (42 cm × 29,7 cm)",
      landscapeSummary.includes("42 cm × 29,7 cm") &&
        landscapeSummary.includes("Paysage (horizontal)"),
      landscapeSummary.includes("42 cm × 29,7 cm") ? "dimensions inversées" : "dimensions inchangées",
    );

    await clickByText(page, "Continuer", "button");
    await page.waitForFunction(() => document.body.innerText.includes("La couverture est imprimée"));
    await clickChoice(page, "moyen solide", "couverture moyen solide");
    await clickByText(page, "Continuer", "button");

    await page.waitForFunction(() => document.body.innerText.includes("Partez d'une page blanche"));
    await clickChoice(page, "Plusieurs mises en page", "mode thème");
    await clickChoice(page, "Mariage", "thème mariage");
    await clickChoice(page, "Photobook · Mariage", "modèle de mariage");

    const wizardSummary = await page.evaluate(() => document.body.innerText);
    check(
      "Assistant : récapitulatif complet (papier, orientation, couverture, départ)",
      ["A3", "Paysage", "moyen solide", "Mariage"].every((word) => wizardSummary.includes(word)),
      "papier, orientation, couverture et thème présents",
    );

    await clickByText(page, "Créer mon photobook", "button");
    await page.waitForFunction(() => window.location.pathname === "/editeur", {
      timeout: 30000,
    });

    const wizardUrl = new URL(page.url());
    check(
      "Atelier : format et modèle transmis par l'assistant",
      wizardUrl.searchParams.get("product") === "photobook" &&
        Boolean(wizardUrl.searchParams.get("variant")) &&
        wizardUrl.searchParams.get("template") === "pb-mariage",
      page.url().replace(BASE, ""),
    );

    await page.waitForSelector("canvas", { timeout: 30000 });
    const wizardCanvas = await page.evaluate(() => {
      const label = [...document.querySelectorAll("div")].find((element) =>
        (element.textContent ?? "").includes("Plan de travail"),
      );
      return label?.textContent ?? "";
    });
    check(
      "Atelier : plan de travail au format A3 paysage (1500×1061 px)",
      wizardCanvas.includes("1500×1061 px") && wizardCanvas.includes("42 × 29.7 cm"),
      wizardCanvas.slice(0, 120),
    );

    const wizardLayers = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2")].find((element) =>
        (element.textContent ?? "").trim().startsWith("Calques"),
      );
      return heading?.parentElement?.querySelectorAll("li").length ?? 0;
    });
    check("Atelier : modèle du thème appliqué au format choisi", wizardLayers >= 4, `${wizardLayers} calques`);

    // ------------------------------------- 4. Reprise du parcours produit
    // L'atelier a été ouvert par l'assistant ; on repart d'une fiche produit
    // pour retrouver le format de référence des mesures ci-dessous.
    await page.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });

    // Les boutons de langue portent aussi aria-pressed : on filtre sur le format.
    const variantCount = await page.$$eval("button[aria-pressed]", (nodes) =>
      nodes.filter((node) => (node.textContent ?? "").includes("cm")).length,
    );
    check("Fiche produit : formats proposés", variantCount === 5, `${variantCount} formats`);

    // Choisit 20 × 30 cm puis une quantité, et vérifie que le total suit.
    await clickByText(page, "20 × 30 cm");
    await page.click("#purchase-quantity", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type("#purchase-quantity", "2");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const quantity = await page.$eval("#purchase-quantity", (input) => Number(input.value));

    const totalText = await page.evaluate(() => {
      const span = [...document.querySelectorAll("span.text-xl")].find((node) =>
        (node.textContent ?? "").includes("Ar"),
      );
      return span?.textContent ?? "";
    });
    const expectedTotal = new Intl.NumberFormat("fr-FR")
      .format(5000 * quantity)
      .replace(/[\u202f\u00a0]/g, " ");
    check(
      "Fiche produit : total recalculé",
      totalText.includes(expectedTotal),
      `quantité ${quantity} → attendu ${expectedTotal} Ar, affiché ${totalText.trim()}`,
    );

    await clickByText(page, "Ajouter au panier");
    await page.waitForFunction(
      () => document.body.innerText.includes("Ajouté au panier"),
      { timeout: 20000 },
    );
    check("Panier : ajout confirmé", true);

    // ------------------------------------------------------------- 3. Atelier
    await page.goto(`${BASE}/editeur?product=tirage-standard`, { waitUntil: "networkidle2" });
    await page.waitForSelector("canvas", { timeout: 30000 });
    const canvasCount = await page.$$eval("canvas", (nodes) => nodes.length);
    check("Atelier : plan de travail Konva rendu", canvasCount >= 1, `${canvasCount} canvas`);

    const dpiLabel = await page.evaluate(() => {
      // Le bandeau d'info est le div le plus profond qui parle de « dpi ».
      const candidates = [...document.querySelectorAll("div")].filter((element) =>
        (element.textContent ?? "").includes("dpi"),
      );
      const deepest = candidates.at(-1);
      return deepest?.textContent ?? "";
    });
    const dpiMatch = dpiLabel.match(/(\d+) dpi/);
    check(
      "Atelier : résolution d'impression calculée",
      Boolean(dpiMatch) &&
        Number(dpiMatch[1]) >= 200 &&
        dpiLabel.includes("1500×2250 px"),
      dpiLabel.slice(0, 140),
    );

    // ----------------------------------------------- Upload d'une vraie photo
    const photoPath = path.join(ARTIFACTS, "photo.jpg");
    await sharp({
      create: {
        width: 900,
        height: 600,
        channels: 3,
        background: { r: 210, g: 90, b: 60 },
      },
    })
      .jpeg({ quality: 90 })
      .toFile(photoPath);

    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error("Champ de fichier introuvable dans l'atelier");
    await fileInput.uploadFile(photoPath);

    await page.waitForFunction(
      () => {
        const heading = [...document.querySelectorAll("h2")].find((element) =>
          (element.textContent ?? "").trim().startsWith("Calques"),
        );
        return Boolean(
          [...(heading?.parentElement?.querySelectorAll("li") ?? [])].some((item) =>
            (item.textContent ?? "").includes("Photo"),
          ),
        );
      },
      { timeout: 30000 },
    );

    const uploadCall = apiCalls.find((call) => call.url.includes("/api/uploads"));
    check(
      "Upload : photo traitée par sharp",
      uploadCall?.status === 200,
      `HTTP ${uploadCall?.status ?? "aucun appel"}`,
    );

    // Le fichier doit être réellement servi, sinon le canvas resterait vide.
    await page.waitForFunction(
      () =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("/api/files/")),
      { timeout: 20000 },
    );
    const servedCall = apiCalls.find(
      (call) => call.url.includes("/api/files/") && call.status === 200,
    );
    check(
      "Upload : photo servie par /api/files",
      Boolean(servedCall) && (servedCall?.type ?? "").includes("image/webp"),
      `${servedCall?.type ?? "?"} — ${servedCall?.status ?? "?"}`,
    );

    // ------------------------------------------------- Filtre sur la photo
    // La couche photo vient d'être ajoutée et est sélectionnée : le premier
    // curseur est l'arrondi, le deuxième la luminosité.
    const ranges = await page.$$("input[type=range]");
    check("Atelier : curseurs de réglage présents", ranges.length >= 4, `${ranges.length} curseurs`);
    await ranges[1].focus();
    for (let step = 0; step < 5; step += 1) await page.keyboard.press("ArrowRight");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const brightnessLabel = await page.evaluate(() => {
      const label = [...document.querySelectorAll("label")].find((element) =>
        (element.querySelector("span")?.textContent ?? "").includes("Luminosité"),
      );
      return label?.textContent ?? "";
    });
    check(
      "Atelier : filtre luminosité appliqué au clavier",
      brightnessLabel.includes("0.10"),
      brightnessLabel.trim().slice(0, 60),
    );

    await clickByText(page, "Ajouter un texte");
    await page.waitForFunction(
      () => {
        const heading = [...document.querySelectorAll("h2")].find((element) =>
          (element.textContent ?? "").trim().startsWith("Calques"),
        );
        return Boolean(heading && heading.parentElement?.querySelectorAll("li").length);
      },
      { timeout: 15000 },
    );
    const textLayerLabel = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2")].find((element) =>
        (element.textContent ?? "").trim().startsWith("Calques"),
      );
      return heading?.parentElement?.querySelector("li")?.textContent ?? "";
    });
    check(
      "Atelier : calque texte ajouté au panneau",
      textLayerLabel.includes("Votre texte"),
      textLayerLabel.slice(0, 60),
    );

    // ------------------------------- Déplacement d'un calque à la souris
    const readX = () =>
      page.evaluate(() => {
        const label = [...document.querySelectorAll("label")].find(
          (element) => (element.querySelector("span")?.textContent ?? "").trim() === "X",
        );
        return Number(label?.querySelector("input")?.value ?? Number.NaN);
      });

    const xBefore = await readX();
    const stageBox = await page.$eval("canvas", (canvas) => {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    });
    const zoomFactor = stageBox.width / 1500;

    // Le calque texte est à (150, 900) dans un plan de 1500 × 2250.
    const grabX = stageBox.x + 750 * zoomFactor;
    const grabY = stageBox.y + 960 * zoomFactor;

    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + 120, grabY + 60, { steps: 12 });
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const xAfter = await readX();
    check(
      "Atelier : calque déplacé à la souris et position synchronisée",
      Number.isFinite(xAfter) && xAfter - xBefore > 100,
      `X ${xBefore} → ${xAfter}`,
    );

    await clickByText(page, "Forme");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const layerCount = await page.evaluate(
      () => document.querySelectorAll("li button[title]").length,
    );
    check("Atelier : calques listés", layerCount > 0, `${layerCount} contrôles de calque`);

    // Application d'un modèle.
    await clickByText(page, "Modèles");
    await page.waitForFunction(
      () => document.body.innerText.includes("Utiliser ce modèle"),
      { timeout: 15000 },
    );
    await clickByText(page, "Utiliser ce modèle");
    await new Promise((resolve) => setTimeout(resolve, 800));
    check("Atelier : modèle appliqué", true);

    // Export haute résolution.
    await clickByText(page, "PNG");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const files = await readdir(DOWNLOADS);
    const png = files.filter((file) => file.endsWith(".png"));
    check("Atelier : export PNG téléchargé", png.length === 1, png.join(", ") || "aucun fichier");

    // ------------------------------------------------- 4. Commande de la création
    await clickByText(page, "Commander cette création");
    await page.waitForFunction(() => window.location.pathname === "/panier", {
      timeout: 30000,
    });
    const cartBody = await page.evaluate(() => document.body.innerText);
    check("Panier : création rattachée à la ligne", cartBody.includes("Création"));
    check(
      "Panier : deux lignes distinctes",
      (cartBody.match(/Tirage photo standard/g) ?? []).length >= 2,
      `${(cartBody.match(/Tirage photo standard/g) ?? []).length} lignes`,
    );

    // ------------------------------------------------------- 5. Tunnel de commande
    await page.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });

    await setField(page, "#customerName", "Rakoto Jean");
    await setField(page, "#customerEmail", shopperEmail);
    await setField(page, "#customerPhone", "+261 34 11 223 34");

    const zoneValue = await page.$eval(
      "#deliveryZoneId option:nth-child(2)",
      (option) => option.value,
    );
    await page.select("#deliveryZoneId", zoneValue);
    await page.type("#addressLine", "Lot II M 12 bis Ambatoroka");

    await page.click('input[value="MVOLA"]');
    await page.waitForSelector("#paymentReference", { timeout: 10000 });

    const merchantShown = await page.evaluate(() => document.body.innerText.includes("034 12 345 67"));
    check("Commande : numéro marchand MVola affiché", merchantShown);

    await page.type("#paymentReference", "9876543210");
    await new Promise((resolve) => setTimeout(resolve, 300));

    await clickByText(page, "Confirmer la commande");
    await page.waitForFunction(
      () => window.location.pathname.startsWith("/commande/MP-"),
      { timeout: 40000 },
    );

    const reference = page.url().split("/").pop();
    const orderBody = await page.evaluate(() => document.body.innerText);
    check("Commande : référence générée", /^MP-\d{4}-[0-9A-F]{6}$/.test(reference), reference);
    check(
      "Commande : paiement en attente de vérification",
      orderBody.includes("En attente de vérification"),
    );
    check("Commande : total affiché", orderBody.includes("Ar"));

    // -------------------------------------------------------------- 6. Compte
    // Le client est déjà connecté (inscription faite avant la création) : la
    // commande et la création doivent apparaître dans son espace.
    await page.goto(`${BASE}/compte`, { waitUntil: "networkidle2" });
    const accountBody = await page.evaluate(() => document.body.innerText);
    check("Compte : accès après inscription", accountBody.includes("Mon compte"));
    check(
      "Compte : commande enregistrée visible",
      accountBody.includes(reference),
      reference,
    );
    check(
      "Compte : création du photobook dans « Mes créations »",
      accountBody.includes("Mes créations") && !accountBody.includes("Aucune création enregistrée"),
      accountBody.includes("Mes créations") ? "section présente" : "section absente",
    );

    // ------------------------------------------------------------ 7. Back-office
    // Il faut se déconnecter : /connexion renvoie un client connecté vers /compte.
    await clickByText(page, "Déconnexion");
    await page.waitForFunction(() => window.location.pathname === "/", { timeout: 20000 });

    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
    await page.type("#email", "admin@myphoto.mg");
    await page.type("#password", "Admin1234!");
    await clickByText(page, "Se connecter");
    await page.waitForFunction(() => window.location.pathname === "/admin", {
      timeout: 30000,
    });
    const adminBody = await page.evaluate(() => document.body.innerText);
    check(
      "Admin : tableau de bord accessible",
      /chiffre d'affaires/i.test(adminBody) && adminBody.includes("Payée"),
    );
    check("Admin : commande fraîche visible", adminBody.includes(reference));

    await page.goto(`${BASE}/admin/commandes?filtre=AWAITING_VERIFICATION`, {
      waitUntil: "networkidle2",
    });
    const verifyBody = await page.evaluate(() => document.body.innerText);
    check("Admin : filtre paiements à vérifier", verifyBody.includes(reference));

    // Ouvre la commande et valide le paiement.
    await page.evaluate((ref) => {
      const link = [...document.querySelectorAll("a")].find(
        (node) => node.textContent?.trim() === ref,
      );
      link?.click();
    }, reference);
    await page.waitForFunction(
      (ref) => document.body.innerText.includes(ref),
      { timeout: 30000 },
      reference,
    );
    await page.waitForSelector('button[value="approve"]', { timeout: 20000 });
    check("Admin : bloc de vérification du paiement affiché", true);
    await page.click('button[value="approve"]');
    await page.waitForFunction(
      () => document.body.innerText.includes("Payée"),
      { timeout: 30000 },
    );
    const afterValidation = await page.evaluate(() => document.body.innerText);
    check("Admin : paiement validé", afterValidation.includes("Payée"));
    check("Admin : commande confirmée après paiement", afterValidation.includes("Confirmée"));

    // ------------------------------------------------------ 8. Produits & zones
    // Les noms de produits sont dans des <input>, absents de innerText.
    await page.goto(`${BASE}/admin/produits`, { waitUntil: "networkidle2" });
    const productNames = await page.$$eval("input[name=nameFr]", (nodes) =>
      nodes.map((node) => node.value),
    );
    check(
      "Admin : produits listés et éditables",
      productNames.length === 14 &&
        productNames.includes("Mug personnalisé") &&
        productNames.includes("Photobook A4 / A3"),
      `${productNames.length} produits`,
    );

    await page.goto(`${BASE}/admin/zones`, { waitUntil: "networkidle2" });
    const zonesBody = await page.evaluate(() => document.body.innerText);
    check("Admin : zones de livraison listées", zonesBody.includes("Toamasina"));

    // ------------------------------------------------------------- 9. Bilinguisme
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    await page.click('button[value="mg"]');
    await page.waitForFunction(
      () => document.body.innerText.includes("Fandraisana"),
      { timeout: 20000 },
    );
    const mgBody = await page.evaluate(() => document.body.innerText);
    check("Bilinguisme : bascule en malgache", mgBody.includes("Fandraisana"));
    check("Bilinguisme : catégories traduites", mgBody.includes("Sary pirinty"));

    // ------------------------------------------------- 10. Connexion WhatsApp
    // Le code n'est affiché à l'écran qu'en développement, sans jeton WhatsApp
    // configuré (voir src/server/whatsapp.ts) : ce contrôle ne vaut que pour
    // un serveur lancé avec NODE_ENV ≠ production et sans compte WhatsApp.
    const whatsappContext = await browser.createBrowserContext();
    const whatsappPage = await whatsappContext.newPage();
    await whatsappPage.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
    await clickByText(whatsappPage, "WhatsApp");
    await whatsappPage.waitForSelector("#whatsapp-phone", { timeout: 15000 });

    const whatsappPhone = `034${String(Date.now()).slice(-7)}`;
    await whatsappPage.type("#whatsapp-phone", whatsappPhone);
    await clickByText(whatsappPage, "Recevoir le code");
    await whatsappPage.waitForSelector("#whatsapp-code", { timeout: 20000 });

    // Deux paragraphes parlent du mode développement : seul celui qui suit la
    // demande contient le code, on cherche donc celui qui porte six chiffres.
    const devCode = await whatsappPage.evaluate(() => {
      const hints = [...document.querySelectorAll("p")]
        .map((element) => element.textContent ?? "")
        .filter((text) => text.includes("Mode développement"));

      for (const text of hints) {
        const match = /\b(\d{6})\b/.exec(text);
        if (match) return match[1];
      }

      return null;
    });

    check("WhatsApp : code de connexion envoyé", Boolean(devCode), devCode ?? "aucun code affiché");

    if (devCode) {
      await whatsappPage.type("#whatsapp-code", devCode);
      await clickByText(whatsappPage, "Valider et continuer");
      await whatsappPage.waitForFunction(() => window.location.pathname === "/compte", {
        timeout: 30000,
      });
      const whatsappAccount = await whatsappPage.evaluate(() => document.body.innerText);
      check(
        "WhatsApp : compte ouvert par le code et session active",
        whatsappAccount.includes("Mon compte") && whatsappAccount.includes("WhatsApp"),
        whatsappAccount.includes("Client WhatsApp") ? "compte Client WhatsApp" : "compte sans nom",
      );
    }

    await whatsappContext.close();

    // Un code à six chiffres ne doit jamais suffire : six chiffres se devinent.
    // Le mauvais code est testé dans un contexte neuf, sans session ouverte.
    const wrongCodeContext = await browser.createBrowserContext();
    const wrongCodePage = await wrongCodeContext.newPage();
    await wrongCodePage.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
    await clickByText(wrongCodePage, "WhatsApp");
    await wrongCodePage.waitForSelector("#whatsapp-phone", { timeout: 15000 });
    await wrongCodePage.type("#whatsapp-phone", whatsappPhone);
    await clickByText(wrongCodePage, "Recevoir le code");
    await wrongCodePage.waitForSelector("#whatsapp-code", { timeout: 20000 });
    await wrongCodePage.type("#whatsapp-code", "000000");
    await clickByText(wrongCodePage, "Valider et continuer");
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const wrongCodeBody = await wrongCodePage.evaluate(() => document.body.innerText);
    check(
      "WhatsApp : code erroné refusé, aucune session ouverte",
      wrongCodeBody.includes("incorrect") && wrongCodePage.url().includes("/connexion"),
      wrongCodePage.url().replace(BASE, ""),
    );

    await wrongCodeContext.close();
  } finally {
    await browser.close();
  }

  const realErrors = pageErrors.filter(
    (message) =>
      !message.includes("favicon") &&
      !message.includes("Download the React DevTools") &&
      !message.includes("net::ERR_ABORTED"),
  );

  const unexpected404 = notFoundUrls.filter((url) => !url.includes("favicon"));

  check("Aucune erreur JavaScript inattendue", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
  check(
    "Aucune ressource manquante",
    unexpected404.length === 0,
    unexpected404.slice(0, 3).join(" | ") || `favicon 404 : ${notFoundUrls.length > 0}`,
  );

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées.`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Échec du script :", error);
  process.exitCode = 1;
});
