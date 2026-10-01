import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import manifest from "../app/manifest";

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const fallback = new Response("offline");
  const fetch = vi.fn().mockResolvedValue(new Response("online"));
  const match = vi.fn().mockResolvedValue(fallback);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { location: { origin: "https://academy.test" }, addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; } },
    caches: { match }, fetch, URL, Response,
  });
  function request(path: string, mode = "cors", method = "GET") {
    const respondWith = vi.fn();
    handlers.fetch({ request: { url: new URL(path, "https://academy.test").href, mode, method }, respondWith });
    return respondWith;
  }
  return { request, fetch, match, fallback };
}

describe("PWA privacy and offline behavior", () => {
  it("does not intercept API, mutation, third-party, or RSC requests", () => {
    const w = worker();
    for (const path of ["/api/orders/123", "/api/payments", "https://payment.test/script.js", "/?_rsc=example"]) expect(w.request(path)).not.toHaveBeenCalled();
    expect(w.request("/register", "navigate", "POST")).not.toHaveBeenCalled();
  });
  it("uses the network for payment documents without storing them", async () => {
    const w = worker();
    const response = w.request("/payment/example", "navigate");
    expect(await (await response.mock.calls[0][0]).text()).toBe("online");
    expect(w.match).not.toHaveBeenCalled();
  });
  it("shows the offline document when a navigation fails", async () => {
    const w = worker(); w.fetch.mockRejectedValue(new TypeError("Offline"));
    const response = w.request("/register", "navigate");
    expect(await response.mock.calls[0][0]).toBe(w.fallback);
    expect(w.match).toHaveBeenCalledWith("/offline.html");
  });
  it("ships every declared app icon as a PNG", () => {
    expect(manifest().display).toBe("standalone");
    for (const icon of manifest().icons ?? []) {
      const bytes = readFileSync(`public${icon.src}`);
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });
});
