import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] };

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let data: { title?: string; body?: string } = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Lifeplanner", {
      body: data.body ?? "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: "laundry",
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return (client as WindowClient).focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
