/**
 * Sonde de robustesse : cas limites, entrées forgées et contrôle d'accès.
 *
 * Contrairement à scripts/e2e.mjs (parcours nominal), ce script cherche à
 * casser l'application. Chaque ligne BUG correspond à un comportement
 * anormal observé, pas à une hypothèse de lecture de code.
 *
 *   npm run dev
 *   npm run probe
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
import { jwtVerify } from "jose";
import pg from "pg";
import puppeteer from "puppeteer-core";

// `localhost` et non `127.0.0.1` : sinon le canal HMR du serveur de
// développement est refusé et les composants clients ne s'hydratent pas.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ARTIFACTS = path.resolve(".e2e-artifacts");
const CHROME =
  process.env.CHROME_PATH ??
  ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(
    (candidate) => existsSync(candidate),
  ) ??
  "/usr/bin/google-chrome";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const findings = [];

function record(id, description, verdict, detail = "") {
  // verdict: "OK" (comportement correct attendu) | "BUG" | "WARN"
  findings.push({ id, description, verdict, detail });
  const tag = verdict === "BUG" ? "\x1b[31mBUG\x1b[0m" : verdict === "WARN" ? "\x1b[33mWARN\x1b[0m" : "ok ";
  console.log(`${tag} ${id.padEnd(6)} ${description}${detail ? ` — ${detail}` : ""}`);
}

async function sql(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Produit de contrôle des sondes de panier.
 *
 * Le catalogue ne vend plus que le photobook, or les sondes B2 à B20 portent
 * sur un produit classique (celui qui affiche le panneau d'achat). On active
 * donc le temps de la sonde un produit déjà présent en base, puis on le
 * remet dans son état d'origine.
 */
const PROBE_PRODUCT_SLUG = "tirage-standard";
const PROBE_TRANSACTION_REF = "9876543210";

async function setProbeProductActive(isActive) {
  await sql('update "Product" set "isActive" = $1, "updatedAt" = now() where slug = $2', [
    isActive,
    PROBE_PRODUCT_SLUG,
  ]);
}

/**
 * Produit de contrôle des sondes B2 à B20.
 *
 * Le seed ne crée que le photobook, dont l'atelier gère le panier lui-même :
 * les sondes ont besoin d'un produit « classique » (panneau d'achat avec format,
 * quantité, bouton « Ajouter au panier »). Il est créé **inactif** au premier
 * lancement sur une base fraîche, puis activé le temps des sondes et remis
 * inactif — jamais visible dans le catalogue.
 */
async function ensureProbeProduct() {
  const existing = await sql('select id from "Product" where slug = $1', [PROBE_PRODUCT_SLUG]);
  if (existing.length > 0) return;

  const categories = await sql('select id from "Category" order by "createdAt" asc limit 1');
  if (categories.length === 0) {
    throw new Error("Aucune catégorie en base : lancez d'abord `npm run db:seed`.");
  }

  const productId = `probe-product-${Date.now()}`;
  await sql(
    `insert into "Product" (id, slug, "categoryId", "nameFr", "nameMg", "descriptionFr",
       "descriptionMg", "basePriceMga", "leadTimeDays", "isActive", "isFeatured",
       "sortOrder", "createdAt", "updatedAt")
     values ($1, $2, $3, $4, $4, $5, $5, $6, 2, false, false, 0, now(), now())`,
    [
      productId,
      PROBE_PRODUCT_SLUG,
      categories[0].id,
      "Tirage standard 10 × 15 cm",
      "Produit de contrôle des sondes de robustesse, jamais affiché dans le catalogue.",
      800,
    ],
  );
  await sql(
    `insert into "ProductVariant" (id, "productId", sku, label, "widthMm", "heightMm",
       "pageCount", "priceMga", "isDefault", "isActive", "sortOrder")
     values ($1, $2, $3, $4, 100, 150, 1, 800, true, true, 0)`,
    [`probe-variant-${Date.now()}`, productId, "tirage-10x15", "10 × 15 cm"],
  );
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
  if (!clicked) throw new Error(`Élément introuvable : "${text}"`);
}

/**
 * Les champs de contact sont préremplis pour un client connecté : il faut les
 * vider avant de saisir, sinon `type()` concatène et produit un e-mail invalide.
 */
async function setField(page, selector, value) {
  await page.$eval(selector, (element) => {
    element.value = "";
  });
  await page.type(selector, value);
}

async function submitOrder(page) {
  await clickByText(page, "Confirmer la commande");

  try {
    await page.waitForFunction(() => window.location.pathname.startsWith("/commande/MP-"), {
      timeout: 40000,
    });
  } catch (error) {
    const excerpt = await page.evaluate(() => document.body.innerText);
    throw new Error(
      `Commande non créée (url ${page.url()}) — extrait de page : ${excerpt.slice(0, 700)}`,
    );
  }

  return page.url().split("/").pop();
}

