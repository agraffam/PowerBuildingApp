/** Best-effort alerts when rest ends while the tab or app is in the background. */

const ASK_KEY = "pb-rest-notify-permission-asked";

export type RestNotificationPermissionState = NotificationPermission | "unsupported";

export function getRestNotificationPermission(): RestNotificationPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/** Call from a button click (user gesture) so Safari and others allow the prompt. */
export async function requestRestNotificationPermission(): Promise<RestNotificationPermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    const r = await Notification.requestPermission();
    return r;
  } catch {
    return getRestNotificationPermission();
  }
}

/** Fire a sample notification if permission is granted (for Settings “Test”). */
export function sendTestRestNotification(): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    new Notification("Powerbuild", {
      body: "Test: you’ll see this when a rest period ends in the background.",
      tag: "powerbuild-rest-test",
    });
    return true;
  } catch {
    return false;
  }
}

export function maybeAskRestNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  try {
    if (sessionStorage.getItem(ASK_KEY)) return;
    sessionStorage.setItem(ASK_KEY, "1");
  } catch {
    // sessionStorage blocked
  }
  void Notification.requestPermission();
}

export function tryRestCompleteNotify() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate([160, 70, 160]);
    } catch {
      // ignore
    }
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("Rest complete", {
        body: "Time for your next set.",
        tag: "powerbuild-rest",
      });
    } catch {
      // ignore
    }
  }

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    const strip = (t: string) => t.replace(/^\(\d+s\)\s+/, "");
    const base = strip(document.title);
    document.title = `Rest done — ${base}`;
    window.setTimeout(() => {
      if (document.title.startsWith("Rest done —")) {
        document.title = base;
      }
    }, 5000);
  }
}
