import { chromium } from "playwright";
import fs from "fs/promises";
import os from "os";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateRandomUserAgent() {
  const androidVersion = randomFrom(["9", "10", "11", "12", "13", "14"]);
  const model = randomFrom([
    "2304FPN6DG",
    "2201117TG",
    "CPH2387",
    "V2145",
    "SM-A515F",
    "RMX3085",
    "M2101K7AG",
  ]);
  const build = randomFrom([
    "PQ3A.190605.09201023",
    "QP1A.190711.020",
    "RP1A.200720.011",
    "SP1A.210812.016",
    "TP1A.220624.014",
  ]);
  const chromeMajor = randomFrom([
    120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134,
    135, 136, 137, 138,
  ]);
  const chromeBuild = `${chromeMajor}.0.${Math.floor(Math.random() * 5000) + 5000}.${Math.floor(Math.random() * 150) + 50}`;

  return `Mozilla/5.0 (Linux; Android ${androidVersion}; ${model} Build/${build}) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${chromeBuild} Mobile Safari/537.36`;
}

function normalizeBaseUrl(baseUrl = "") {
  const value = String(baseUrl || "").trim().replace(/\/+$/, "");

  if (!value) {
    return "https://loopdexplay.com";
  }

  return value;
}

const baseUrl = normalizeBaseUrl(process.env.BASE_URL || process.env.WEB_BASE_URL);

function webUrl(pathname = "") {
  const suffix = String(pathname || "");

  if (!suffix) {
    return baseUrl;
  }

  return `${baseUrl}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

function formatCookieHeader(cookies) {
  return cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function waitForCookies(context, names = [], timeout = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const cookies = await context.cookies();

    if (!names.length || names.every((name) => cookies.some((cookie) => cookie.name === name))) {
      return cookies;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return context.cookies();
}

async function generateDevice(index, total) {
  const userAgent = generateRandomUserAgent();
  const profileDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "hopegoo-profile-"),
  );
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    userAgent,
  });
  const page = await context.newPage();

  try {
    // Blokir resource yang tidak diperlukan
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();

      if (["image", "font", "media"].includes(type)) {
        return route.abort();
      }

      route.continue();
    });

    await page.goto(webUrl("/account"), {
      waitUntil: "domcontentloaded",
    });

    // Tunggu hingga key tersedia
    await page.waitForFunction(
      () => {
        return localStorage.getItem("dp-dvid") !== null;
      },
      {
        timeout: 30000,
      },
    );

    const value = await page.evaluate(() => localStorage.getItem("dp-dvid"));
    const cookies = await waitForCookies(context, ["cf_clearance"]);
    const cookieHeader = formatCookieHeader(cookies);
    const hasCfClearance = cookies.some((cookie) => cookie.name === "cf_clearance");

    console.log(`[${index}/${total}] User-Agent:`, userAgent);
    console.log(`[${index}/${total}] dp-dvid:`, value);
    console.log(`[${index}/${total}] cookie:`, cookieHeader || "-");

    if (!hasCfClearance) {
      console.log(`[${index}/${total}] cf_clearance belum ditemukan`);
    }

    await fs.appendFile("device.txt", value + "\n");
    await fs.appendFile("device-cookie.txt", `${value}:${cookieHeader}\n`);
  } finally {
    await context.close();
    await fs.rm(profileDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 500,
    });
  }
}

async function runParallel(total, concurrency, handler) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, total);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < total) {
        const currentIndex = nextIndex++;
        await handler(currentIndex + 1);
      }
    }),
  );
}

(async () => {
  const total = parsePositiveInt(await ask("Jumlah loop: "), 1);
  const concurrency = parsePositiveInt(
    await ask("Jumlah paralel (default 2): "),
    2,
  );

  try {
    console.log(
      `Mulai generate ${total} device dengan ${Math.min(concurrency, total)} paralel`,
    );
    await runParallel(total, concurrency, (index) =>
      generateDevice(index, total),
    );
  } finally {
    rl.close();
  }
})();
