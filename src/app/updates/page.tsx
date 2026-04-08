"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_UPDATES } from "@/lib/updates-changelog";

export default function UpdatesPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Updates</h1>
        <p className="text-muted-foreground text-sm">
          Feature releases and improvements from historical app versions.
        </p>
        <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
          ← Back to Settings
        </Link>
      </div>

      <div className="space-y-4">
        {APP_UPDATES.map((entry) => (
          <Card key={entry.version} className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">
                {entry.version} · {entry.title}
              </CardTitle>
              <CardDescription>{entry.date}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {entry.highlights.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
