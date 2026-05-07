export type FeatureOption = { value: string; label: string };
export type FeatureField = {
  key: string;
  label: string;
  options: FeatureOption[];
};
export type FeatureCategory = {
  key: string;
  label: string;
  fields: FeatureField[];
};

const opts = (...vals: string[]): FeatureOption[] =>
  vals.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    key: "identity",
    label: "Identity",
    fields: [
      { key: "gender", label: "Gender", options: opts("male", "female", "non-binary") },
      {
        key: "age",
        label: "Age",
        options: opts("teen", "20s", "30s", "40s", "50s", "60s", "70s+"),
      },
      {
        key: "expression",
        label: "Expression",
        options: opts("neutral", "stern", "angry", "tense", "calm", "smirking"),
      },
    ],
  },
  {
    key: "face",
    label: "Face Structure",
    fields: [
      {
        key: "faceShape",
        label: "Face Shape",
        options: opts(
          "oval",
          "round",
          "square",
          "diamond",
          "heart",
          "long",
          "rectangular",
          "triangular",
        ),
      },
    ],
  },
  {
    key: "skin",
    label: "Skin",
    fields: [
      {
        key: "skinTone",
        label: "Skin Tone",
        options: opts("very fair", "fair", "light", "olive", "tan", "brown", "dark", "deep"),
      },
      { key: "skinTexture", label: "Texture", options: opts("smooth", "rough", "wrinkled") },
      { key: "freckles", label: "Freckles", options: opts("none", "light", "moderate", "heavy") },
      { key: "marks", label: "Facial Marks", options: opts("none", "moles", "birthmark", "scars") },
    ],
  },
  {
    key: "eyes",
    label: "Eyes",
    fields: [
      { key: "eyeShape", label: "Shape", options: opts("almond", "round", "hooded", "monolid") },
      { key: "eyeSize", label: "Size", options: opts("small", "medium", "large") },
      {
        key: "eyeColor",
        label: "Color",
        options: opts("brown", "blue", "green", "hazel", "gray", "amber"),
      },
      { key: "eyeSpacing", label: "Spacing", options: opts("close-set", "average", "wide-set") },
      { key: "eyeAngle", label: "Angle", options: opts("upturned", "neutral", "downturned") },
    ],
  },
  {
    key: "brows",
    label: "Eyebrows",
    fields: [
      { key: "browThickness", label: "Thickness", options: opts("thin", "medium", "thick", "bushy") },
      { key: "browCurve", label: "Curve", options: opts("straight", "arched", "rounded") },
    ],
  },
  {
    key: "nose",
    label: "Nose",
    fields: [
      { key: "noseWidth", label: "Width", options: opts("narrow", "medium", "wide") },
      { key: "noseLength", label: "Length", options: opts("short", "medium", "long") },
      { key: "noseBridge", label: "Bridge", options: opts("straight", "roman", "button", "crooked") },
      { key: "noseTip", label: "Tip", options: opts("pointed", "rounded", "upturned", "bulbous") },
    ],
  },
  {
    key: "lips",
    label: "Lips",
    fields: [
      { key: "lipThickness", label: "Thickness", options: opts("thin", "medium", "full") },
      { key: "lipWidth", label: "Width", options: opts("narrow", "medium", "wide") },
      { key: "lipShape", label: "Shape", options: opts("flat", "heart", "bow") },
    ],
  },
  {
    key: "hair",
    label: "Hair",
    fields: [
      {
        key: "hairStyle",
        label: "Style",
        options: opts("buzz cut", "short", "medium", "long", "ponytail", "bun", "bald", "afro"),
      },
      { key: "hairTexture", label: "Texture", options: opts("straight", "wavy", "curly", "coily") },
      {
        key: "hairColor",
        label: "Color",
        options: opts("black", "brown", "blonde", "red", "gray", "white", "dyed"),
      },
      { key: "hairline", label: "Hairline", options: opts("low", "average", "high", "receding", "widow's peak") },
    ],
  },
  {
    key: "facialHair",
    label: "Facial Hair",
    fields: [
      {
        key: "beard",
        label: "Beard",
        options: opts("none", "stubble", "goatee", "short beard", "full beard"),
      },
      { key: "mustache", label: "Mustache", options: opts("none", "thin", "thick", "handlebar") },
    ],
  },
  {
    key: "jaw",
    label: "Jaw & Chin",
    fields: [
      { key: "jaw", label: "Jaw", options: opts("soft", "defined", "sharp", "wide") },
      { key: "chin", label: "Chin", options: opts("small", "medium", "prominent", "cleft", "pointed") },
    ],
  },
  {
    key: "ears",
    label: "Ears",
    fields: [
      { key: "earSize", label: "Size", options: opts("small", "medium", "large") },
      { key: "earAngle", label: "Angle", options: opts("flat", "average", "protruding") },
    ],
  },
  {
    key: "extras",
    label: "Distinguishing Marks",
    fields: [
      { key: "glasses", label: "Glasses", options: opts("none", "round", "square", "aviator", "rimless") },
      { key: "scar", label: "Scar", options: opts("none", "cheek", "brow", "lip", "neck") },
      { key: "tattoo", label: "Tattoo", options: opts("none", "neck", "face", "temple") },
    ],
  },
];

export type Features = Record<string, string>;

export function buildPrompt(features: Features, mode: "sketch" | "realistic", style: string, refinement?: string) {
  const traits = Object.entries(features)
    .filter(([, v]) => v && v !== "none")
    .map(([k, v]) => {
      const field = FEATURE_CATEGORIES.flatMap((c) => c.fields).find((f) => f.key === k);
      return `${field?.label ?? k}: ${v}`;
    })
    .join("; ");

  const base = `Forensic composite of a single suspect, front-facing portrait, neutral background.
Subject traits — ${traits || "average adult, neutral features"}.`;

  if (mode === "sketch") {
    const styleLine =
      style === "semi-real"
        ? "Pencil sketch with soft color shading layered over graphite lines."
        : "Pure black-and-white police forensic pencil sketch, hand-drawn graphite shading on off-white paper, high detail, no color.";
    return `${base}\n${styleLine} Anatomically accurate, focus on identifiable facial structure. ${refinement ?? ""}`.trim();
  }

  return `${base}\nHyper-realistic photographic portrait, studio lighting, sharp focus, neutral expression preserved, accurate to age and ethnicity, photo-real skin texture. ${refinement ?? ""}`.trim();
}
