import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const [base, token] = process.argv.slice(2);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VV_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  acceptDownloads: true,
});
await ctx.addInitScript((token) => {
  localStorage.setItem("venuevue.auth.token", token);
  localStorage.setItem(
    "venuevue.auth.user",
    JSON.stringify({ user_id: 1, username: "testowner", role: "OWNER" }),
  );
}, token);
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
fs.mkdirSync("/tmp/venue-ui", { recursive: true });
const tab = (name) => page.getByRole("button", { name, exact: true }).click();
const form = (title) =>
  page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
async function save(f) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/backend/api.php") && r.request().method() === "POST",
  );
  await f.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.getByText("Saved successfully", { exact: true }).waitFor();
}
try {
  await page.goto(base + "/admin");
  await page.getByRole("heading", { name: "Today’s overview" }).waitFor();
  await page.getByRole("heading", { name: "Recent confirmed sales" }).waitFor();
  await page.screenshot({
    path: "/tmp/venue-ui/phase2-overview.png",
    fullPage: true,
  });
  await tab("Inventory");
  const ingredient = form("New ingredient");
  await ingredient.getByLabel("Name", { exact: true }).fill("UI ingredient");
  await ingredient.getByLabel("Base unit").selectOption("units");
  await save(ingredient);
  const delivery = form("Receive stock / positive adjustment");
  await delivery
    .locator('select[name="ingredient_id"]')
    .selectOption({ label: "UI ingredient (units)" });
  await delivery
    .getByLabel("Delivery reference / adjustment reason")
    .fill("UI delivery");
  await delivery.getByLabel("Supplier (optional)").fill("UI supplier");
  await delivery.getByLabel("Lot reference (optional)").fill("UI-LOT");
  await delivery.getByLabel("Number of sealed containers").fill("2");
  await delivery.getByLabel("Quantity per container (base unit)").fill("10");
  await save(delivery);
  await tab("Catalogue");
  const product = form("Create product");
  await product.getByLabel("Product name").fill("UI drink");
  await save(product);
  const variant = form("Create size / temperature variant");
  await variant
    .locator('select[name="product_id"]')
    .selectOption({ label: "UI drink" });
  await variant.getByLabel("Size").selectOption("M");
  await variant.getByLabel("Temperature").selectOption("ICED");
  await variant.getByLabel("Unique SKU").fill("UI-M-ICED");
  await variant.getByLabel("VAT-inclusive price").fill("112");
  await save(variant);
  await tab("Recipes");
  await page.getByLabel("Variant").selectOption({ label: "UI drink M ICED" });
  await page
    .getByLabel("Ingredient")
    .selectOption({ label: "UI ingredient (units)" });
  await page.getByLabel("Quantity per drink").fill("2");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page.getByText("Saved successfully", { exact: true }).waitFor();
  await page.goto(base + "/pos");
  await page
    .getByRole("button", { name: "Add UI drink M ICED", exact: true })
    .click();
  await page.getByLabel("Cash received").fill("120");
  await tab("Charge");
  await tab("Confirm sale");
  await page.getByRole("heading", { name: /Sale #\d+ confirmed/ }).waitFor();
  await expect(page.getByLabel("Sale receipt")).toContainText("₱112.00");
  await page.goto(base + "/admin");
  await tab("Batches");
  await page.getByLabel("Find ingredient, supplier or lot").fill("UI-LOT");
  const batch = page.locator("tbody tr");
  await expect(batch).toHaveCount(1);
  await expect(batch).toContainText("18.000");
  await batch.getByText("Correct batch details", { exact: true }).click();
  await batch.getByLabel("Supplier", { exact: true }).fill("Updated supplier");
  await batch.getByLabel("Correction reason").fill("Supplier correction");
  await batch.getByRole("button", { name: "Save batch correction" }).click();
  await page.getByText("Saved successfully", { exact: true }).waitFor();
  await expect(batch).toContainText("Updated supplier");
  await page.screenshot({
    path: "/tmp/venue-ui/phase2-batches.png",
    fullPage: true,
  });
  await tab("Inventory");
  const waste = form("Record waste / negative adjustment");
  const container = await waste
    .locator('select[name="container_id"]')
    .locator("option")
    .filter({ hasText: "UI ingredient" })
    .first()
    .getAttribute("value");
  await waste.locator('select[name="container_id"]').selectOption(container);
  await waste.getByLabel("Quantity (base unit)").fill("1");
  await waste.getByLabel("Reason", { exact: true }).fill("UI spilled stock");
  await save(waste);
  await tab("Audit");
  await page.getByLabel("History").selectOption("movements");
  await page.getByLabel("Actor / action / reason").fill("UI spilled stock");
  await tab("Apply filters");
  await expect(page.locator("tbody")).toContainText("UI spilled stock");
  await expect(page.locator("tbody")).toContainText("testowner");
  await page.getByLabel("Actor / action / reason").fill("no-such-history-zzz");
  await tab("Apply filters");
  await page.getByText("No history matches these filters.").waitFor();
  await tab("Sales");
  await page
    .getByRole("heading", { name: "Daily summary (Z-reading)" })
    .waitFor();
  const csvEvent = page.waitForEvent("download");
  await tab("Export CSV");
  const csv = await csvEvent;
  const csvText = fs.readFileSync(await csv.path(), "utf8");
  assert.match(csvText, /gross,net,vat/);
  assert.match(csvText, /TOTAL/);
  await page.screenshot({
    path: "/tmp/venue-ui/phase2-sales.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await tab("Backup & restore");
  await page.getByLabel("Current owner password").fill("Owner-Recovered-42");
  await page
    .getByLabel("Backup password (12+ characters)")
    .fill("Browser-Backup-Secret-42");
  const downloadEvent = page.waitForEvent("download");
  await tab("Download backup");
  const download = await downloadEvent;
  await page.getByLabel("Backup file").setInputFiles(await download.path());
  await tab("Preview restore");
  await page
    .getByText("Preview ready. Review the table counts before restoring.")
    .waitFor();
  await expect(
    page.getByRole("button", { name: "Restore this snapshot" }),
  ).toBeDisabled();
  await page.getByLabel("Type RESTORE to replace current data").fill("RESTORE");
  await tab("Restore this snapshot");
  await page.getByRole("button", { name: "Sign in again" }).waitFor();
  await expect(
    page.getByRole("status").filter({ hasText: "Restore complete." }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS Phase 2 browser: owner ingredient/product/variant/recipe/delivery → checkout → stock → batch correction/waste → audit/empty filters → VAT CSV → encrypted backup preview/restore; tablet layout; no JS errors",
  );
} finally {
  await browser.close();
}
