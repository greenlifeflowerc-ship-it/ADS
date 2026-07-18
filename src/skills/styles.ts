/**
 * Creative ad-style presets + marketing/people rules. PURE data + string helpers
 * (no I/O) so they live in the skills layer and can also drive the Generate UI.
 *
 * Each style is a proven direct-response ad format. A style sets the creative
 * approach; `people` decides whether a human appears; the marketing + realism
 * directives make every output feel like a converting ad shot on a real camera.
 */

export type PeopleMode = "auto" | "with" | "without";

export type AdStyle = {
  id: string;
  label: string;
  /** One-line explanation shown in the UI. */
  description: string;
  /** Whether this format normally features a person (used when people = "auto"). */
  defaultPeople: "with" | "without";
  /** Creative direction woven into image + carousel + video prompts. */
  directive: string;
  /** Extra direction for video (talking-head vs b-roll pacing). */
  videoDirective: string;
};

export const AD_STYLES: AdStyle[] = [
  {
    id: "ugc_testimonial",
    label: "UGC / Testimonial",
    description: "Authentic phone-shot person recommending the product to camera.",
    defaultPeople: "with",
    directive:
      "Authentic UGC/testimonial: a real everyday person, casually holding or using the product, candid selfie-style framing that feels shot on a phone — relatable, trustworthy, unpolished-premium (NOT a studio ad).",
    videoDirective:
      "Talking-head UGC: the person speaks the script directly to camera, handheld, natural room lighting, quick authentic delivery.",
  },
  {
    id: "expert_authority",
    label: "Expert / Authority",
    description: "A credible presenter or founder presenting with authority.",
    defaultPeople: "with",
    directive:
      "Authority presenter: a credible, culturally-authentic expert/founder confidently presenting the product in a real retail/clinic/kitchen setting; direct eye contact, insider-advice energy that builds instant trust.",
    videoDirective:
      "Presenter piece-to-camera: composed, confident delivery of the script; real environment with product stock visible behind for legitimacy.",
  },
  {
    id: "product_hero",
    label: "Product Hero",
    description: "Premium studio hero shot, product as the star.",
    defaultPeople: "without",
    directive:
      "Premium product hero: the product is the clear star on a designed studio set, dramatic directional lighting, tasteful reflections and shadow, brand-color backdrop, rich texture — luxury commercial quality.",
    videoDirective:
      "Cinematic product b-roll: slow push-ins, gentle rotation, macro texture details; voiceover only, no dialogue.",
  },
  {
    id: "lifestyle_scene",
    label: "Lifestyle Scene",
    description: "Product living inside a real daily-life moment.",
    defaultPeople: "with",
    directive:
      "Lifestyle moment: the product placed naturally inside a real, aspirational daily-life scene (home, morning routine, gym, table) with authentic props and warm atmosphere; the product is present but integrated, not staged.",
    videoDirective:
      "Observational lifestyle b-roll: natural human movement in a real setting, the product used in-context; warm, cinematic, voiceover-led.",
  },
  {
    id: "flatlay_editorial",
    label: "Flatlay / Editorial",
    description: "Top-down arrangement with ingredients & props.",
    defaultPeople: "without",
    directive:
      "Top-down flatlay: the product arranged with complementary ingredients and props on a textured surface, editorial magazine styling, balanced negative space, soft even light — clean, appetizing, premium.",
    videoDirective:
      "Overhead flatlay motion: hands entering frame to arrange props, slow top-down reveals; voiceover-led.",
  },
  {
    id: "benefit_result",
    label: "Benefit / Result",
    description: "Visualize the outcome the product delivers.",
    defaultPeople: "with",
    directive:
      "Benefit visualization: dramatize the RESULT the product delivers (energy, vitality, health, glow, calm) as a vivid real moment around the product; make the payoff feel tangible and desirable.",
    videoDirective:
      "Transformation beats: show the before-feeling then the after-payoff with the product as the turning point; energetic pacing.",
  },
  {
    id: "problem_solution",
    label: "Problem → Solution",
    description: "Contrast the pain, then the relief the product brings.",
    defaultPeople: "with",
    directive:
      "Problem→solution: open on the relatable problem/pain, then reveal the product as the relief; clear visual contrast between the two states, empathetic and convincing.",
    videoDirective:
      "Two-act structure: act 1 the frustration, act 2 the product-led relief and payoff; clear turn in the middle.",
  },
  {
    id: "luxury_editorial",
    label: "Luxury Editorial",
    description: "High-end magazine aesthetic, moody premium lighting.",
    defaultPeople: "without",
    directive:
      "Luxury editorial: high-end magazine aesthetic, rich materials (marble, velvet, gold, wood), moody directional lighting, elegant restraint and deep contrast — makes the product feel exclusive and expensive.",
    videoDirective:
      "Slow luxury cinematography: elegant slow moves, shallow depth, dramatic light play; sparse premium voiceover.",
  },
];

export const DEFAULT_AD_STYLE = "ugc_testimonial";

export function getAdStyle(id?: string): AdStyle {
  return AD_STYLES.find((s) => s.id === id) ?? AD_STYLES.find((s) => s.id === DEFAULT_AD_STYLE)!;
}

/** Resolve the explicit people choice, defaulting to the style's default. */
export function resolvePeople(mode: PeopleMode | undefined, style: AdStyle): "with" | "without" {
  if (mode === "with" || mode === "without") return mode;
  const d = style.defaultPeople;
  return d === "with" || d === "without" ? d : "with";
}

/** Instruction about whether (and how) a human appears. */
export function peopleDirective(people: "with" | "without"): string {
  return people === "with"
    ? "PEOPLE: Feature exactly ONE real, authentic person who fits the brand's target audience, market and culture. Natural candid expression, believable eye contact and gaze, realistic skin/hands/styling; the person interacts with the product naturally and is clearly the emotional anchor."
    : "PEOPLE: No people, faces, or body parts anywhere in frame — focus entirely on the product, ingredients, and the scene.";
}

/** Fixed marketing rules that make an image read as a converting ad, not a render. */
export const MARKETING_DIRECTIVE = [
  "MARKETING RULES (make it convert):",
  "- Instantly scroll-stopping: one clear focal subject, strong figure-to-ground contrast, confident composition readable at a glance.",
  "- Lead with the benefit and emotion (health, energy, trust, luxury), not specs; make the viewer FEEL the payoff.",
  "- Keep clean negative space for a short punchy headline/overlay; never cluttered.",
  "- On-brand: use the brand's colors and mood; the product is clearly recognizable and desirable.",
  "- Native to the feed and the target market/culture — looks like premium creator content, not a generic stock ad.",
].join("\n");