async function fillCheckout(page, { method, delivery = "HOME_DELIVERY", reference = null }) {
  await setField(page, "#customerName", "Client Test");
  await setField(page, "#customerEmail", `probe.${Date.now()}@example.mg`);
  await setField(page, "#customerPhone", "+261 34 00 000 00");

  if (delivery === "HOME_DELIVERY") {
    const zoneValue = await page.$eval("#deliveryZoneId option:nth-child(2)", (o) => o.value);
    await page.select("#deliveryZoneId", zoneValue);
    await setField(page, "#addressLine", "Lot 12 Ambatoroka");
  }
  // Le retrait en boutique est désactivé (aucun point de vente) : la sonde B8
  // force le champ elle-même pour vérifier que le serveur refuse.
  void delivery;

  await page.click(`input[value="${method}"]`);
  if (reference) {
    await page.waitForSelector("#paymentReference", { timeout: 10000 });
    await setField(page, "#paymentReference", reference);
  }
}

// ---------------------------------------------------------------------------
// Sondes HTTP directes
// ---------------------------------------------------------------------------

async function httpProbes() {
  // S1 — upload sans fichier
  const noFile = await fetch(`${BASE}/api/uploads`, { method: "POST", body: new FormData() });
  record(
    "S1",
    "POST /api/uploads sans fichier rejeté",
    noFile.status === 400 ? "OK" : "BUG",
    `HTTP ${noFile.status}`,
  );

  // S2 — upload d'un type non autorisé
  const badType = new FormData();
  badType.append("file", new Blob(["#!/bin/sh\necho pwned"], { type: "text/x-sh" }), "evil.sh");
  const badResponse = await fetch(`${BASE}/api/uploads`, { method: "POST", body: badType });
  record(
    "S2",
    "Upload d'un script déguisé en fichier rejeté",
    badResponse.status === 415 ? "OK" : "BUG",
    `HTTP ${badResponse.status}`,
  );

  // S3 — upload d'une image invalide portant un bon type MIME
  const fakeImage = new FormData();
  fakeImage.append(
    "file",
    new Blob([Buffer.from("ceci n'est pas une image")], { type: "image/png" }),
    "fake.png",
  );
  const fakeResponse = await fetch(`${BASE}/api/uploads`, { method: "POST", body: fakeImage });
  const fakeBody = await fakeResponse.json().catch(() => ({}));
  record(
    "S3",
    "Image corrompue rejetée (pas de 500 ni de fichier écrit)",
    fakeResponse.status === 422 ? "OK" : "BUG",
    `HTTP ${fakeResponse.status} ${JSON.stringify(fakeBody)}`,
  );

  // S4 — upload dépassant la limite de taille
  const big = new FormData();
  big.append("file", new Blob([Buffer.alloc(26 * 1024 * 1024, 1)], { type: "image/jpeg" }), "big.jpg");
  const bigResponse = await fetch(`${BASE}/api/uploads`, { method: "POST", body: big });
  record(
    "S4",
    "Fichier de 26 Mo refusé",
    bigResponse.status === 413 ? "OK" : "BUG",
    `HTTP ${bigResponse.status}`,
  );

  // S5 — extension interdite sur /api/files
  const shFile = await fetch(`${BASE}/api/files/x/y.sh`);
  record(
    "S5",
    "Extension non autorisée sur /api/files refusée",
    shFile.status === 415 ? "OK" : "BUG",
    `HTTP ${shFile.status}`,
  );

  // S6 — page produit inexistante
  const missing = await fetch(`${BASE}/produits/produit-inexistant`);
  record(
    "S6",
    "Produit inexistant renvoie 404",
    missing.status === 404 ? "OK" : "BUG",
    `HTTP ${missing.status}`,
  );

  // S7 — accès invité au back-office
  const adminGuest = await fetch(`${BASE}/admin`, { redirect: "manual" });
  const redirected = adminGuest.status === 307 || adminGuest.status === 302 || adminGuest.status === 303;
  record(
    "S7",
    "Invité redirigé hors du back-office",
    redirected ? "OK" : "BUG",
    `HTTP ${adminGuest.status} → ${adminGuest.headers.get("location") ?? "aucune redirection"}`,
  );

  // S8 — commande inconnue
  const unknownOrder = await fetch(`${BASE}/commande/MP-2026-ZZZZZZ`);
  record(
    "S8",
    "Référence de commande inconnue renvoie 404",
    unknownOrder.status === 404 ? "OK" : "BUG",
    `HTTP ${unknownOrder.status}`,
  );

  // S9/S10 — la création est réservée aux comptes : plus aucune écriture
  // anonyme n'est possible depuis l'atelier.
  const editorGuest = await fetch(`${BASE}/editeur`, { redirect: "manual" });
  const editorRedirect = editorGuest.headers.get("location") ?? "";
  record(
    "S9",
    "Atelier inaccessible sans compte",
    editorGuest.status === 307 && editorRedirect.includes("/connexion") ? "OK" : "BUG",
    `HTTP ${editorGuest.status} → ${editorRedirect || "aucune redirection"}`,
  );

  const wizardGuest = await fetch(`${BASE}/creer`, { redirect: "manual" });
  const wizardRedirect = wizardGuest.headers.get("location") ?? "";
  record(
    "S10",
    "Assistant photobook inaccessible sans compte, destination conservée",
    wizardGuest.status === 307 && wizardRedirect.includes("next=%2Fcreer") ? "OK" : "BUG",
    `HTTP ${wizardGuest.status} → ${wizardRedirect || "aucune redirection"}`,
  );

  // S11 — flux OAuth : soit le fournisseur est configuré et la redirection doit
  // être conforme, soit il ne l'est pas et l'application doit le dire
  // clairement. La sonde ne devine pas : elle lit la réponse du serveur.
  const start = await fetch(`${BASE}/api/auth/google/start`, { redirect: "manual" });
  const authorizeUrl = start.headers.get("location") ?? "";
  const stateCookie = start.headers.get("set-cookie") ?? "";
  const providerConfigured = !authorizeUrl.includes("erreur=indisponible");

  if (!providerConfigured) {
    record(
      "S11",
      "Connexion Google non configurée : renvoi explicite vers la connexion",
      start.status === 307 ? "OK" : "BUG",
      `HTTP ${start.status} → ${authorizeUrl || "aucune redirection"}`,
    );
  } else {
    const target = new URL(authorizeUrl);
    const wellFormed =
      target.host === "accounts.google.com" &&
      target.searchParams.get("response_type") === "code" &&
      Boolean(target.searchParams.get("state")) &&
      target.searchParams.get("code_challenge_method") === "S256" &&
      target.searchParams.get("code_challenge") !== null &&
      stateCookie.includes("mp_oauth=");

    record(
      "S11",
      "Connexion Google : redirection conforme (PKCE, état signé, cookie httpOnly)",
      start.status === 307 && wellFormed ? "OK" : "BUG",
      `${target.host} · state=${target.searchParams.get("state") ? "présent" : "absent"} · PKCE=${
        target.searchParams.get("code_challenge_method") ?? "absent"
      }`,
    );
  }

  // S12 — le retour OAuth exige l'état signé, et l'échange doit échouer
  // proprement (pas de 500, pas de session) avec un code bidon.
  const forgedState = await fetch(
    `${BASE}/api/auth/google/callback?code=bidon&state=etat-inconnu`,
    { redirect: "manual", headers: { cookie: "mp_oauth=faux.jeton" } },
  );
  const forgedLocation = forgedState.headers.get("location") ?? "";
  record(
    "S12",
    "Retour OAuth avec un état forgé refusé",
    forgedState.status === 307 && forgedLocation.includes("erreur=etat") ? "OK" : "BUG",
    `HTTP ${forgedState.status} → ${forgedLocation || "aucune redirection"}`,
  );

  if (providerConfigured && stateCookie) {
    const token = /mp_oauth=([^;]+)/.exec(stateCookie)?.[1];
    const nonce = token ? await nonceFromState(token) : null;

    const exchange = await fetch(
      `${BASE}/api/auth/google/callback?code=code-bidon&state=${nonce ?? ""}`,
      { redirect: "manual", headers: { cookie: `mp_oauth=${token}` } },
    );
    const exchangeLocation = exchange.headers.get("location") ?? "";

    record(
      "S12b",
      "Retour OAuth accepté avec son état, puis échec d'échange maîtrisé",
      nonce && exchange.status === 307 && exchangeLocation.includes("erreur=echec")
        ? "OK"
        : "BUG",
      `HTTP ${exchange.status} → ${exchangeLocation || "aucune redirection"}`,
    );

    // Seul le flux OAuth écrit dans OAuthAccount : compter les lignes récentes
    // mesure donc directement l'effet d'un échange invalide.
    const links = await sql(
      'select count(*)::int as n from "OAuthAccount" where "createdAt" > now() - interval \'2 minutes\'',
    );
    record(
      "S12c",
      "Aucun compte créé par un échange OAuth invalide",
      links[0].n === 0 ? "OK" : "BUG",
      `${links[0].n} rattachement(s) créé(s) pendant la sonde`,
    );
  }

  // S13 — domaine externe dans `next` : jamais de redirection ouverte.
  const phone = `0349${String(Date.now()).slice(-6)}`;
  const startCode = await fetch(`${BASE}/api/auth/whatsapp/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const startPayload = await startCode.json().catch(() => ({}));

  const openRedirect = await fetch(`${BASE}/api/auth/whatsapp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phone,
      code: startPayload.devCode ?? "000000",
      next: "https://exemple.test/phishing",
    }),
  });
  const openRedirectPayload = await openRedirect.json().catch(() => ({}));

  if (!startPayload.devCode) {
    record(
      "S13",
      "Retour après connexion limité aux chemins internes",
      "WARN",
      "code réel indisponible (fournisseur WhatsApp configuré) : sonde non concluante",
    );
  } else {
    const destination = openRedirectPayload.redirect ?? "";
    const internalOnly =
      openRedirect.status === 200 && destination.startsWith("/") && !destination.startsWith("//");

    record(
      "S13",
      "Retour après connexion limité aux chemins internes",
      internalOnly ? "OK" : "BUG",
      `redirection annoncée : ${destination || "aucune"}`,
    );
  }

  // S14 — numéros invalides et corps malformé.
  const badPhone = await fetch(`${BASE}/api/auth/whatsapp/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "pas-un-numero" }),
  });
  record(
    "S14",
    "Numéro WhatsApp invalide refusé",
    badPhone.status === 400 ? "OK" : "BUG",
    `HTTP ${badPhone.status}`,
  );

  const brokenBody = await fetch(`${BASE}/api/auth/whatsapp/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{ceci n'est pas du JSON",
  });
  record(
    "S15",
    "Corps illisible refusé sans erreur serveur",
    brokenBody.status === 400 ? "OK" : "BUG",
    `HTTP ${brokenBody.status}`,
  );

  // S16 — limitation du nombre de codes par numéro.
  let rateLimited = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE}/api/auth/whatsapp/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (response.status === 429) rateLimited = true;
  }
  record(
    "S16",
    "Demandes de code WhatsApp limitées par numéro",
    rateLimited ? "OK" : "BUG",
    rateLimited ? "429 après trois demandes" : "aucune limitation observée",
  );

  // S17 — cinq essais infructueux invalident le code, même si le bon arrive ensuite.
  const brutePhone = `0348${String(Date.now()).slice(-6)}`;
  const bruteStart = await fetch(`${BASE}/api/auth/whatsapp/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: brutePhone }),
  });
  const brutePayload = await bruteStart.json().catch(() => ({}));
  const bruteCode = brutePayload.devCode ?? null;

  if (!bruteCode) {
    record(
      "S17",
      "Code WhatsApp devinable bloqué après plusieurs essais",
      "WARN",
      "code réel indisponible (fournisseur WhatsApp configuré) : sonde non concluante",
    );
  } else {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await fetch(`${BASE}/api/auth/whatsapp/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: brutePhone, code: "111111" }),
      });
    }

    const afterBruteForce = await fetch(`${BASE}/api/auth/whatsapp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: brutePhone, code: bruteCode }),
    });

    record(
      "S17",
      "Code WhatsApp invalidé après cinq essais infructueux",
      afterBruteForce.status === 400 ? "OK" : "BUG",
      `HTTP ${afterBruteForce.status} avec le bon code après cinq échecs`,
    );
  }
}

/** Extrait le nonce d'un jeton d'état OAuth en le vérifiant avec la clé du serveur. */
async function nonceFromState(token) {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.AUTH_SECRET),
      { algorithms: ["HS256"] },
    );
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sondes navigateur
// ---------------------------------------------------------------------------

async function signedInPage(browser, email, password) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
  await page.type("#email", email);
  await page.type("#password", password);
  await clickByText(page, "Se connecter");
  await page.waitForFunction(() => window.location.pathname !== "/connexion", { timeout: 30000 });
  return { context, page };
}

async function browserProbes(browser) {
  await ensureProbeProduct();
  await setProbeProductActive(true);
  try {
    await runBrowserProbes(browser);
  } finally {
    // Le catalogue doit repartir exactement comme il était : photobook seul.
    await setProbeProductActive(false);
  }
}

async function runBrowserProbes(browser) {
  const guest = await browser.createBrowserContext();
  const page = await guest.newPage();

  // B1 — panier vide : /commande doit renvoyer vers /panier
  await page.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });
  record(
    "B1",
    "Tunnel de commande inaccessible avec un panier vide",
    page.url().endsWith("/panier") ? "OK" : "BUG",
    page.url(),
  );

  // B2 — ajout au panier avec un identifiant de format forgé
  await page.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
  const before = await sql('select count(*)::int as n from "CartItem"');
  await page.$eval('input[name="variantId"]', (input) => {
    input.value = "format-inexistant-000";
  });
  await page.$eval('input[name="productId"]', (input) => {
    // produit actif mais incohérent avec le format
    input.value = "produit-inexistant-000";
  });
  await clickByText(page, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const after = await sql('select count(*)::int as n from "CartItem"');
  record(
    "B2",
    "Ajout au panier avec produit/format forgés refusé",
    before[0].n === after[0].n ? "OK" : "BUG",
    `${before[0].n} → ${after[0].n} lignes de panier`,
  );

  // B3 — quantité hors bornes
  await page.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
  await page.$eval('input[name="quantity"]', (input) => {
    input.value = "999999";
  });
  await clickByText(page, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const bigQty = await sql(
    'select quantity from "CartItem" order by "createdAt" desc limit 1',
  );
  record(
    "B3",
    "Quantité plafonnée à 500",
    bigQty[0]?.quantity <= 500 ? "OK" : "BUG",
    `quantité enregistrée : ${bigQty[0]?.quantity}`,
  );

  // B3b/B4/B5/B5b — contrôle d'accès sur les créations, entre deux comptes.
  // Depuis que l'atelier exige un compte, la question n'est plus « visiteur
  // contre visiteur » mais « client contre client » : un client enregistre une
  // création, un autre tente de se l'attribuer.
  const owner = await signedInPage(browser, "client@myphoto.mg", "Client1234!");
  const ownerPage = owner.page;
  const countLayers = (target) =>
    target.evaluate(() => {
      const heading = [...document.querySelectorAll("h2")].find((element) =>
        (element.textContent ?? "").trim().startsWith("Calques"),
      );
      return heading?.parentElement?.querySelectorAll("li").length ?? 0;
    });

  await ownerPage.goto(`${BASE}/editeur`, { waitUntil: "networkidle2" });
  await ownerPage.waitForSelector("canvas", { timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const designsBeforeOwner = await sql('select count(*)::int as n from "Design"');

  // L'hydratation peut précéder le premier clic : on réessaie jusqu'à ce que le
  // calque apparaisse réellement, sinon la sonde testerait une création vide.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await countLayers(ownerPage)) > 0) break;
    await clickByText(ownerPage, "Ajouter un texte");
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  // Le bouton affiche « Enregistrer » : c'est son titre qui porte le libellé complet.
  await ownerPage.click('button[title="Enregistrer la création"]');
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const designRows = await sql(
    'select id, title, "userId", "guestSessionId" from "Design" order by "createdAt" desc limit 1',
  );
  const foreignDesignId = designRows[0]?.id;
  const designsAfterOwner = await sql('select count(*)::int as n from "Design"');

  // Sans cette vérification, les sondes suivantes passeraient en testant une
  // ligne périmée et ne prouveraient rien.
  const savedOk = designsAfterOwner[0].n === designsBeforeOwner[0].n + 1;
  record(
    "B3b",
    "La création d'un client est enregistrée et rattachée à son compte",
    savedOk && Boolean(designRows[0]?.userId) && !designRows[0]?.guestSessionId ? "OK" : "BUG",
    `${designsBeforeOwner[0].n} → ${designsAfterOwner[0].n} créations · compte=${
      designRows[0]?.userId ? "renseigné" : "VIDE"
    }`,
  );

  if (!foreignDesignId) {
    record("B4", "Contrôle d'accès sur l'identifiant de création", "BUG", "aucune création en base");
  } else {
    // Un second client, créé pour la sonde, tente de s'attribuer la création.
    const intruder = await browser.createBrowserContext();
    const intruderPage = await intruder.newPage();
    await intruderPage.goto(`${BASE}/inscription`, { waitUntil: "networkidle2" });
    await intruderPage.type("#name", "Client Intrus");
    await intruderPage.type("#email", `intrus.${Date.now()}@example.mg`);
    await intruderPage.type("#password", "MotDePasse123");
    await clickByText(intruderPage, "Créer mon compte");
    await intruderPage.waitForFunction(() => window.location.pathname === "/compte", {
      timeout: 30000,
    });

    await intruderPage.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
    await intruderPage.$eval(
      'input[name="designId"]',
      (input, id) => {
        input.value = id;
      },
      foreignDesignId,
    );
    await clickByText(intruderPage, "Ajouter au panier");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const stolen = await sql(
      'select count(*)::int as n from "CartItem" where "designId" = $1',
      [foreignDesignId],
    );
    record(
      "B4",
      "Création d'un autre client refusée dans le panier",
      stolen[0].n === 0 ? "OK" : "BUG",
      stolen[0].n === 0
        ? "refusé"
        : `la création ${foreignDesignId} a été rattachée au panier d'un autre client`,
    );

    // B5 — la même création doit rester inaccessible depuis l'atelier
    await intruderPage.goto(`${BASE}/editeur?design=${foreignDesignId}`, {
      waitUntil: "networkidle2",
    });
    await intruderPage.waitForSelector("canvas", { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const stolenLayers = await countLayers(intruderPage);
    record(
      "B5",
      "Création d'un autre client non rouverte dans l'atelier",
      stolenLayers === 0 ? "OK" : "BUG",
      `${stolenLayers} calque(s) chargé(s)`,
    );

    // B5b — le propriétaire ne doit pas être bloqué par le contrôle
    await ownerPage.goto(`${BASE}/editeur?design=${foreignDesignId}`, {
      waitUntil: "networkidle2",
    });
    await ownerPage.waitForSelector("canvas", { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const ownLayers = await countLayers(ownerPage);
    record(
      "B5b",
      "Le propriétaire rouvre sa propre création",
      ownLayers >= 1 ? "OK" : "BUG",
      `${ownLayers} calque(s) restauré(s)`,
    );

    await intruder.close();
  }
  await owner.context.close();

  // B6 — paiement à la livraison et virement : retirés du tunnel sur demande,
  //       seule la validation Mobile Money manuelle doit subsister.
  await page.goto(`${BASE}/produits/${PROBE_PRODUCT_SLUG}`, { waitUntil: "networkidle2" });
  await clickByText(page, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await page.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });
  const offeredMethods = await page.$$eval('input[name="paymentMethod"]', (nodes) =>
    nodes.map((node) => node.value),
  );
  const onlyMobileMoney =
    offeredMethods.length > 0 &&
    !offeredMethods.includes("CASH_ON_DELIVERY") &&
    !offeredMethods.includes("BANK_TRANSFER");
  record(
    "B6",
    "Paiement à la livraison et virement absents du tunnel",
    onlyMobileMoney ? "OK" : "BUG",
    `méthodes proposées : ${offeredMethods.join(", ") || "aucune"}`,
  );

  // B7 — validation manuelle d'un paiement Mobile Money, comptée en CA.
  await fillCheckout(page, { method: "MVOLA", reference: PROBE_TRANSACTION_REF });
  const mvolaReference = await submitOrder(page);

  const admin = await signedInPage(browser, "admin@myphoto.mg", "Admin1234!");
  const mvolaRow = await sql('select id from "Order" where reference = $1', [mvolaReference]);
  await admin.page.goto(`${BASE}/admin/commandes/${mvolaRow[0].id}`, {
    waitUntil: "networkidle2",
  });
  await admin.page.click('button[value="approve"]');
  await new Promise((resolve) => setTimeout(resolve, 4500));

  const approval = await sql(
    'select "paymentStatus", status, "paidAt" from "Order" where reference = $1',
    [mvolaReference],
  );
  const revenue = await sql(
    `select coalesce(sum("totalMga"),0)::int as paid from "Order" where "paymentStatus" = 'PAID' and reference = $1`,
    [mvolaReference],
  );
  const collected =
    approval[0].paymentStatus === "PAID" &&
    approval[0].paidAt !== null &&
    approval[0].status === "CONFIRMED" &&
    revenue[0].paid > 0;

  record(
    "B7",
    "Paiement Mobile Money validé manuellement et compté dans le chiffre d'affaires",
    collected ? "OK" : "BUG",
    `paiement=${approval[0].paymentStatus} · statut=${approval[0].status} · payé le=${
      approval[0].paidAt ? "renseigné" : "vide"
    } · CA compté=${revenue[0].paid} Ar`,
  );
  await admin.context.close();

  // B8 — retrait en boutique : grisé tant qu'aucun point de vente n'existe,
  //      et refusé par le serveur même si le client force le champ.
  await page.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
  await clickByText(page, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await page.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });

  const pickupText = await page.evaluate(() => document.body.innerText);
  const pickupDisabled = await page.$eval('input[value="PICKUP"]', (input) => input.disabled);
  const pickupNoted = pickupText.includes("Bientôt disponible");

  const ordersBefore8 = await sql('select count(*)::int as n from "Order"');
  await fillCheckout(page, { method: "MVOLA", reference: PROBE_TRANSACTION_REF });
  await page.$eval('input[value="PICKUP"]', (input) => {
    input.disabled = false;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await clickByText(page, "Confirmer la commande");
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const ordersAfter8 = await sql('select count(*)::int as n from "Order"');
  const refused8 =
    ordersBefore8[0].n === ordersAfter8[0].n &&
    page.url().includes("/commande") &&
    !page.url().includes("/MP-");
  const message8 = (await page.evaluate(() => document.body.innerText)).includes(
    "Bientôt disponible",
  );

  record(
    "B8",
    "Retrait en boutique désactivé : option grisée et commande refusée côté serveur",
    pickupDisabled && pickupNoted && refused8 && message8 ? "OK" : "BUG",
    `grisé=${pickupDisabled} · note=${pickupNoted} · refus=${refused8} · message=${message8} · ${ordersBefore8[0].n} → ${ordersAfter8[0].n} commandes`,
  );

  // B9 — livraison sans zone sélectionnée
  await page.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
  await clickByText(page, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await page.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });
  const ordersBefore = await sql('select count(*)::int as n from "Order"');
  await page.type("#customerName", "Sans Zone");
  await page.type("#customerEmail", `sanszone.${Date.now()}@example.mg`);
  await page.type("#customerPhone", "+261 34 00 000 00");
  await page.select("#deliveryZoneId", "");
  await page.type("#addressLine", "Adresse quelconque");
  await clickByText(page, "Confirmer la commande");
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const ordersAfter = await sql('select count(*)::int as n from "Order"');
  const stillOnCheckout = page.url().includes("/commande") && !page.url().includes("/MP-");
  record(
    "B9",
    "Livraison sans zone : commande refusée",
    ordersBefore[0].n === ordersAfter[0].n && stillOnCheckout ? "OK" : "BUG",
    `${ordersBefore[0].n} → ${ordersAfter[0].n} commandes · url ${page.url()}`,
  );

  // B10 — Mobile Money sans numéro de transaction
  await page.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });
  const before10 = await sql('select count(*)::int as n from "Order"');
  await page.type("#customerName", "Sans Reference");
  await page.type("#customerEmail", `sansref.${Date.now()}@example.mg`);
  await page.type("#customerPhone", "+261 34 00 000 00");
  const zone10 = await page.$eval("#deliveryZoneId option:nth-child(2)", (o) => o.value);
  await page.select("#deliveryZoneId", zone10);
  await page.type("#addressLine", "Lot 5 Analakely");
  await page.click('input[value="MVOLA"]');
  await page.waitForSelector("#paymentReference", { timeout: 10000 });
  await clickByText(page, "Confirmer la commande");
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const after10 = await sql('select count(*)::int as n from "Order"');
  record(
    "B10",
    "Mobile Money sans numéro de transaction refusé",
    before10[0].n === after10[0].n ? "OK" : "BUG",
    `${before10[0].n} → ${after10[0].n} commandes`,
  );

  // B11 — numéro de transaction absurde
  const badRef = await sql(
    `select count(*)::int as n from "Order" where "paymentReference" is not null and length("paymentReference") < 4`,
  );
  record(
    "B11",
    "Aucune commande enregistrée avec un numéro de transaction trop court",
    badRef[0].n === 0 ? "OK" : "BUG",
    `${badRef[0].n} commande(s) concernée(s)`,
  );

  // B12 — accès à la commande d'un autre client connecté
  const aliceContext = await browser.createBrowserContext();
  const alicePage = await aliceContext.newPage();
  await alicePage.goto(`${BASE}/inscription`, { waitUntil: "networkidle2" });
  const aliceEmail = `alice.${Date.now()}@example.mg`;
  await alicePage.type("#name", "Alice Probe");
  await alicePage.type("#email", aliceEmail);
  await alicePage.type("#password", "MotDePasse123");
  await clickByText(alicePage, "Créer mon compte");
  await alicePage.waitForFunction(() => window.location.pathname === "/compte", { timeout: 30000 });
  await alicePage.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
  await clickByText(alicePage, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await alicePage.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });
  await fillCheckout(alicePage, { method: "MVOLA", reference: PROBE_TRANSACTION_REF });
  const aliceReference = await submitOrder(alicePage);
  await aliceContext.close();

  const bob = await browser.createBrowserContext();
  const bobPage = await bob.newPage();
  await bobPage.goto(`${BASE}/inscription`, { waitUntil: "networkidle2" });
  await bobPage.type("#name", "Bob Probe");
  await bobPage.type("#email", `bob.${Date.now()}@example.mg`);
  await bobPage.type("#password", "MotDePasse123");
  await clickByText(bobPage, "Créer mon compte");
  await bobPage.waitForFunction(() => window.location.pathname === "/compte", { timeout: 30000 });

  const bobResponse = await bobPage.goto(`${BASE}/commande/${aliceReference}`, {
    waitUntil: "networkidle2",
  });
  record(
    "B12",
    "Commande nominative d'un autre client inaccessible",
    bobResponse.status() === 404 ? "OK" : "BUG",
    `HTTP ${bobResponse.status()}`,
  );
  await bob.close();

  // B13 — inscription avec un e-mail déjà utilisé
  const dup = await browser.createBrowserContext();
  const dupPage = await dup.newPage();
  await dupPage.goto(`${BASE}/inscription`, { waitUntil: "networkidle2" });
  await dupPage.type("#name", "Doublon");
  await dupPage.type("#email", aliceEmail);
  await dupPage.type("#password", "MotDePasse123");
  await clickByText(dupPage, "Créer mon compte");
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const dupBody = await dupPage.evaluate(() => document.body.innerText);
  const dupUsers = await sql('select count(*)::int as n from "User" where email = $1', [aliceEmail]);
  record(
    "B13",
    "Inscription avec un e-mail existant refusée",
    dupBody.includes("déjà utilisé") && dupUsers[0].n === 1 ? "OK" : "BUG",
    `${dupUsers[0].n} compte(s) pour cet e-mail`,
  );
  await dup.close();

  // B14 — mot de passe trop court
  const weak = await browser.createBrowserContext();
  const weakPage = await weak.newPage();
  await weakPage.goto(`${BASE}/inscription`, { waitUntil: "networkidle2" });
  const weakEmail = `weak.${Date.now()}@example.mg`;
  await weakPage.type("#name", "Mot Faible");
  await weakPage.type("#email", weakEmail);
  await weakPage.$eval("#password", (input) => {
    input.value = "court";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await clickByText(weakPage, "Créer mon compte");
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const weakUsers = await sql('select count(*)::int as n from "User" where email = $1', [weakEmail]);
  record(
    "B14",
    "Mot de passe de moins de 8 caractères refusé",
    weakUsers[0].n === 0 ? "OK" : "BUG",
    `${weakUsers[0].n} compte(s) créé(s)`,
  );
  await weak.close();

  // B15 — mauvais mot de passe
  const wrong = await browser.createBrowserContext();
  const wrongPage = await wrong.newPage();
  await wrongPage.goto(`${BASE}/connexion`, { waitUntil: "networkidle2" });
  await wrongPage.type("#email", "client@myphoto.mg");
  await wrongPage.type("#password", "MauvaisMotDePasse");
  await clickByText(wrongPage, "Se connecter");
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const wrongBody = await wrongPage.evaluate(() => document.body.innerText);
  record(
    "B15",
    "Mauvais mot de passe rejeté sans ouvrir de session",
    wrongBody.includes("incorrect") && wrongPage.url().includes("/connexion") ? "OK" : "BUG",
    wrongBody.includes("incorrect") ? "message affiché" : "aucun message",
  );
  await wrong.close();

  // B16 — un client connecté ne doit pas atteindre le back-office
  const customer = await signedInPage(browser, "client@myphoto.mg", "Client1234!");
  const customerAdmin = await customer.page.goto(`${BASE}/admin`, { waitUntil: "networkidle2" });
  record(
    "B16",
    "Client connecté redirigé hors du back-office",
    !customerAdmin.url().includes("/admin") ? "OK" : "BUG",
    `arrivée sur ${customerAdmin.url()}`,
  );
  await customer.context.close();

  // B17 — double soumission du formulaire de commande
  await page.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
  await clickByText(page, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await page.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });
  await fillCheckout(page, { method: "MVOLA", reference: PROBE_TRANSACTION_REF });
  const doubleEmailValue = await page.$eval("#customerEmail", (input) => input.value);
  const beforeDouble = await sql('select count(*)::int as n from "Order" where "customerEmail" = $1', [
    doubleEmailValue,
  ]);
  await page.evaluate(() => {
    const form = document.querySelector("form");
    form?.requestSubmit();
    form?.requestSubmit();
  });
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const afterDouble = await sql('select count(*)::int as n from "Order" where "customerEmail" = $1', [
    doubleEmailValue,
  ]);
  record(
    "B17",
    "Double soumission de la commande : pas de doublon",
    afterDouble[0].n - beforeDouble[0].n <= 1 ? "OK" : "BUG",
    `${afterDouble[0].n - beforeDouble[0].n} commande(s) créée(s) par la double soumission`,
  );

  // B20 — commande passée en invité puis inscription avec le même e-mail :
  //       la commande doit-elle apparaître dans le compte ?
  const claim = await browser.createBrowserContext();
  const claimPage = await claim.newPage();
  await claimPage.goto(`${BASE}/produits/tirage-standard`, { waitUntil: "networkidle2" });
  await clickByText(claimPage, "Ajouter au panier");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await claimPage.goto(`${BASE}/commande`, { waitUntil: "networkidle2" });

  const claimEmail = `claim.${Date.now()}@example.mg`;
  await fillCheckout(claimPage, { method: "MVOLA", reference: PROBE_TRANSACTION_REF });
  await setField(claimPage, "#customerEmail", claimEmail);
  const claimReference = await submitOrder(claimPage);

  await claimPage.goto(`${BASE}/inscription`, { waitUntil: "networkidle2" });
  await setField(claimPage, "#name", "Client Revendique");
  await setField(claimPage, "#email", claimEmail);
  await setField(claimPage, "#password", "MotDePasse123");
  await clickByText(claimPage, "Créer mon compte");
  await claimPage.waitForFunction(() => window.location.pathname === "/compte", {
    timeout: 30000,
  });

  const accountText = await claimPage.evaluate(() => document.body.innerText);
  const orderRow = await sql('select "userId" from "Order" where reference = $1', [claimReference]);
  record(
    "B20",
    "Commande invitée visible dans le compte après inscription avec le même e-mail",
    accountText.includes(claimReference) ? "OK" : "WARN",
    orderRow[0]?.userId === null
      ? "commande toujours anonyme (userId null) : elle reste consultable par sa référence, mais n'est pas rattachée au compte"
      : "commande rattachée au compte",
  );
  await claim.close();

  // B18 / B18b / B19 — téléchargement réservé à l'équipe, puis canevas vide.
  // L'atelier exige un compte : session client d'abord, session admin ensuite.
  const blank = await signedInPage(browser, "client@myphoto.mg", "Client1234!");
  const blankPage = blank.page;
  const blankErrors = [];
  blankPage.on("pageerror", (error) => blankErrors.push(String(error)));

  await blankPage.goto(`${BASE}/editeur`, { waitUntil: "networkidle2" });
  await blankPage.waitForSelector("canvas", { timeout: 30000 });
  const designsBefore = await sql('select count(*)::int as n from "Design"');

  const exportButtons = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")].filter((button) =>
        /^(PNG|JPG)$/.test((button.textContent ?? "").trim()),
      ).length,
    );

  const clientExport = await blankPage.evaluate(() => ({
    buttons: [...document.querySelectorAll("button")].filter((button) =>
      /^(PNG|JPG)$/.test((button.textContent ?? "").trim()),
    ).length,
    reserved: document.body.innerText.includes("Téléchargement réservé"),
  }));
  record(
    "B18",
    "Client : téléchargement du fichier d'impression masqué",
    clientExport.buttons === 0 && clientExport.reserved && blankErrors.length === 0
      ? "OK"
      : "BUG",
    `${clientExport.buttons} bouton(s) · message réservé=${clientExport.reserved}`,
  );

  // B18b — l'équipe télécharge le fichier qu'elle va imprimer.
  const team = await signedInPage(browser, "admin@myphoto.mg", "Admin1234!");
  const teamErrors = [];
  team.page.on("pageerror", (error) => teamErrors.push(String(error)));
  await team.page.goto(`${BASE}/editeur`, { waitUntil: "networkidle2" });
  await team.page.waitForSelector("canvas", { timeout: 30000 });

  const teamButtons = await exportButtons(team.page);
  if (teamButtons === 2) {
    await clickByText(team.page, "PNG");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const exportStatus = await team.page.evaluate(() =>
    [...document.querySelectorAll('[role="status"]')]
      .map((node) => node.textContent ?? "")
      .join(" | "),
  );
  record(
    "B18b",
    "Administrateur : boutons PNG/JPG présents et export exécuté",
    teamButtons === 2 && teamErrors.length === 0 && exportStatus.includes("×")
      ? "OK"
      : "BUG",
    `${teamButtons} bouton(s) · ${exportStatus.replace(/\s+/g, " ").slice(0, 60) || "(aucun statut)"}`,
  );
  await team.context.close();

  await blankPage.click('button[title="Enregistrer la création"]');
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const designsAfter = await sql('select count(*)::int as n from "Design"');
  record(
    "B19",
    "Création sans aucun calque refusée à l'enregistrement",
    designsBefore[0].n === designsAfter[0].n ? "OK" : "BUG",
    `${designsBefore[0].n} → ${designsAfter[0].n} créations`,
  );
  await blank.context.close();

  await guest.close();
}

// ---------------------------------------------------------------------------

async function main() {
  await rm(ARTIFACTS, { recursive: true, force: true });
  await mkdir(ARTIFACTS, { recursive: true });

  console.log("=== Sondes HTTP ===");
  await httpProbes();

  console.log("\n=== Sondes navigateur ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1500, height: 950 },
  });

  try {
    await browserProbes(browser);
  } finally {
    await browser.close();
    await pool.end();
  }

  const bugs = findings.filter((finding) => finding.verdict === "BUG");
  const warns = findings.filter((finding) => finding.verdict === "WARN");
  console.log(
    `\n${findings.length} sondes · ${bugs.length} bug(s) · ${warns.length} avertissement(s)`,
  );

  if (bugs.length > 0) {
    console.log("\nAnomalies confirmées :");
    for (const bug of bugs) console.log(`  [${bug.id}] ${bug.description} — ${bug.detail}`);
  }

  if (bugs.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Sonde interrompue :", error);
  process.exitCode = 1;
});
