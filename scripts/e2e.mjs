/**
 * Vérification de bout en bout du parcours photobook A4.
 *
 * Prérequis : Google Chrome installé et le serveur Next démarré.
 *   npm run dev
 *   npm run verify:e2e
 *
 * Le script crée un compte client neuf, compose un photobook A4, vérifie le
 * tarif page par page, l'upload depuis un emplacement « + », la sauvegarde et
 * la reprise du brouillon, puis passe une commande MVola et la fait valider
 * dans le back-office.
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer-core";
import sharp from "sharp";

// `localhost` est nécessaire : avec `127.0.0.1`, le canal HMR du serveur de
// développement Next est refusé et les composants clients ne s'hydratent pas.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ARTIFACTS = path.resolve(".e2e-artifacts");
const CHROME =
  process.env.CHROME_PATH ??
  ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(
    (candidate) => existsSync(candidate),
  ) ??
  "/usr/bin/google-chrome";

const results = [];
const pageErrors = [];
const notFoundUrls = [];
const uploadCalls = [];
const fileCalls = [];

function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function waitForText(page, text, timeout = 20000) {
  await page.waitForFunction(
    (needle) => document.body.innerText.includes(needle),
    { timeout },
    text,
  );
}

async function clickByText(page, text, selector = "button, a, [role='menuitem']") {
  const clicked = await page.evaluate(
    (needle, sel) => {
      const nodes = [...document.querySelectorAll(sel)];
      const target = nodes.find((node) => {
        const label = (node.textContent ?? "").trim();
        const visible = node.getClientRects().length > 0;
        return label.includes(needle) && visible && !node.disabled;
      });

      if (!target) return false;
      target.scrollIntoView({ block: "center" });
      target.click();
      return true;
    },
    text,
    selector,
  );

  if (!clicked) throw new Error(`Élément introuvable : « ${text} » (${selector})`);
  await sleep(250);
}

async function setField(page, selector, value) {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
}

/** Ouvre le menu Apparence et sélectionne une option. */
async function chooseTheme(page, label) {
  await page.click('button[aria-label="Apparence"]');
  await page.waitForFunction(
    () => document.querySelectorAll('[role="menuitem"]').length > 0,
    { timeout: 5000 },
  );
  await clickByText(page, label, '[role="menuitem"]');
  await sleep(300);
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    return (
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) > width + 2
    );
  });
}

