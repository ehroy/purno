import { gunzipSync } from "zlib";
import { request, ProxyAgent } from "undici";
import { URLSearchParams } from "url";
import { createHash } from "crypto";
import chalk from "chalk";
import readline from "readline";
import { da, faker } from "@faker-js/faker";
import fs from "fs";
import axios from "axios";
import { createWorker } from "tesseract.js";
import crypto from "crypto";
import {
  buildLoopdexHeaders,
  config,
  getDevicePoolStats,
  getIpStatus,
  getUniqueSessionDeviceNo,
  getSessionUserAgent,
  normalizeProxy,
} from "./config.js";
const randomBytes = crypto.randomBytes(16);
const base64 = randomBytes.toString("base64");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ==================== LOGGING ====================
function log(msg, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "📋",
    account: "👤",
    process: "⚙️",
    reward: "🎁",
  };
  const colors = {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.cyan,
    account: chalk.blueBright,
    process: chalk.gray,
    reward: chalk.greenBright,
  };
  console.log(
    `[${timestamp}] ${icons[type] || "➤"} ${(colors[type] || ((x) => x))(msg)}`,
  );
}

function logDivider() {
  console.log(chalk.gray("═".repeat(80)));
}

function ask(question) {
  return new Promise((resolve) => rl.question(chalk.yellow(question), resolve));
}

const url = "https://boosttrix.com/player-api/guestRegister";

const deviceId = crypto.randomBytes(16).toString("hex");
const inSiteQueryParams = {};

function hash(value) {
  return crypto.createHash("md5").update(String(value)).digest("hex");
}

// ==================== HTTP CLIENT ====================

async function curl(url, body = null, headers = {}, proxy = null, sessionKey = "default") {
  const defaultHeaders = {
    "User-Agent": getSessionUserAgent(sessionKey),
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "sec-ch-ua-platform": '"Android"',
    "accept-language": "id_ID",
    accept: "*/*",
    "sec-ch-ua":
      '"Android WebView";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    "sec-ch-ua-mobile": "?1",
    ...buildLoopdexHeaders({}, sessionKey),
    referer: "https://loopdexplay.com/account?v=1QZL5VQ5",
    priority: "u=1, i",
    ...headers,
  };

  const method = body ? "POST" : "GET";
  const proxyUrl = normalizeProxy(proxy ?? config.proxy);
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  const finalBody = body ? JSON.stringify(body) : undefined;

  try {
    const {
      statusCode,
      headers: resHeaders,
      body: resBody,
    } = await request(url, {
      method,
      headers: defaultHeaders,
      body: finalBody,
      dispatcher,
    });

    const chunks = [];
    for await (const chunk of resBody) chunks.push(chunk);
    let buffer = Buffer.concat(chunks);

    if (resHeaders["content-encoding"]?.includes("gzip")) {
      buffer = gunzipSync(buffer);
    }

    const text = buffer.toString("utf8");
    const contentType = resHeaders["content-type"] || "";
    let data;

    try {
      data = contentType.includes("application/json") ? JSON.parse(text) : text;
    } catch {
      data = text;
    }

    return {
      data,
      status: statusCode,
      cookies: resHeaders["set-cookie"] || [],
      headers: resHeaders,
    };
  } catch (error) {
    log(`Request failed: ${error.message}`, "error");
    return { data: null, status: 0, cookies: [], headers: {} };
  }
}
function isDeviceLimitError(message = "") {
  return String(message).includes(
    "Perangkat Anda Telah Mencapai Batas Pendaftaran Hari Ini",
  );
}

