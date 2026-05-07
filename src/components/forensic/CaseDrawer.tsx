import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, FolderOpen, X } from "lucide-react";
import type { Features } from "@/lib/features";

interface CaseRow {
  id: string;
  case_number: string;
  notes: string | null;
  features: Features;
  image_url: string | null;
  image_path: string | null;
  images?: string[];
  mode: string;
  style: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onLoad: (c: CaseRow) => void;
}

export function CaseDrawer({ open, onClose, onLoad }: Props) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("forensic_cases")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setCases((data ?? []) as unknown as CaseRow[]);
        setLoading(false);
      });
  }, [open]);

  const remove = async (c: CaseRow) => {
    if (c.image_path) {
      await supabase.storage.from("forensic-sketches").remove([c.image_path]);
    }
    const { error } = await supabase.from("forensic_cases").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    setCases((prev) => prev.filter((x) => x.id !== c.id));
    toast.success(`Case ${c.case_number} purged`);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-2xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <p className="label-stamp">Archive</p>
            <h2 className="mono text-lg font-semibold">Case Records</h2>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-3">
          {loading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {!loading && cases.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No cases archived yet.</p>
          )}
          <ul className="space-y-2">
            {cases.map((c) => {
              const imgs = (c.images && c.images.length > 0) ? c.images : (c.image_url ? [c.image_url] : []);
              return (
              <li key={c.id} className="rounded-md border border-border bg-background/40 p-3">
                <div className="flex gap-3">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-16 w-16 rounded object-cover ring-1 ring-border" />
                  ) : (
                    <div className="h-16 w-16 rounded bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="mono text-sm font-semibold text-primary">{c.case_number}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.notes || "No notes"}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {new Date(c.created_at).toLocaleString()} · {imgs.length} image{imgs.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => { onLoad(c); onClose(); }}
                      className="rounded border border-border p-1.5 hover:border-primary hover:text-primary"
                      title="Load"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="rounded border border-border p-1.5 hover:border-destructive hover:text-destructive"
                      title="Purge"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {imgs.length > 1 && (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto">
                    {imgs.map((u, i) => (
                      <img key={i} src={u} alt="" className="h-12 w-12 flex-shrink-0 rounded object-cover ring-1 ring-border" />
                    ))}
                  </div>
                )}
              </li>
            );})}
          </ul>
        </div>
      </div>
    </div>
  );
}

export type { CaseRow };
