import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster, toast } from "sonner";
import {
  Sparkles,
  Download,
  Save,
  FolderOpen,
  Wand2,
  Image as ImageIcon,
  Pencil,
  Loader2,
  Shield,
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
          "Generate AI forensic suspect sketches and hyper-realistic portraits from facial attributes. Built for investigators.",
      },
      { property: "og:title", content: "Face Sketch AI — Forensic Suspect Composer" },
      {
        property: "og:description",
        content: "AI-powered composite sketch tool for forensic investigators.",
      },
    ],
  }),
  component: ForensicComposer,
});

type Mode = "sketch" | "realistic";
type Style = "grayscale" | "semi-real";

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
  const [loading, setLoading] = useState(false);
  const [caseNumber, setCaseNumber] = useState(genCaseNumber());
  const [notes, setNotes] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

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

  const refine = async () => {
    if (!refinement.trim()) return toast.message("Add a refinement prompt first");
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
      // upload to storage
      const blob = await (await fetch(imageUrl)).blob();
      const path = `${caseNumber}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("forensic-sketches").upload(path, blob, {
        contentType: "image/png",
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("forensic-sketches").getPublicUrl(path);

      const payload = {
        case_number: caseNumber,
        notes,
        features,
        image_url: urlData.publicUrl,
        image_path: path,
        mode,
        style,
      };

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
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-primary/40 bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h1 className="mono text-sm font-bold tracking-tight">FACE SKETCH AI</h1>
              <p className="label-stamp">Forensic Suspect Composer · v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded border border-border bg-background/60 px-3 py-1.5 text-xs sm:flex">
              <span className="label-stamp">Case #</span>
              <span className="mono font-semibold text-primary">{caseNumber}</span>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded border border-border bg-background/60 px-3 py-1.5 text-xs hover:border-primary"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Archive
            </button>
            <button
              onClick={newCase}
              className="rounded border border-border bg-background/60 px-3 py-1.5 text-xs hover:border-primary"
            >
              New Case
            </button>
          </div>
        </div>
        <div className="h-0.5 accent-bar" />
      </header>

      {/* Workspace split-screen */}
      <main className="grid h-[calc(100vh-65px)] grid-cols-1 gap-4 p-4 lg:grid-cols-[380px_1fr]">
        <FeaturePanel features={features} onChange={setFeatures} />

        <section className="flex flex-col gap-4 overflow-hidden">
          {/* Mode + style controls */}
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <div className="flex items-center gap-1 rounded border border-border bg-background/40 p-1">
              <button
                onClick={() => switchMode("sketch")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all",
                  mode === "sketch" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Pencil className="h-3.5 w-3.5" /> Sketch
              </button>
              <button
                onClick={() => switchMode("realistic")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all",
                  mode === "realistic" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" /> Realistic
              </button>
            </div>

            {mode === "sketch" && (
              <div className="flex items-center gap-1 rounded border border-border bg-background/40 p-1">
                {(["grayscale", "semi-real"] as Style[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={cn(
                      "rounded px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-all",
                      style === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => generate()}
                disabled={loading}
                className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Composite
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="panel scan-line relative flex flex-1 items-center justify-center overflow-hidden">
            {loading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mono text-xs uppercase tracking-widest text-muted-foreground">
                  {mode === "realistic" ? "Reconstructing portrait…" : "Rendering composite…"}
                </p>
              </div>
            )}
            <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
              <span className="label-stamp text-accent">● REC</span>
              <span className="label-stamp">{caseNumber}</span>
            </div>
            <div className="absolute right-3 top-3 z-10 text-right">
              <span className="label-stamp">{mode.toUpperCase()} · {style.toUpperCase()}</span>
            </div>

            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Forensic composite"
                className="max-h-full max-w-full object-contain p-8"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-8 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-border">
                  <Pencil className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mono text-sm font-semibold">Awaiting composite</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Select facial attributes from the dossier on the left, then run the composite generator.
                </p>
              </div>
            )}

            {/* corner brackets */}
            <Bracket pos="tl" /> <Bracket pos="tr" /> <Bracket pos="bl" /> <Bracket pos="br" />
          </div>

          {/* Refinement + actions */}
          <div className="panel grid gap-3 p-3 md:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                placeholder="Refine: e.g. add a small scar above the left eyebrow…"
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && refine()}
              />
              <button
                onClick={refine}
                disabled={loading}
                className="rounded border border-border px-3 py-1.5 text-xs hover:border-primary disabled:opacity-50"
              >
                Refine
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={download}
                disabled={!imageUrl}
                className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs hover:border-primary disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </button>
              <button
                onClick={saveCase}
                disabled={!imageUrl || loading}
                className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:brightness-110 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {activeCaseId ? "Update Case" : "Archive Case"}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Case notes — witness account, location, time of incident…"
              className="md:col-span-2 resize-none rounded border border-border bg-background/40 p-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Bracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls = {
    tl: "top-2 left-2 border-l-2 border-t-2",
    tr: "top-2 right-2 border-r-2 border-t-2",
    bl: "bottom-2 left-2 border-l-2 border-b-2",
    br: "bottom-2 right-2 border-r-2 border-b-2",
  }[pos];
  return <div className={cn("pointer-events-none absolute h-5 w-5 border-primary/60", cls)} />;
}
