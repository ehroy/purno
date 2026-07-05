export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setCookies(setCookieHeaders = []) {
    const headers = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : [setCookieHeaders];

    for (const header of headers) {
      if (!header) continue;

      const [cookiePair] = String(header).split(";");
      const separatorIndex = cookiePair.indexOf("=");

      if (separatorIndex <= 0) continue;

      const name = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();

      if (name) this.cookies.set(name, value);
    }
  }

  getCookieHeader() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  hasCookies() {
    return this.cookies.size > 0;
  }
}
