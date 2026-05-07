import { useMemo, useState } from "react";
import { FEATURE_CATEGORIES, type Features } from "@/lib/features";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  features: Features;
  onChange: (f: Features) => void;
  onGenerate?: () => void;
  loading?: boolean;
}

export function FeaturePanel({ features, onChange, onGenerate, loading }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    identity: true,
    face: true,
    skin: false,
    eyes: true,
  });

  const filledCount = useMemo(
    () => Object.values(features).filter((v) => v && v !== "none").length,
    [features],
  );

  const set = (k: string, v: string) => {
    const next = { ...features };
    if (next[k] === v) delete next[k];
    else next[k] = v;
    onChange(next);
  };

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <header className="border-b border-border px-5 py-4">
        <p className="label-stamp">Section 01 / Composite Builder</p>
        <h2 className="mt-1 text-lg font-semibold">Subject Attributes</h2>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (filledCount / 18) * 100)}%` }}
            />
          </div>
          <span className="mono tabular-nums text-foreground">{filledCount} traits</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {FEATURE_CATEGORIES.map((cat) => {
          const isOpen = open[cat.key] ?? false;
          const catFilled = cat.fields.filter((f) => features[f.key] && features[f.key] !== "none").length;
          return (
            <div key={cat.key} className="mb-2 overflow-hidden rounded-md border border-border/60 bg-background/40">
              <button
                onClick={() => setOpen({ ...open, [cat.key]: !isOpen })}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <span className="flex items-center gap-2">
                  <span className="mono text-[10px] tracking-widest text-muted-foreground">
                    {String(FEATURE_CATEGORIES.indexOf(cat) + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium">{cat.label}</span>
                  {catFilled > 0 && (
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                      {catFilled}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                />
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-border/60 px-3 py-3">
                  {cat.fields.map((field) => (
                    <div key={field.key}>
                      <p className="label-stamp mb-1.5">{field.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {field.options.map((opt) => {
                          const active = features[field.key] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => set(field.key, opt.value)}
                              className={cn(
                                "rounded border px-2 py-1 text-xs transition-all",
                                active
                                  ? "border-primary bg-primary/15 text-primary-foreground/90 shadow-[inset_0_0_0_1px_var(--primary)]"
                                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {onGenerate && (
        <div className="border-t border-border bg-background/60 p-3">
          <button
            onClick={onGenerate}
            disabled={loading || filledCount === 0}
            className="neon-btn flex w-full items-center justify-center gap-2 rounded px-4 py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? "Generating…" : `Submit & Generate Sketch (${filledCount})`}
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Composite will render in the preview panel →
          </p>
        </div>
      )}
    </aside>
  );
}
