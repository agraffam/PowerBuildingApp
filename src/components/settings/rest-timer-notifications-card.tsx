"use client";

import { BellRing, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getRestNotificationPermission,
  requestRestNotificationPermission,
  sendTestRestNotification,
  type RestNotificationPermissionState,
} from "@/lib/rest-timer-notify";

function statusLabel(p: RestNotificationPermissionState): string {
  switch (p) {
    case "granted":
      return "On — you’ll get a notification when rest ends in the background.";
    case "denied":
      return "Blocked — allow notifications for this site in your browser or system settings.";
    case "default":
      return "Not enabled yet — tap the button below when you’re ready.";
    case "unsupported":
      return "Not available in this browser (or context). Sound and vibration may still work.";
    default:
      return "";
  }
}

export function RestTimerNotificationsCard() {
  const [perm, setPerm] = useState<RestNotificationPermissionState>("default");
  const [asking, setAsking] = useState(false);
  const [testFailed, setTestFailed] = useState(false);

  const sync = useCallback(() => setPerm(getRestNotificationPermission()), []);

  useEffect(() => {
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [sync]);

  const onEnable = async () => {
    setAsking(true);
    setTestFailed(false);
    const p = await requestRestNotificationPermission();
    setPerm(p);
    setAsking(false);
  };

  const onTest = () => {
    setTestFailed(!sendTestRestNotification());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5 text-muted-foreground" aria-hidden />
          Rest timer notifications
        </CardTitle>
        <CardDescription>
          <span className="block sm:hidden">
            Optional browser alert when rest ends in the background. Needs permission; HTTPS in production.
          </span>
          <span className="hidden sm:block">
            When a rest period finishes while this tab is in the background (or another app is open), a browser
            notification can tell you to get back to your set. Sound and vibration are used when the browser allows
            them; notifications need your permission and a secure site (HTTPS) in production.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{statusLabel(perm)}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(perm === "default" || perm === "denied") && (
            <Button
              type="button"
              className="h-11 w-full rounded-xl sm:h-10 sm:w-auto"
              disabled={asking}
              onClick={() => void onEnable()}
            >
              {asking ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2 inline" />
                  Asking…
                </>
              ) : perm === "denied" ? (
                "Try again"
              ) : (
                "Allow notifications"
              )}
            </Button>
          )}
          {perm === "granted" && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl sm:h-10 sm:w-auto"
              onClick={() => onTest()}
            >
              Send test notification
            </Button>
          )}
        </div>
        {testFailed && (
          <p className="text-destructive text-sm">Could not show a test notification. Check browser settings.</p>
        )}
        {perm === "denied" && (
          <p className="text-xs text-muted-foreground">
            If the browser does not show a prompt again, open site settings for this page and enable notifications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
