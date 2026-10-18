import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const [base, ownerToken, staffToken] = process.argv.slice(2);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VV_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const errors = [];
async function account(
  token,
  role,
  id,
  username,
  viewport = { width: 1366, height: 900 },
) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(
    ({ token, role, id, username }) => {
      localStorage.setItem("venuevue.auth.token", token);
      localStorage.setItem(
        "venuevue.auth.user",
        JSON.stringify({ user_id: id, username, role }),
      );
    },
    { token, role, id, username },
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page };
}
fs.mkdirSync("/tmp/venue-ui", { recursive: true });
try {
  const { ctx, page } = await account(staffToken, "BARISTA", 2, "testbarista");
  await page.goto(base + "/pos");
  await page.getByText('TravelBean MNL', {exact:true}).first().waitFor();
  assert.match(await page.title(), /TravelBean MNL/);
  await page.goto(base + '/admin');
  await page.waitForURL('**/pos');
  assert.equal(await page.getByRole('button', {name:'Settings',exact:true}).count(),0);
  await page
    .getByRole("button", { name: "Add Test Latte M HOT", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Management", exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Add Test Latte M HOT", exact: true })
    .click();
  await page.getByLabel("Cash received").fill("500");
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await page.getByRole("button", { name: "Confirm sale", exact: true }).click();
  await page.getByRole("heading", { name: /Sale #\d+ confirmed/ }).waitFor();
  assert.match(
    await page.getByLabel("Sale receipt").innerText(),
    /VATable Sales/,
  );
  await page.screenshot({
    path: "/tmp/venue-ui/register-desktop.png",
    fullPage: true,
  });
  console.log("PASS browser real cash checkout and receipt");
  // Interrupt just the checkout channel, leaving shell available for reload.
  await ctx.route("**/backend/sync.php", (route) => route.abort());
  await page
    .getByRole("button", { name: "Add Test Americano S HOT", exact: true })
    .click();
  await page.getByLabel("Cash received").fill("200");
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await page.getByRole("button", { name: "Confirm sale", exact: true }).click();
  await page
    .getByText(
      "Host unavailable. Order saved on this device; awaiting confirmation.",
      { exact: true },
    )
    .waitFor();
  await page.reload();
  await page
    .getByText(
      "Host unavailable. Order saved on this device; awaiting confirmation.",
      { exact: true },
    )
    .waitFor();
  const pendingCount = await page
    .locator(".vv-order")
    .filter({ hasText: "PENDING" })
    .count();
  assert.equal(pendingCount, 1);
  await ctx.unroute("**/backend/sync.php");
  await page.getByRole("button", { name: "Refresh / retry pending" }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll(".vv-order")].some((e) =>
        e.textContent.includes("PENDING"),
      ),
  );
  console.log(
    "PASS browser pending order survives reload and confirms after reconnect",
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: "/tmp/venue-ui/register-tablet.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  // Use separate owner context to exercise the actual forms.
  const { page: admin } = await account(ownerToken, "OWNER", 1, "testowner");
  await admin.goto(base + "/admin");
  assert.equal(await admin.getByRole('link',{name:'Register',exact:true}).count(),1);
  assert.equal(await admin.getByRole('link',{name:'Management',exact:true}).count(),1);
  await admin.getByRole('button',{name:'Settings',exact:true}).click();
  await admin.getByRole('heading',{name:'Workstation settings'}).waitFor();
  await admin.locator('main').getByRole('button',{name:'Switch to the dark theme'}).click();
  assert.equal(await admin.locator('html').getAttribute('class'),'dark');
  await admin.screenshot({path:'/tmp/venue-ui/phase3-settings-dark.png',fullPage:true});
  await admin.locator('main').getByRole('button',{name:'Switch to the light theme'}).click();
  await admin.getByRole("button", { name: "Inventory", exact: true }).click();
  await admin
    .getByRole("heading", { name: "Ingredients", exact: true })
    .waitFor();
  await admin.screenshot({
    path: "/tmp/venue-ui/management-desktop.png",
    fullPage: true,
  });
  await admin.getByRole("button", { name: "Catalogue", exact: true }).click();
  const pf = admin.locator("form").filter({
    has: admin.getByRole("heading", { name: "Create product", exact: true }),
  });
  await pf.getByLabel("Product name").fill("Browser-created drink");
  await pf.getByRole("button", { name: "Save", exact: true }).click();
  await admin
    .getByText("Browser-created drink · Active", { exact: true })
    .waitFor();
  await admin.getByRole("button", { name: "Sales", exact: true }).click();
  await admin.getByRole("heading", { name: "Daily / period sales" }).waitFor();
  await admin
    .getByText("Output VAT / remittance figure", { exact: true })
    .waitFor();
  await admin.screenshot({
    path: "/tmp/venue-ui/sales-desktop.png",
    fullPage: true,
  });
  await admin.setViewportSize({ width: 768, height: 1024 });
  assert.equal(
    await admin.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser owner forms, sales report, tablet layout and no JavaScript errors",
  );
} finally {
  await browser.close();
}
