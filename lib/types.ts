export type Product = {
  id: string;
  slug: string;
  name: string;
  category: "DESK" | "MOBILE" | "FOCUS" | "TRAVEL";
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  featured: boolean;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  accent: string;
  imageUrl: string | null;
  detailPageVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationKind =
  | "TOSS_PAYMENTS"
  | "CONSULTATION_AI"
  | "CONTENT_AI"
  | "IMAGE_AI"
  | "TTS"
  | "VIDEO_LICENSE";

export type IntegrationSummary = {
  id: string;
  kind: IntegrationKind;
  provider: string;
  label: string;
  environment: "TEST" | "LIVE";
  status: "UNCONFIGURED" | "UNVERIFIED" | "READY" | "FAILED" | "DISABLED";
  maskedKey: string | null;
  settings: Record<string, unknown>;
  credentialVersion: number;
  lastCheckedAt: string | null;
  lastCheckMessage: string | null;
  updatedAt: string;
};

export type DetailPageVersion = {
  id: string;
  productId: string;
  version: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "REJECTED";
  title: string;
  seoTitle: string;
  seoDescription: string;
  blocks: DetailBlock[];
  claimReport: ClaimReportItem[];
  createdAt: string;
  updatedAt: string;
};

export type DetailBlock = {
  id: string;
  type: "hero" | "problem" | "features" | "proof" | "specs" | "recommendation" | "faq" | "cta";
  eyebrow?: string;
  title: string;
  body?: string;
  items?: Array<{ title: string; body: string; factIds: string[] }>;
  factIds: string[];
};

export type ClaimReportItem = {
  text: string;
  status: "SUPPORTED" | "REVIEW_REQUIRED" | "BLOCKED";
  factIds: string[];
};

export type ShortProject = {
  id: string;
  productId: string;
  detailPageVersionId: string;
  status: "DRAFT" | "SCRIPT_READY" | "QUEUED" | "RENDERING" | "READY" | "FAILED";
  durationSeconds: 15 | 30;
  angle: string;
  selectedHook: string | null;
  hooks: string[];
  script: Array<{
    scene: number;
    startSeconds: number;
    duration: number;
    voice: string;
    onScreen: string;
    visual: string;
    shotType: "PROBLEM" | "MASTER_PRODUCT" | "USE" | "FACT" | "RESULT" | "CTA";
    transition: "CUT" | "MATCH_CUT" | "PUSH" | "HOLD";
    factIds: string[];
  }>;
  renderArtifactUrl: string | null;
  captionUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
