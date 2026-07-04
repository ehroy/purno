import fs from "fs";
import dotenv from "dotenv";
import { request, ProxyAgent } from "undici";

dotenv.config();
const env = process.env;

function normalizeProxyUrl(proxyUrl = "") {
  const value = String(proxyUrl || "").trim();

  if (!value) {
    return "";
  }

  const parsed = new URL(value);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Proxy harus memakai protocol http/https: ${value}`);
  }

  return value;
}

export const config = {
  proxy:
    env.PROXY_URL ||
    env.HTTPS_PROXY ||
    env.HTTP_PROXY ||
    env.ALL_PROXY ||
    env.https_proxy ||
    env.http_proxy ||
    env.all_proxy ||
    "",
  captcha: {
    apiKey: env.CAPSOLVER_API_KEY || "CAP-",
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "0x4AAAAAACDNCinYthKCTfgn",
  },
  deviceNoFile: env.DEVICE_NO_FILE || "./device.txt",
};

const userAgentList = [
  "Mozilla/5.0 (Linux; Android 10; Redmi Note 7 Build/QQ3A.200605.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11; SM-A515F Build/RP1A.200720.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; M2012K11AG Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230805.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; CPH1911 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36",
];

const deviceNoList = fs
  .readFileSync(new URL(config.deviceNoFile, import.meta.url), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim().replace(/^"|"$/g, ""))
  .filter(Boolean);

const sessionDeviceNoMap = new Map();
const sessionUserAgentMap = new Map();
const usedDeviceNoSet = new Set();

export function getDevicePoolStats() {
  return {
    total: deviceNoList.length,
    used: usedDeviceNoSet.size,
    remaining: deviceNoList.length - usedDeviceNoSet.size,
    exhausted: usedDeviceNoSet.size >= deviceNoList.length,
  };
}

export function setSessionDeviceNo(sessionKey = "default", deviceNo) {
  if (!deviceNo) {
    return null;
  }

  sessionDeviceNoMap.set(sessionKey, deviceNo);
  usedDeviceNoSet.add(deviceNo);
  return deviceNo;
}

export function getSessionDeviceNo(sessionKey = "default") {
  if (!sessionDeviceNoMap.has(sessionKey)) {
    const deviceNo =
      deviceNoList[Math.floor(Math.random() * deviceNoList.length)];
    sessionDeviceNoMap.set(sessionKey, deviceNo);
  }

  return sessionDeviceNoMap.get(sessionKey);
}

export function getUniqueSessionDeviceNo(sessionKey = "default") {
  if (sessionDeviceNoMap.has(sessionKey)) {
    return sessionDeviceNoMap.get(sessionKey);
  }

  const availableDeviceNoList = deviceNoList.filter(
    (deviceNo) => !usedDeviceNoSet.has(deviceNo),
  );

  if (!availableDeviceNoList.length) {
    return null;
  }

  const deviceNo =
    availableDeviceNoList[Math.floor(Math.random() * availableDeviceNoList.length)];

  setSessionDeviceNo(sessionKey, deviceNo);

  return deviceNo;
}

export function getSessionUserAgent(sessionKey = "default") {
  if (!sessionUserAgentMap.has(sessionKey)) {
    const userAgent =
      userAgentList[Math.floor(Math.random() * userAgentList.length)];
    sessionUserAgentMap.set(sessionKey, userAgent);
  }

  return sessionUserAgentMap.get(sessionKey);
}

export function buildLoopdexHeaders(extraHeaders = {}, sessionKey = "default") {
  return {
    appversion: "7",
    "custom-user-agent": "app_android",
    "user-agent": getSessionUserAgent(sessionKey),
    deviceno: getSessionDeviceNo(sessionKey),
    origin: "https://loopdexplay.com",
    "x-requested-with": "com.ids2.game",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    ...extraHeaders,
  };
}

async function fetchIp(proxyUrl = "") {
  const normalizedProxy = normalizeProxyUrl(proxyUrl);
  const dispatcher = normalizedProxy ? new ProxyAgent(normalizedProxy) : undefined;
  const response = await request("https://api.ipify.org?format=json", {
    dispatcher,
    headersTimeout: 10000,
    bodyTimeout: 10000,
  });
  const result = await response.body.json();

  if (!result?.ip) {
    throw new Error("Respons IP tidak valid");
  }

  return result.ip;
}

export async function getIpStatus(proxyUrl = config.proxy) {
  const directIp = await fetchIp("");
  const normalizedProxy = normalizeProxyUrl(proxyUrl);

  if (!normalizedProxy) {
    return {
      proxyUrl: "",
      directIp,
      proxyIp: null,
      isUsingProxy: false,
      matchesDirect: null,
    };
  }

  const proxyIp = await fetchIp(normalizedProxy);

  return {
    proxyUrl: normalizedProxy,
    directIp,
    proxyIp,
    isUsingProxy: true,
    matchesDirect: directIp === proxyIp,
  };
}

export function normalizeProxy(proxyUrl = "") {
  return normalizeProxyUrl(proxyUrl);
}