async function registerAccount(phone, accountIndex) {
  let attempt = 0;

  while (true) {
    attempt += 1;
    const sessionKey = `index-${accountIndex}-${phone}-attempt-${attempt}`;
    const sessionDeviceNo = getUniqueSessionDeviceNo(sessionKey);

    if (!sessionDeviceNo) {
      const pool = getDevicePoolStats();
      log(
        `device.txt habis. total=${pool.total}, used=${pool.used}, remaining=${pool.remaining}`,
        "error",
      );
      return false;
    }

    log(`Attempt ${attempt} device: ${sessionDeviceNo}`, "info");

    const getcookie = await curl("https://loopdexplay.com", null, {}, null, sessionKey);
    if (!getcookie.cookies) {
      log("Failed to obtain cookies.", "error");
      return false;
    }

    log("Cookies obtained successfully.", "success");
    const capctha = await curl(
      "https://loopdexplay.com/player-api/captcha/get",
      {},
      {
        "Content-Type": "application/json",
        cookie: getcookie.cookies,
      },
      null,
      sessionKey,
    );

    if (!capctha.data?.data?.id) {
      log("Failed to obtain captcha ID.", "error");
      return false;
    }

    log(`Captcha ID: ${capctha.data.data.id}`, "success");

    let capcthaverif;
    do {
      let solution;
      try {
        solution = await imageToText(
          config.captcha.apiKey,
          capctha.data.data.captcha.backgroundImage,
          { websiteURL: "https://loopdexplay.com" },
        );
      } catch (err) {
        console.error(err.message);
      }

      log(solution.text || solution.answers[0]);

      capcthaverif = await curl(
        "https://loopdexplay.com/player-api/captcha/check",
        { data: solution.answers[0], id: capctha.data.data.id },
        {
          "Content-Type": "application/json",
          cookie: getcookie.cookies,
        },
        null,
        sessionKey,
      );
    } while (capcthaverif.data.data === false);

    if (!capcthaverif.data.data) {
      log("Failed to verify captcha.", "error");
      return false;
    }

    log("Captcha verified successfully.", "success");

    let solutions;
    try {
      solutions = await solveTurnstile(
        config.captcha.apiKey,
        "https://loopdexplay.com",
        config.captcha.turnstileSiteKey,
        { action: "register" },
      );

      log(`Token: ${solutions.token.substring(0, 50)}...`);
    } catch (err) {
      console.error(err.message);
      return false;
    }

    const register = await curl(
      "https://loopdexplay.com/player-api/register",
      {
        username: phone,
        password: phone,
        registrationType: "1",
        v: "1QZL5VQ5",
      },
      {
        "Content-Type": "application/json",
        captchaid: capctha.data.data.id,
        "turnstile-token": solutions.token,
        cookie: getcookie.cookies,
      },
      null,
      sessionKey,
    );

    if (register.data.data) {
      const body = new URLSearchParams({
        username: phone,
        password: phone,
        registrationType: "1",
      });

      const response = await request(
        "https://loopdexplay.com/player-api/passport/login.html",
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            accept: "*/*",
            "accept-language": "id_ID",
            captchaid: capctha.data.data.id,
            "turnstile-token": solutions.token,
            cookie: getcookie.cookies,
            ...buildLoopdexHeaders({}, sessionKey),
            referer:
              "https://loopdexplay.com/sales-promotion/packet/c0e2b948-ee2b-4ce7-8ffc-b405b96834ab?v=1QZL5VQ5",
            priority: "u=1, i",
          },
          body: body.toString(),
        },
      );

      const responseBody = await response.body.json();

      if (response.headers.sid) {
        log("Registration successful.", "success");
        log("Session ID: " + response.headers.sid, "info");
        log(`Device used: ${sessionDeviceNo}`, "info");
        fs.appendFileSync(
          `accountnew.txt`,
          `${phone}:${phone}:${sessionDeviceNo}:${response.headers.sid}:${getcookie.cookies}:${responseBody.data.wsToken}\n`,
        );
        return true;
      }

      log("Failed to obtain session ID.", "error");
      return false;
    }

    const registerMessage =
      register.data?.message || register.data?.error || register.data;
    if (isDeviceLimitError(registerMessage)) {
      log(`Device limit kena, retry dengan device lain: ${registerMessage}`, "warning");
      continue;
    }

    log(`Failed to register ${registerMessage}`, "error");
    return false;
  }
}
function generateRandomPin() {
  const pin = faker.string.numeric(6);
  const hashedPin = createHash("md5").update(pin).digest("hex");
  return { pin, hashedPin };
}
async function solveTurnstile(clientKey, websiteURL, websiteKey, options = {}) {
  const { action, cdata, pollingInterval = 3000, timeout = 120000 } = options;

  const baseURL = "https://api.capsolver.com";

  // 1. Create the task
  const metadata = {};
  if (action) metadata.action = action;
  if (cdata) metadata.cdata = cdata;

  const createPayload = {
    clientKey,
    task: {
      type: "AntiTurnstileTaskProxyLess",
      websiteURL,
      websiteKey,
      ...(Object.keys(metadata).length ? { metadata } : {}),
    },
  };

  const createRes = await axios.post(`${baseURL}/createTask`, createPayload, {
    headers: { "Content-Type": "application/json" },
  });

  const createData = createRes.data;

  if (createData.errorId !== 0) {
    throw new Error(
      `CapSolver createTask error: ${createData.errorCode} - ${createData.errorDescription}`,
    );
  }

  const { taskId } = createData;

  // 2. Poll for the result
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`CapSolver task ${taskId} timed out after ${timeout}ms`);
    }

    await sleep(pollingInterval);

    const resultRes = await axios.post(
      `${baseURL}/getTaskResult`,
      { clientKey, taskId },
      { headers: { "Content-Type": "application/json" } },
    );

    const resultData = resultRes.data;

    if (resultData.errorId !== 0) {
      throw new Error(
        `CapSolver getTaskResult error: ${resultData.errorCode} - ${resultData.errorDescription}`,
      );
    }

    if (resultData.status === "ready") {
      return resultData.solution; // { token, type, userAgent }
    }

    if (resultData.status === "failed") {
      throw new Error(`CapSolver task ${taskId} failed`);
    }

    // status === 'processing' -> keep polling
  }
}
async function imageToText(clientKey, body, opts = {}) {
  const { websiteURL, module = "common2", images } = opts;
  const baseURL = "https://api.capsolver.com";

  // Strip any data URL prefix (data:image/xxx;base64,....) -> keep pure base64
  const cleanBody = body && body.includes(",") ? body.split(",")[1] : body;

  const task = {
    type: "ImageToTextTask",
    module,
  };

  if (websiteURL) task.websiteURL = websiteURL;

  // "number" module supports up to 9 images instead of a single body
  if (module === "number" && images && images.length) {
    task.images = images.map((img) =>
      img.includes(",") ? img.split(",")[1] : img,
    );
  } else {
    if (!cleanBody) {
      throw new Error(
        "imageToText: 'body' is required when not using the 'number' module with 'images'.",
      );
    }
    task.body = cleanBody;
  }

  const payload = { clientKey, task };

  let res;
  try {
    res = await axios.post(`${baseURL}/createTask`, payload, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    throw new Error(
      `CapSolver request failed: ${err.response?.data?.errorDescription || err.message}`,
    );
  }

  const data = res.data;

  if (data.errorId !== 0) {
    throw new Error(
      `CapSolver createTask error: ${data.errorCode} - ${data.errorDescription}`,
    );
  }

  if (data.status === "failed") {
    throw new Error(
      `CapSolver task failed: ${data.errorCode || "unknown error"}`,
    );
  }

  // Result is already available here — no polling needed
  return data.solution; // e.g. { text: "44795sds" } or { answers: [...] } for "number" module
}
async function logNetworkStatus() {
  try {
    const status = await getIpStatus(config.proxy);

    if (!status.isUsingProxy) {
      log(`IP direct: ${status.directIp}`, "info");
      log("Proxy tidak di-set, request berjalan direct.", "warning");
      return;
    }

    log(`Proxy terdeteksi: ${status.proxyUrl}`, "info");
    log(`IP direct: ${status.directIp}`, "info");
    log(
      `IP via proxy: ${status.proxyIp}`,
      status.matchesDirect ? "warning" : "success",
    );

    if (status.matchesDirect) {
      log("IP proxy sama dengan direct, cek konfigurasi proxy.", "warning");
    }
  } catch (error) {
    log(`Validasi proxy/IP gagal: ${error.message}`, "error");
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// ==================== MAIN ====================
function randomNumericString(length) {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += Math.floor(Math.random() * 10);
  }

  return value;
}
(async () => {
  logDivider();
  log("Tomoro Coffee - Auto Register", "info");
  logDivider();
  await logNetworkStatus();
  const count = parseInt(await ask("Enter number of accounts to register: "));
  const devicePool = getDevicePoolStats();
  log(
    `device.txt: total ${devicePool.total}, remaining ${devicePool.remaining}`,
    devicePool.remaining >= count ? "success" : "warning",
  );
  if (devicePool.remaining < count) {
    log(
      "Jumlah device lebih sedikit dari target akun. Saat device habis, proses akan berhenti.",
      "warning",
    );
  }
  for (let index = 0; index < count; index++) {
    const phone = "821" + randomNumericString(9);
    log("Phone: " + phone, "info");
    const success = await registerAccount(phone, index);
    if (!success) {
      log(`Stop pada akun ${index + 1}.`, "warning");
      if (getDevicePoolStats().remaining === 0) {
        break;
      }
    }
    console.log("");
  }
  logDivider();
  rl.close();
})();
