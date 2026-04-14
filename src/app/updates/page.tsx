import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGitCommitEntries } from "@/lib/git-commits";

export default function UpdatesPage() {
  const entries = getGitCommitEntries(60);
  return (
    <div className="page-stack mx-auto max-w-3xl">
      <PageHeader
        title="Updates"
        description="Auto-generated from git commit history."
        backLink={{ href: "/settings", label: "← Back to Settings" }}
      />

      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.hash} className="rounded-2xl shadow-sm ring-1 ring-foreground/5">
            <CardHeader className="space-y-1">
              <CardTitle className="break-words text-lg font-heading leading-snug">
                <span className="text-muted-foreground">{entry.version}</span>
                <span className="text-muted-foreground"> · </span>
                {entry.subject}
              </CardTitle>
              <CardDescription className="font-mono text-xs">{entry.date}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed text-muted-foreground">{entry.subject}</p>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground/80">Commit {entry.hash}</p>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && (
          <Card className="rounded-2xl shadow-sm ring-1 ring-foreground/5">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No git history available in this runtime.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
