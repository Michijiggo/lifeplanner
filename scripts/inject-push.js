import { readFileSync, writeFileSync, existsSync } from "node:fs";

const swPath = "dist/sw.js";
if (!existsSync(swPath)) {
  console.error("sw.js not found – skipping push handler injection");
  process.exit(0);
}

const existing = readFileSync(swPath, "utf-8");
if (existing.includes('addEventListener("push"')) {
  console.log("Push handler already present – skipping");
  process.exit(0);
}

const pushHandler = `
self.addEventListener("push", function (event) {
  if (!event.data) return;
  var data;
  try { data = event.data.json(); } catch (e) { data = { title: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Lifeplanner", {
      body: data.body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: "laundry",
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function (clients) {
      for (var i = 0; i < clients.length; i++) {
        if ("focus" in clients[i]) return clients[i].focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
`;

writeFileSync(swPath, existing + pushHandler);
console.log("✓ Push handler injected into dist/sw.js");