async function main() {
  await rm(ARTIFACTS, { recursive: true, force: true });
  await mkdir(ARTIFACTS, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1000"],
    defaultViewport: { width: 1440, height: 1000 },
  });

  const page = await browser.newPage();
  // Les suppressions du back-office passent par une confirmation navigateur.
  page.on("dialog", (dialog) => void dialog.accept());
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() === 404) notFoundUrls.push(url);
    if (url.includes("/api/uploads")) {
      uploadCalls.push({ url, status: response.status() });
    }
    if (url.includes("/api/files/")) {
      fileCalls.push({
        url,
        status: response.status(),
        type: response.headers()["content-type"] ?? "",
      });
    }
  });

  try {
    // ------------------------------------------------------------ 1. Accueil
    section("Accueil et thème");
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });

    const home = await bodyText(page);
    check("Accueil : titre affiché", (await page.$eval("h1", (node) => node.textContent ?? "")).length > 10);
    check("Accueil : tarif A4 affiché", home.includes("15 000 Ar") && home.includes("20 pages"));
    check(
      "Accueil : numéros MVola et Orange Money affichés",
      home.includes("0389145273") &&
        home.includes("0375441549") &&
        home.includes("RANAIVO Andry Ny Avo Onenantsoa"),
    );
    check(
      "Thème : le mode système suit l'OS sombre",
      await page.evaluate(() => document.documentElement.classList.contains("dark")),
    );

    await chooseTheme(page, "Sombre");
    check(
      "Thème : choix sombre appliqué et mémorisé",
      await page.evaluate(
        () =>
          document.documentElement.classList.contains("dark") &&
          localStorage.getItem("mp_theme") === "dark",
      ),
    );

    await chooseTheme(page, "Clair");
    check(
      "Thème : choix clair appliqué",
      await page.evaluate(
        () =>
          !document.documentElement.classList.contains("dark") &&
          localStorage.getItem("mp_theme") === "light",
      ),
    );

    await chooseTheme(page, "Système");
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);
    await sleep(500);
    check(
      "Thème : « Système » réagit au changement de l'OS",
      await page.evaluate(
        () =>
          document.documentElement.classList.contains("dark") &&
          localStorage.getItem("mp_theme") === "system",
      ),
    );
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "light" },
    ]);
    await sleep(400);

    // ------------------------------------------------------- 2. Inscription
    section("Compte et assistant");
    await page.goto(`${BASE}/creer`, { waitUntil: "networkidle2" });
    check(
      "Assistant : visiteur renvoyé vers la connexion",
      page.url().includes("/connexion") && page.url().includes("next=%2Fcreer"),
      page.url().replace(BASE, ""),
    );

    await page.goto(`${BASE}/inscription?next=%2Fcreer`, {
      waitUntil: "networkidle2",
    });
    const shopperEmail = `photobook.${Date.now()}@example.mg`;
    await page.type("#name", "Rakoto Jean");
    await page.type("#email", shopperEmail);
    await page.type("#phone", "+261 34 11 223 34");
    await page.type("#password", "MotDePasse123");
    // Le sélecteur de langue est aussi un formulaire : on vise explicitement
    // le formulaire d'inscription qui contient le champ e-mail.
    await page.click("form:has(#email) button[type=submit]");
    await page.waitForFunction(() => window.location.pathname === "/creer", {
      timeout: 30000,
    });
    await waitForText(page, "Nombre de pages");
    await sleep(500);

    // -------------------------------------------- 3. Nombre de pages d'abord
    const initialPages = await page.$eval(
      'input[aria-label="Nombre de pages"]',
      (input) => Number(input.value),
    );
    const initialWizard = await bodyText(page);
    check("Assistant : 20 pages proposées d'abord", initialPages === 20, `${initialPages} pages`);
    check(
      "Assistant : 20 pages = 15 000 Ar",
      initialWizard.includes("15 000 Ar") && initialWizard.includes("20 pages"),
    );

    await page.click('button[aria-label="Ajouter une page"]');
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector('input[aria-label="Nombre de pages"]')?.value ?? 0,
        ) === 21,
    );
    const pageSummary = await page.evaluate(
      () => document.querySelector("aside")?.innerText ?? "",
    );
    check(
      "Assistant : 21 pages = 21 000 Ar (pages + couverture solide)",
      pageSummary.includes("21") && pageSummary.includes("21 000 Ar"),
      pageSummary.replace(/\n/g, " · ").slice(-120),
    );

    await clickByText(page, "Continuer", "button");
    await waitForText(page, "Paysage (horizontal)");

    // ------------------------------------------------ Étape 2 : les papiers
    const formatStep = await bodyText(page);
    check(
      "Assistant : papiers A4, A5, A6 et carré proposés",
      formatStep.includes("A4") &&
        formatStep.includes("A5") &&
        formatStep.includes("A6") &&
        formatStep.includes("Carré"),
    );

    await clickByText(page, "A5", "button[aria-pressed]");
    await sleep(300);
    const a5Summary = await page.evaluate(
      () => document.querySelector("aside")?.innerText ?? "",
    );
    check(
      "Assistant : le format A5 change les dimensions",
      a5Summary.includes("14,8 × 21"),
      a5Summary.replace(/\n/g, " · ").slice(0, 90),
    );

    await clickByText(page, "A4", "button[aria-pressed]");
    await sleep(300);
    await clickByText(page, "Paysage", "button[aria-pressed]");
    await clickByText(page, "Continuer", "button");

    await waitForText(page, "Couverture solide");
    const coverStep = await bodyText(page);
    check(
      "Assistant : couverture solide plus chère que moyen solide",
      coverStep.includes("+ 5 000 Ar") && coverStep.includes("Inclus dans le tarif"),
    );
    await clickByText(page, "Couverture solide", "button[aria-pressed]");
    await clickByText(page, "Continuer", "button");

    await waitForText(page, "Point de départ");
    await clickByText(page, "Modèle", "button");
    await waitForText(page, "Cœurs & formes");
    await clickByText(page, "Cœurs & formes", "button");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button[aria-pressed]")].some(
        (button) =>
          (button.textContent ?? "").includes("Cœurs & formes") &&
          button.getAttribute("aria-pressed") === "true",
      ),
    );
    check("Assistant : modèle choisi", true);

    await clickByText(page, "Créer mon photobook", "button");
    await page.waitForFunction(() => window.location.pathname === "/editeur", {
      timeout: 40000,
    });
    await page.waitForSelector(".konvajs-content", { timeout: 40000 });
    await sleep(800);

    const editorUrl = new URL(page.url());
    check(
      "Atelier : format, pages et modèle transmis",
      editorUrl.searchParams.get("product") === "photobook" &&
        Boolean(editorUrl.searchParams.get("variant")) &&
        editorUrl.searchParams.get("pages") === "21" &&
        editorUrl.searchParams.get("template") === "pb-formes",
      page.url().replace(BASE, ""),
    );

    const editorBody = await bodyText(page);
    check(
      "Atelier : plan de travail A4 paysage",
      editorBody.includes("1500×1061 px") && editorBody.includes("29.7 × 21 cm"),
    );
    check(
      "Atelier : 21 pages à 21 000 Ar (couverture solide comprise)",
      editorBody.includes("21 000 Ar") && editorBody.includes("21 pages"),
    );
    const titleValue = await page.$eval(
      'input[aria-label="Atelier de création"]',
      (input) => input.value,
    );
    check("Atelier : nom du projet repris du modèle", titleValue === "Cœurs & formes", titleValue);

    // ------------------------------------- Modèles (fenêtre) & fonds de page
    section("Fenêtre des modèles et fonds de page");

    await clickByText(page, "Modèles", "button");
    await page.waitForSelector('[data-slot="dialog-content"]', { timeout: 15000 });
    const dialogBox = await page.$eval('[data-slot="dialog-content"]', (node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const templateCards = await page.$$eval(
      '[data-slot="dialog-content"] article',
      (nodes) => nodes.length,
    );
    check(
      "Atelier : fenêtre des modèles agrandie",
      dialogBox.width > 900 && templateCards >= 6,
      `${Math.round(dialogBox.width)} px · ${templateCards} modèles`,
    );
    await page.keyboard.press("Escape");
    await sleep(400);

    const thumbBackground = () =>
      page.evaluate(() => {
        const thumb = [...document.querySelectorAll("button")].find((node) =>
          (node.getAttribute("title") ?? "").startsWith("Page "),
        );
        return thumb ? getComputedStyle(thumb).backgroundImage : "";
      });

    await clickByText(page, "Dégradé", "button[aria-pressed]");
    await sleep(300);
    const gradientThumb = await thumbBackground();
    check(
      "Atelier : fond dégradé choisi par le client",
      gradientThumb.includes("linear-gradient"),
      gradientThumb.slice(0, 70),
    );

    await clickByText(page, "Motifs", "button[aria-pressed]");
    await sleep(300);
    const motifButton = await page.$('button[aria-label="Grille"]');
    check("Atelier : bibliothèque de motifs disponible", Boolean(motifButton));

    if (motifButton) {
      await motifButton.click();
      await sleep(300);
      const patternThumb = await thumbBackground();
      // Depuis l'ajustement des motifs, chaque motif est une tuile SVG répétée :
      // le même dessin sert à la vignette et au canevas d'impression.
      // `backgroundImage` calculé ne renvoie que l'image : la répétition et la
      // taille de tuile sont vérifiées via `background-size` juste après.
      const patternTileSize = await page.evaluate(() => {
        const thumb = [...document.querySelectorAll("button")].find((node) =>
          (node.getAttribute("title") ?? "").startsWith("Page "),
        );
        return thumb ? getComputedStyle(thumb).backgroundSize : "";
      });
      check(
        "Atelier : fond à motif choisi par le client",
        patternThumb.includes("data:image/svg+xml") && patternTileSize !== "",
        `${patternThumb.slice(0, 40)}${patternTileSize ? ` · tuile ${patternTileSize}` : ""}`,
      );
    }

    await clickByText(page, "Uni", "button[aria-pressed]");
    await sleep(300);

    // ----------------------------------- 4. Clic sur un emplacement photo « + »
    section("Photo depuis un emplacement vide");
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

    const stageBox = await page.$eval(".konvajs-content", (node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    });
    const zoom = stageBox.width / 1500;
    // Premier emplacement du modèle « Cœurs & formes » après adaptation au
    // paysage : x 450, y 165, 270 × 270.
    const chooserPromise = page.waitForFileChooser({ timeout: 10000 });
    await page.mouse.click(stageBox.x + (450 + 135) * zoom, stageBox.y + (165 + 135) * zoom);
    const chooser = await chooserPromise;

    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/uploads") &&
        response.request().method() === "POST",
      { timeout: 30000 },
    );
    await chooser.accept([photoPath]);
    const uploaded = await uploadResponse;
    check("Photo : l'emplacement « + » ouvre le sélecteur et téléverse", uploaded.status() === 200, `HTTP ${uploaded.status()}`);

    await page.waitForFunction(
      () =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("/api/files/")),
      { timeout: 20000 },
    );
    check(
      "Photo : fichier servi à l'atelier",
      fileCalls.some((call) => call.status === 200 && call.type.includes("image/webp")),
      fileCalls.at(-1)?.type ?? "aucune image",
    );
    await waitForText(page, "2 emplacement(s) photo vide(s)", 10000);
    check("Photo : l'emplacement n'est plus vide", true);

    // --------------------------------------- 5. Autosauvegarde & reprise
    section("Brouillon et reprise");
    await page.waitForFunction(
      () => new URL(location.href).searchParams.has("design"),
      { timeout: 20000 },
    );
    const designId = new URL(page.url()).searchParams.get("design");
    check("Brouillon : autosauvegarde créée", Boolean(designId), designId ?? "");

    await page.click('button[title="Enregistrer la création"]');
    await waitForText(page, "Création enregistrée", 20000);

    await page.click('button[title="Ajouter une page"]');
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("22 000 Ar") &&
        document.body.innerText.includes("22 pages"),
      { timeout: 10000 },
    );
    check("Atelier : ajouter une page augmente le tarif", true, "22 pages → 22 000 Ar");
    await page.click('button[title="Enregistrer la création"]');
    await sleep(1000);

    await page.goto(`${BASE}/compte`, { waitUntil: "networkidle2" });
    const account = await bodyText(page);
    check(
      "Compte : brouillon listé avec son titre et ses pages",
      account.includes("Cœurs & formes") &&
        account.includes("22 pages") &&
        account.includes("Mes brouillons"),
    );

    const resumeHref = await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((anchor) =>
        (anchor.textContent ?? "").includes("Reprendre"),
      );
      return link?.getAttribute("href") ?? "";
    });
    check("Compte : lien de reprise disponible", resumeHref.includes("/editeur?design="), resumeHref);

    await page.goto(`${BASE}${resumeHref}`, { waitUntil: "networkidle2" });
    await page.waitForSelector(".konvajs-content", { timeout: 40000 });
    await sleep(800);
    const resumedBody = await bodyText(page);
    const canOrder = await page.evaluate(() =>
      [...document.querySelectorAll("button")].some(
        (button) =>
          (button.textContent ?? "").includes("Commander cette création") &&
          !button.disabled,
      ),
    );
    check(
      "Reprise : le produit est retrouvé et la commande reste possible",
      canOrder && resumedBody.includes("22 000 Ar") && resumedBody.includes("22 pages"),
    );
    check(
      "Reprise : le titre du projet est conservé",
      (await page.$eval('input[aria-label="Atelier de création"]', (input) => input.value)) ===
        "Cœurs & formes",
    );

    // ------------------------------------------------- 6. Responsive mobile
    section("Responsive");
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await sleep(800);
    check(
      "Atelier mobile : aucun débordement horizontal",
      !(await hasHorizontalOverflow(page)),
    );
    check(
      "Atelier mobile : barre d'outils accessible",
      await page.evaluate(() =>
        [...document.querySelectorAll("nav button")].some((button) =>
          (button.textContent ?? "").toLowerCase().includes("pages"),
        ),
      ),
    );
    await page.setViewport({ width: 1440, height: 1000 });
    await sleep(500);

    // ---------------------------------------------- 7. Panier et commande
    section("Commande et paiement Mobile Money");
    await clickByText(page, "Commander cette création", "button");
    await page.waitForFunction(() => window.location.pathname === "/panier", {
      timeout: 30000,
    });
    const cart = await bodyText(page);
    check(
      "Panier : création, 22 pages et tarif",
      cart.includes("Cœurs & formes") &&
        cart.includes("22 pages") &&
        cart.includes("22 000 Ar"),
    );

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await sleep(500);
    check("Panier mobile : aucun débordement horizontal", !(await hasHorizontalOverflow(page)));
    await page.setViewport({ width: 1440, height: 1000 });
    await sleep(500);

    await clickByText(page, "Passer commande", "a, button");
    await page.waitForFunction(() => window.location.pathname === "/commande", {
      timeout: 30000,
    });
    // Le formulaire est rendu en flux : attendre le bloc de paiement évite de
    // lire la page avant que le motif et le total n'apparaissent.
    await page.waitForSelector("#paymentReference", { timeout: 20000 });

    await setField(page, "#customerName", "Rakoto Jean");
    await setField(page, "#customerEmail", shopperEmail);
    await setField(page, "#customerPhone", "+261 34 11 223 34");

    // Zone la moins chère d'Antananarivo : 22 000 + 8 000 = 30 000 Ar.
    const zoneValue = await page.evaluate(() => {
      const option = [...document.querySelectorAll("#deliveryZoneId option")].find(
        (item) => (item.textContent ?? "").includes("Antananarivo — Centre"),
      );
      return option?.value ?? "";
    });
    await page.select("#deliveryZoneId", zoneValue);
    await page.type("#addressLine", "Lot II M 12 bis Ambatoroka");
    await waitForText(page, "30 000 Ar");

    const checkout = await bodyText(page);
    check(
      "Commande : MVola affiché avec le bon numéro et titulaire",
      checkout.includes("0389145273") &&
        checkout.includes("RANAIVO Andry Ny Avo Onenantsoa"),
    );
    check(
      "Commande : motif = nom du projet",
      /motif du transfert/i.test(checkout) && checkout.includes("Cœurs & formes"),
    );
    check(
      "Commande : Orange Money également proposé",
      checkout.includes("0375441549") && checkout.includes("Orange Money"),
    );

    await page.type("#paymentReference", "9876543210");
    await clickByText(page, "Confirmer la commande", "button");
    await page.waitForFunction(
      () => window.location.pathname.startsWith("/commande/MP-"),
      { timeout: 40000 },
    );

    const reference = page.url().split("/").pop();
    const confirmation = await bodyText(page);
    check("Commande : référence générée", /^MP-\d{4}-[0-9A-F]{6}$/.test(reference ?? ""), reference ?? "");
    check(
      "Commande : paiement en attente de vérification",
      confirmation.includes("En attente de vérification"),
    );
    check(
      "Commande : total avec livraison",
      confirmation.includes("30 000 Ar"),
      confirmation.includes("30 000 Ar") ? "22 000 + 8 000" : "total absent",
    );

    // -------------------------------------------------- 8. Validation admin
    section("Validation administrateur");
    await page.click('button[aria-label="Mon compte"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[role="menuitem"]').length > 0,
      { timeout: 5000 },
    );
    await clickByText(page, "Déconnexion", '[role="menuitem"]');
    await page.waitForFunction(() => window.location.pathname === "/", {
      timeout: 20000,
    });

    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
    await page.type("#email", "admin@myphoto.mg");
    await page.type("#password", "Admin1234!");
    await page.click("form:has(#email) button[type=submit]");
    await page.waitForFunction(() => window.location.pathname === "/admin", {
      timeout: 30000,
    });
    await page.waitForFunction(
      () => document.body.innerText.toLowerCase().includes("chiffre d'affaires"),
      { timeout: 20000 },
    );
    const adminDashboard = await bodyText(page);
    check(
      "Admin : tableau de bord accessible",
      adminDashboard.toLowerCase().includes("chiffre d'affaires"),
    );

    await page.goto(`${BASE}/admin/commandes?filtre=AWAITING_VERIFICATION`, {
      waitUntil: "networkidle2",
    });
    const orderHref = await page.evaluate((ref) => {
      const link = [...document.querySelectorAll("a")].find(
        (anchor) => (anchor.textContent ?? "").trim() === ref,
      );
      return link?.getAttribute("href") ?? "";
    }, reference);
    check("Admin : commande à vérifier listée", Boolean(orderHref), orderHref);

    await page.goto(`${BASE}${orderHref}`, { waitUntil: "networkidle2" });
    const adminOrder = await bodyText(page);
    check(
      "Admin : numéro, titulaire et référence visibles",
      adminOrder.includes("0389145273") &&
        adminOrder.includes("RANAIVO Andry Ny Avo Onenantsoa") &&
        adminOrder.includes("9876543210"),
    );

    await page.click('button[value="approve"]');
    await page.waitForFunction(
      () => document.body.innerText.includes("Payée"),
      { timeout: 30000 },
    );
    const paid = await bodyText(page);
    check("Admin : paiement validé", paid.includes("Payée"));
    check("Admin : commande confirmée", paid.includes("Confirmée"));

    // La validation manuelle notifie le client avec un délai annoncé.
    await page.goto(`${BASE}/commande/${reference}`, { waitUntil: "networkidle2" });
    const orderView = await bodyText(page);
    check(
      "Commande : bannière « Paiement validé » avec délai annoncé",
      orderView.includes("Paiement validé") &&
        /Livraison prévue sous \d+ jours/.test(orderView),
      (orderView.match(/Livraison prévue sous \d+ jours[^\n]*/) ?? ["absente"])[0],
    );

    // ------------------------------------------------ 9. Catalogue A4 seul
    section("Catalogue : photobook seul, tous les papiers");
    await page.goto(`${BASE}/produits`, { waitUntil: "networkidle2" });
    const catalogue = await bodyText(page);
    check(
      "Catalogue : le photobook uniquement",
      catalogue.includes("Photobook") &&
        !catalogue.includes("Mug personnalisé") &&
        !catalogue.includes("Tirage photo standard") &&
        !catalogue.includes("Cadre photo"),
    );
    check(
      "Catalogue : tarif 20 pages / 15 000 Ar",
      catalogue.includes("15 000 Ar") && catalogue.includes("20 pages"),
    );

    await page.goto(`${BASE}/produits/photobook`, { waitUntil: "networkidle2" });
    const product = await bodyText(page);
    // `innerText` respecte la capitalisation CSS : le libellé est en majuscules.
    const productUpper = product.toUpperCase();
    check(
      "Fiche produit : A4, A5, A6 et carré, pas de A3",
      productUpper.includes("A4") &&
        productUpper.includes("A5") &&
        productUpper.includes("A6") &&
        productUpper.includes("CARRÉ") &&
        product.includes("15 000 Ar") &&
        !productUpper.includes("A3"),
    );
    check(
      "Fiche produit : supplément de couverture solide affiché",
      product.includes("+ 5 000 Ar"),
    );

    // ------------------------------------- 9 bis. Back-office : CRUD
    section("Back-office : produits et zones de livraison");

    const uniqueName = `Album Test ${Date.now()}`;
    await page.goto(`${BASE}/admin/produits`, { waitUntil: "networkidle2" });
    await page.type("#new-nameFr", uniqueName);
    await page.type("#new-price", "12000");
    await page.click('form:has(#new-nameFr) button[type="submit"]');
    await waitForText(page, uniqueName, 25000);
    check("Admin : produit créé depuis le back-office", true, uniqueName);

    // Un format « Standard » est créé avec le produit, pour qu'il soit vendable.
    const createdSection = await page.evaluate((name) => {
      const heading = [...document.querySelectorAll("p")].find((node) =>
        (node.textContent ?? "").includes(name),
      );
      const section = heading?.closest("section");
      return section ? section.innerText : "";
    }, uniqueName);
    check(
      "Admin : format Standard créé avec le produit",
      createdSection.includes("Standard"),
      createdSection.replace(/\n/g, " · ").slice(0, 100),
    );

    // Ajout d'un second format sur ce produit.
    const variantAdded = await page.evaluate(async (name) => {
      const heading = [...document.querySelectorAll("p")].find((node) =>
        (node.textContent ?? "").includes(name),
      );
      const section = heading?.closest("section");
      const form = section
        ? [...section.querySelectorAll("form")].find((node) =>
            Boolean(node.querySelector('input[name="label"]')),
          )
        : null;
      if (!form) return false;

      const label = form.querySelector('input[name="label"]');
      const price = form.querySelector('input[name="priceMga"]');
      const submit = form.querySelector('button[type="submit"]');
      if (!label || !price || !submit) return false;

      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(label, "Grand format");
      label.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(price, "18000");
      price.dispatchEvent(new Event("input", { bubbles: true }));
      submit.click();
      return true;
    }, uniqueName);
    check("Admin : format ajouté à un produit", variantAdded);
    await sleep(2500);
    check(
      "Admin : nouveau format visible",
      (await bodyText(page)).includes("Grand format"),
    );

    const productDeleted = await page.evaluate((name) => {
      const heading = [...document.querySelectorAll("p")].find((node) =>
        (node.textContent ?? "").includes(name),
      );
      const section = heading?.closest("section");
      const button = section
        ? [...section.querySelectorAll("button")].find((node) =>
            (node.textContent ?? "").includes("Supprimer le produit"),
          )
        : null;
      if (!button) return false;
      button.scrollIntoView({ block: "center" });
      button.click();
      return true;
    }, uniqueName);
    check("Admin : suppression de produit confirmée", productDeleted);
    await sleep(2500);
    check(
      "Admin : produit supprimé (formats compris)",
      !(await bodyText(page)).includes(uniqueName),
    );

    const zoneName = `Zone Test ${Date.now()}`;
    await page.goto(`${BASE}/admin/zones`, { waitUntil: "networkidle2" });
    await page.type("#zone-name", zoneName);
    await page.type("#zone-city", "Ville Test");
    await page.type("#zone-fee", "9000");
    await page.click('form:has(#zone-name) button[type="submit"]');
    await waitForText(page, zoneName, 25000);
    check("Admin : zone de livraison créée", true, zoneName);

    const zoneDeleted = await page.evaluate((name) => {
      const heading = [...document.querySelectorAll("p")].find(
        (node) => (node.textContent ?? "").trim().startsWith(name),
      );
      const card = heading?.closest(".card");
      const button = card
        ? [...card.querySelectorAll("button")].find((node) =>
            (node.textContent ?? "").includes("Supprimer la zone"),
          )
        : null;
      if (!button) return false;
      button.click();
      return true;
    }, zoneName);
    check("Admin : suppression de zone confirmée", zoneDeleted);
    await sleep(2500);
    check(
      "Admin : zone supprimée",
      !(await bodyText(page)).includes(zoneName),
    );

    // ---------------------------------------------- 10. Responsive public
    section("Responsive public");
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    await sleep(500);
    check("Accueil mobile : aucun débordement horizontal", !(await hasHorizontalOverflow(page)));
    check(
      "Accueil mobile : menu disponible",
      await page.evaluate(() =>
        Boolean(document.querySelector('button[aria-label="Menu"]')),
      ),
    );
    await page.click('button[aria-label="Menu"]');
    await waitForText(page, "Photobooks");
    check("Accueil mobile : navigation ouverte", true);

    await page.goto(`${BASE}/produits`, { waitUntil: "networkidle2" });
    await sleep(400);
    check("Catalogue mobile : aucun débordement horizontal", !(await hasHorizontalOverflow(page)));

    await page.goto(`${BASE}/produits/photobook`, { waitUntil: "networkidle2" });
    await sleep(400);
    check("Fiche mobile : aucun débordement horizontal", !(await hasHorizontalOverflow(page)));

    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
    await sleep(400);
    check("Connexion mobile : aucun débordement horizontal", !(await hasHorizontalOverflow(page)));

    // ------------------------------------- 11. Notification côté client
    section("Notification client après validation");
    await page.setViewport({ width: 1440, height: 1000 });

    await page.click('button[aria-label="Mon compte"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[role="menuitem"]').length > 0,
      { timeout: 5000 },
    );
    await clickByText(page, "Déconnexion", '[role="menuitem"]');
    await page.waitForFunction(() => window.location.pathname === "/", {
      timeout: 20000,
    });

    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
    await page.type("#email", shopperEmail);
    await page.type("#password", "MotDePasse123");
    await page.click("form:has(#email) button[type=submit]");
    await page.waitForFunction(() => window.location.pathname !== "/connexion", {
      timeout: 30000,
    });

    await page.goto(`${BASE}/compte`, { waitUntil: "networkidle2" });
    const notified = await bodyText(page);
    check(
      "Compte : notification « Paiement validé » avec délai annoncé",
      notified.includes("Paiement validé") &&
        /Livraison prévue sous \d+ jours/.test(notified),
      (notified.match(/Livraison prévue sous \d+ jours[^\n]*/) ?? ["absente"])[0],
    );
    check(
      "Compte : cloche de notifications dans l'en-tête",
      await page.evaluate(() =>
        Boolean(document.querySelector('button[aria-label="Notifications"]')),
      ),
    );
    check("Compte mobile ou non : aucun débordement horizontal", !(await hasHorizontalOverflow(page)));
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
