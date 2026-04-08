import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGitCommitEntries } from "@/lib/git-commits";

export default function UpdatesPage() {
  const entries = getGitCommitEntries(60);
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Updates</h1>
        <p className="text-muted-foreground text-sm">
          Auto-generated from git commit history.
        </p>
        <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
          ← Back to Settings
        </Link>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.hash} className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">
                {entry.version} · {entry.subject}
              </CardTitle>
              <CardDescription>{entry.date}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>- {entry.subject}</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Commit `{entry.hash}`</p>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && (
          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No git history available in this runtime.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
