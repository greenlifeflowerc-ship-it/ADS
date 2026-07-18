"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Loader2 } from "lucide-react";
import { updateBrainAction } from "@/server/actions/profiles";
import { Textarea } from "@/components/ui/textarea";

const BRAIN_TEMPLATE = `# Company
What the company does, in one or two sentences.

## Audience
Who we sell to and what they care about.

## Tone & voice
How we sound (e.g. warm, confident, playful).

## Offers
Key products/offers and their promises.

## Positioning
What makes us different from alternatives.

## Key messages
- Message 1
- Message 2
`;

export function BrainEditor({
  profileId,
  initialBrain,
}: {
  profileId: string;
  initialBrain: string;
}) {
  const [value, setValue] = useState(initialBrain);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onChange(v: string) {
    setValue(v);
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await updateBrainAction({ id: profileId, brainMd: v });
        setStatus("saved");
      } catch {
        setStatus("dirty");
      }
    }, 700);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Company brain</h3>
          <p className="text-xs text-muted-foreground">
            Markdown describing the company. Grounds every generation.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {status === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
          {status === "saved" && <Check className="h-3 w-3 text-emerald-500" />}
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Unsaved"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={BRAIN_TEMPLATE}
            className="min-h-[460px] resize-y font-mono text-xs leading-relaxed"
          />
          {!value.trim() && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => onChange(BRAIN_TEMPLATE)}
            >
              Insert starter template
            </button>
          )}
        </div>
        <div className="min-h-[460px] overflow-auto rounded-lg border bg-muted/20 p-4">
          {value.trim() ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Live preview appears here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
