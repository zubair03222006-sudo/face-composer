import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster, toast } from "sonner";
import {
  Sparkles,
  Download,
  Save,
  FolderOpen,
  Wand2,
  Pencil,
  Loader2,
  Shield,
  Camera,
  History,
  Send,
  ImagePlus,
  ScanLine,
  Maximize2,
} from "lucide-react";
import { generateSketch } from "@/lib/generate.functions";
import { buildPrompt, type Features } from "@/lib/features";
import { FeaturePanel } from "@/components/forensic/FeaturePanel";
import { CaseDrawer, type CaseRow } from "@/components/forensic/CaseDrawer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Face Sketch AI — Forensic Suspect Composer" },
      {
        name: "description",
        content:
          "Cyberpunk AI forensic suspect composer — generate sketches and hyper-realistic portraits from facial attributes.",
      },
    ],
  }),
  component: ForensicComposer,
});

type Mode = "sketch" | "realistic";
type Style = "grayscale" | "semi-real";

const REFINEMENT_CHIPS = [
  "make eyes bigger",
  "add a beard",
  "reduce age by 10 years",
  "make nose thinner",
  "add angry expression",
  "add scar on left cheek",
];

function genCaseNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `FS-${year}-${rand}`;
}

function ForensicComposer() {
  const generateFn = useServerFn(generateSketch);
  const [features, setFeatures] = useState<Features>({});
  const [mode, setMode] = useState<Mode>("sketch");
  const [style, setStyle] = useState<Style>("grayscale");
  const [refinement, setRefinement] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyTab, setHistoryTab] = useState<"recent" | "old">("recent");
  const [oldSketches, setOldSketches] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [caseNumber, setCaseNumber] = useState(genCaseNumber());
  const [notes, setNotes] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const loadOldSketches = useCallback(async () => {
    const { data } = await supabase
      .from("forensic_cases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    setOldSketches((data ?? []) as unknown as CaseRow[]);
  }, []);

  useEffect(() => {
    if (historyTab === "old") loadOldSketches();
  }, [historyTab, loadOldSketches]);

  const generate = useCallback(
    async (opts?: { useBase?: boolean; mode?: Mode; style?: Style }) => {
      const m = opts?.mode ?? mode;
      const s = opts?.style ?? style;
      const prompt = buildPrompt(features, m, s, refinement);
      setLoading(true);
      try {
        const baseImage = opts?.useBase && imageUrl ? imageUrl : undefined;
        const res = await generateFn({ data: { prompt, baseImage } });
        setImageUrl(res.imageUrl);
        setHistory((prev) => [res.imageUrl, ...prev].slice(0, 12));
        toast.success(m === "realistic" ? "Realistic portrait generated" : "Composite sketch generated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setLoading(false);
      }
    },
    [features, mode, style, refinement, imageUrl, generateFn],
  );

  const switchMode = async (m: Mode) => {
    setMode(m);
    if (imageUrl) await generate({ useBase: true, mode: m });
  };

  const refine = async (text?: string) => {
    const r = (text ?? refinement).trim();
    if (!r) return toast.message("Add a refinement prompt first");
    if (text) setRefinement(text);
    await generate({ useBase: !!imageUrl });
  };

  const download = async () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `${caseNumber}.png`;
    a.click();
  };

  const saveCase = async () => {
    if (!imageUrl) return toast.error("Generate an image before saving");
    setLoading(true);
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const path = `${caseNumber}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("forensic-sketches").upload(path, blob, {
        contentType: "image/png",
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("forensic-sketches").getPublicUrl(path);

      // Collect ALL generated images for this session (current + history, deduped)
      const allImages = Array.from(new Set([imageUrl, ...history].filter(Boolean) as string[]));

      const payload = {
        case_number: caseNumber,
        notes,
        features,
        image_url: urlData.publicUrl,
        image_path: path,
        images: allImages,
        mode,
        style,
      } as never;

      if (activeCaseId) {
        const { error } = await supabase.from("forensic_cases").update(payload).eq("id", activeCaseId);
        if (error) throw error;
        toast.success(`Case ${caseNumber} updated`);
      } else {
        const { data, error } = await supabase.from("forensic_cases").insert(payload).select().single();
        if (error) throw error;
        setActiveCaseId(data.id);
        toast.success(`Case ${caseNumber} archived`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const newCase = () => {
    setFeatures({});
    setImageUrl(null);
    setHistory([]);
    setNotes("");
    setRefinement("");
    setMode("sketch");
    setStyle("grayscale");
    setCaseNumber(genCaseNumber());
    setActiveCaseId(null);
  };

  const loadCase = (c: CaseRow) => {
    setFeatures(c.features || {});
    setImageUrl(c.image_url);
    setNotes(c.notes ?? "");
    setCaseNumber(c.case_number);
    setMode((c.mode as Mode) || "sketch");
    setStyle((c.style as Style) || "grayscale");
    setActiveCaseId(c.id);
  };

  return (
    <div className="relative z-10 min-h-screen">
      <Toaster theme="dark" position="top-right" />
      <CaseDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onLoad={loadCase} />

      {/* Header */}
      <header className="border-b border-border bg-card/40 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-primary/50 bg-primary/10 text-primary neon-border">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h1 className="mono text-sm font-bold tracking-tight text-glow">FACE SKETCH AI</h1>
              <p className="label-stamp">Forensic Suspect Composer · v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-primary">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="mono uppercase tracking-wider">Secure Link</span>
            </div>
            <span className="label-stamp">CASE #<span className="text-primary text-glow">{caseNumber}</span></span>
            <span className="label-stamp">{now.toLocaleDateString()}</span>
            <button
              onClick={() => setDrawerOpen(true)}
              className="ml-2 flex items-center gap-1.5 rounded border border-border bg-background/40 px-3 py-1.5 hover:border-primary hover:text-primary"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Archive
            </button>
          </div>
        </div>
        <div className="h-0.5 accent-bar" />
      </header>

      {/* Workspace */}
      <main className="grid h-[calc(100vh-65px)] grid-cols-1 gap-3 p-3 lg:grid-cols-[340px_1fr_300px]">
        <FeaturePanel features={features} onChange={setFeatures} />

        {/* Center column */}
        <section className="flex flex-col gap-3 overflow-hidden">
          {/* Composite Preview Card */}
          <div className="panel flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Maximize2 className="h-3.5 w-3.5 text-primary" />
                <h2 className="mono text-xs font-semibold uppercase tracking-wider text-glow">Composite Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <SegToggle
                  value={mode}
                  onChange={(v) => switchMode(v as Mode)}
                  options={[
                    { value: "sketch", label: "Sketch" },
                    { value: "realistic", label: "Realistic" },
                  ]}
                />
                {mode === "sketch" && (
                  <SegToggle
                    value={style}
                    onChange={(v) => setStyle(v as Style)}
                    options={[
                      { value: "grayscale", label: "B/W" },
                      { value: "semi-real", label: "Color" },
                    ]}
                  />
                )}
              </div>
            </div>

            {/* Canvas */}
            <div className={cn(
              "scan-line canvas-grid relative flex flex-1 items-center justify-center overflow-hidden m-4 rounded border border-primary/30 neon-border",
              loading && "scanning",
            )}>
              <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
                <span className="label-stamp text-primary">● REC</span>
                <span className="label-stamp">{caseNumber}</span>
              </div>
              <div className="absolute right-3 top-3 z-10 text-right">
                <span className="label-stamp text-primary">{mode.toUpperCase()} · {style.toUpperCase()}</span>
              </div>

              {imageUrl ? (
                <img src={imageUrl} alt="Forensic composite" className="max-h-full max-w-full object-contain p-6" />
              ) : (
                <div className="flex flex-col items-center gap-3 px-8 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-primary/40 text-primary">
                    <Camera className="h-7 w-7" />
                  </div>
                  <p className="mono text-sm font-semibold text-glow">NO COMPOSITE GENERATED</p>
                  <p className="text-xs text-muted-foreground">Configure suspect attributes & press GENERATE</p>
                </div>
              )}

              {loading && (
                <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded border border-primary/50 bg-background/80 px-3 py-1.5 text-[10px] mono uppercase tracking-widest text-primary backdrop-blur">
                  <ScanLine className="mr-1.5 inline h-3 w-3 animate-pulse" />
                  {mode === "realistic" ? "Reconstructing portrait…" : "Scanning composite…"}
                </div>
              )}

              <Bracket pos="tl" /> <Bracket pos="tr" /> <Bracket pos="bl" /> <Bracket pos="br" />
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border px-4 py-3">
              <button
                onClick={() => generate()}
                disabled={loading}
                className="neon-btn flex items-center gap-2 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate
              </button>
              <ActionBtn icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => switchMode("realistic")} disabled={!imageUrl || loading}>
                Convert to Realistic
              </ActionBtn>
              <ActionBtn icon={<Save className="h-3.5 w-3.5" />} onClick={saveCase} disabled={!imageUrl || loading}>
                Save to Case
              </ActionBtn>
              <ActionBtn icon={<Download className="h-3.5 w-3.5" />} onClick={download} disabled={!imageUrl}>
                Export
              </ActionBtn>
              <ActionBtn icon={<Pencil className="h-3.5 w-3.5" />} onClick={newCase}>
                New Case
              </ActionBtn>
            </div>
          </div>

          {/* Case File */}
          <div className="panel p-3">
            <div className="mb-2 flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <h3 className="mono text-xs font-semibold uppercase tracking-wider text-glow">Case File</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-[200px_1fr]">
              <div>
                <p className="label-stamp mb-1">Case Number</p>
                <input
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  className="mono w-full rounded border border-border bg-background/40 px-2 py-1.5 text-xs text-primary focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <p className="label-stamp mb-1">Investigator Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Witness account, location, suspect description, distinguishing marks…"
                  className="w-full resize-none rounded border border-border bg-background/40 px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Refinement Console */}
          <div className="panel p-3">
            <div className="mb-2 flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <h3 className="mono text-xs font-semibold uppercase tracking-wider text-glow">AI Refinement Console</h3>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                placeholder="e.g. make jaw sharper, add curly hair, add scar on left cheek…"
                className="flex-1 rounded border border-border bg-background/40 px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && refine()}
              />
              <button
                onClick={() => refine()}
                disabled={loading}
                className="neon-btn flex items-center gap-1.5 rounded px-3 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Apply
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REFINEMENT_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => refine(c)}
                  disabled={loading}
                  className="rounded border border-border bg-background/40 px-2 py-1 text-[10px] mono text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right panel — history */}
        <aside className="panel hidden flex-col overflow-hidden lg:flex">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <History className="h-3.5 w-3.5 text-primary" />
            <SegToggle
              value={historyTab}
              onChange={(v) => setHistoryTab(v as "recent" | "old")}
              options={[
                { value: "recent", label: "Recent" },
                { value: "old", label: "Old Sketches" },
              ]}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {historyTab === "recent" ? (
              history.length === 0 ? (
                <p className="mt-12 text-center label-stamp">No generations yet</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {history.map((u, i) => (
                    <li key={i}>
                      <button onClick={() => setImageUrl(u)} className="block w-full overflow-hidden rounded border border-border hover:border-primary">
                        <img src={u} className="h-full w-full object-cover" alt={`gen ${i}`} />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : oldSketches.length === 0 ? (
              <p className="mt-12 text-center label-stamp">No archived cases</p>
            ) : (
              <ul className="space-y-2">
                {oldSketches.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => loadCase(c)} className="flex w-full gap-2 rounded border border-border p-2 text-left hover:border-primary">
                      {c.image_url ? (
                        <img src={c.image_url} className="h-12 w-12 rounded object-cover" alt="" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="mono text-[11px] font-semibold text-primary truncate">{c.case_number}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function SegToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded border border-border bg-background/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-[10px] mono font-medium uppercase tracking-wider transition-all",
            value === o.value
              ? "bg-primary/20 text-primary text-glow shadow-[inset_0_0_0_1px_var(--primary)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ActionBtn({
  children,
  icon,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded border border-border bg-background/40 px-3 py-2 text-[11px] mono font-medium uppercase tracking-wider hover:border-primary hover:text-primary disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}

function Bracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls = {
    tl: "top-1.5 left-1.5 border-l-2 border-t-2",
    tr: "top-1.5 right-1.5 border-r-2 border-t-2",
    bl: "bottom-1.5 left-1.5 border-l-2 border-b-2",
    br: "bottom-1.5 right-1.5 border-r-2 border-b-2",
  }[pos];
  return <div className={cn("pointer-events-none absolute h-4 w-4 border-primary", cls)} style={{ filter: "drop-shadow(0 0 4px var(--primary))" }} />;
}
