"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SHARE_DRAFT_ID_PARAM,
  SHARE_DRAFT_TITLE_PARAM,
  buildSharedTaskTitle,
  readIncomingSharePayload,
} from "@/lib/share";

export default function SharePage() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const payload = useMemo(() => readIncomingSharePayload(searchParams), [searchParams]);

  return <ShareReview key={searchKey} payload={payload} />;
}

function ShareReview({ payload }: { payload: ReturnType<typeof readIncomingSharePayload> }) {
  const router = useRouter();
  const [draftTitle, setDraftTitle] = useState(() => buildSharedTaskTitle(payload));

  const hasSharedContent = Boolean(payload.title || payload.text || payload.url);

  const handleCreateDraft = () => {
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) return;

    const params = new URLSearchParams();
    params.set(SHARE_DRAFT_ID_PARAM, crypto.randomUUID());
    params.set(SHARE_DRAFT_TITLE_PARAM, trimmedTitle);
    router.push(`/tasks?${params.toString()}`);
  };

  return (
    <div className="min-h-full bg-background px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Share2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Draft Task</h1>
            <p className="text-sm text-muted-foreground">Review the shared content, then open it as a draft task.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <label htmlFor="share-draft-title" className="mb-2 block text-sm font-medium text-card-foreground">
            Draft task title
          </label>
          <textarea
            id="share-draft-title"
            rows={4}
            maxLength={250}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="min-h-[112px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Draft task title"
          />
          <p className="mt-2 text-xs text-muted-foreground">{draftTitle.length}/250 characters</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-card-foreground">Incoming share</h2>

          {!hasSharedContent && (
            <p className="text-sm text-muted-foreground">No share payload was found. Open Dash from the system share sheet to review shared text or links here.</p>
          )}

          {payload.title && (
            <div className="mb-4 rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Shared title
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{payload.title}</p>
            </div>
          )}

          {payload.text && (
            <div className="mb-4 rounded-xl border border-border/70 bg-background/70 p-4 last:mb-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Shared text
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{payload.text}</p>
            </div>
          )}

          {payload.url && (
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />
                Shared link
              </div>
              <p className="break-all text-sm text-foreground">{payload.url}</p>
            </div>
          )}
        </section>

        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => router.push("/tasks")}>Cancel</Button>
          <Button onClick={handleCreateDraft} disabled={!draftTitle.trim()}>Create Draft Task</Button>
        </div>
      </div>
    </div>
  );
}