// Shared row types for CMS-driven content. We type these manually because
// the auto-generated Supabase types file may lag behind migrations.

export type ModelRow = {
  id: string;
  slug: string;
  display_name: string;
  provider: string;
  category: string | null;
  description: string | null;
  context_length: number | null;
  input_price_per_1k: number | null;
  output_price_per_1k: number | null;
  modality: string;
  badges: string[];
  is_visible: boolean;
  sort_order: number;
};

export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  credits: number;
  bonus_credits: number;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
};

export type DocEntry = {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  sort_order: number;
};

export type FaqItem = { question: string; answer: string };

export type SiteSettings = {
  branding?: { name: string; tagline: string; logoEmoji?: string };
  hero?: { headline: string; subheadline: string; ctaPrimary: string; ctaSecondary: string };
  contact?: { email: string; docsUrl: string; statusUrl: string };
  company?: { name?: string; address?: string; registrationNo?: string; vatNo?: string };
  newapi?: { baseUrl: string; configured: boolean };
  seo?: { defaultTitle?: string; defaultDescription?: string; twitterHandle?: string; ogImage?: string };
  faq?: { items?: FaqItem[] };
};

