import fs from "fs";

const env = process.env;

export const config = {
  proxy: env.PROXY_URL || env.HTTP_PROXY || "",
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

export function getSessionDeviceNo(sessionKey = "default") {
  if (!sessionDeviceNoMap.has(sessionKey)) {
    const deviceNo =
      deviceNoList[Math.floor(Math.random() * deviceNoList.length)];
    sessionDeviceNoMap.set(sessionKey, deviceNo);
  }

  return sessionDeviceNoMap.get(sessionKey);
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
