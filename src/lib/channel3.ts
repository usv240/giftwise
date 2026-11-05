/**
 * The benefit-safe gift finder. Channel3 (POST https://api.trychannel3.com/v1/search) returns real products across
 * retailers; Giftwise checks each one against the SSI rules before anyone can add it to a page. Without a
 * CHANNEL3_API_KEY the finder uses a small sample catalog, clearly marked, so every flow still works.
 */
import { createHash } from "node:crypto";
import sample from "../../content/finder-sample.json";
import { evaluateGift, type Category, type Profile } from "./rules";

const API = "https://api.trychannel3.com/v1/search";

export type FoundProduct = {
  id: string;
  title: string;
  brand: string | null;
  image: string | null;
  imageAlt: string | null;
  url: string | null;
  domain: string | null;
  price: number;
  currency: string;
  inStock: boolean;
  categoryPath: string | null;
};

export type CheckedProduct = FoundProduct & {
  category: Category;
  /** A gift card is not routed: SSA counts one that can buy food or shelter, or be resold, like cash. */
  giftCard: boolean;
  addable: boolean;
  check: number;
  checkBaseline: number;
  rule: string;
  ruleIds: string[];
};

export type FinderResult = { mode: "live" | "sample"; query: string; products: CheckedProduct[]; note?: string };

export const channel3Configured = () => Boolean(process.env.CHANNEL3_API_KEY?.trim());

type C3Product = {
  id: string;
  title: string;
  brands?: { id?: string; name?: string }[];
  images?: { url: string; cleaned_url?: string | null; is_main_image?: boolean; alt_text?: string | null }[];
  category?: { slug?: string; title?: string; path?: string | (string | { slug?: string; title?: string })[] } | null;
  offers?: { url: string; domain: string; price: { price: number; currency: string }; availability: string }[];
};

/**
 * A card that stands for money: a gift card, store credit or a prepaid card. Not a card holder, box or sleeve, which
 * is an ordinary item, and not a greeting card.
 */
export const isGiftCard = (title: string, path: string | null = null) => {
  const t = `${title} ${path ?? ""}`.toLowerCase();
  if (/\b(holders?|boxes|box|sleeves?|envelopes?|organizers?|wallets?|cases?)\b/.test(title.toLowerCase()) && !/\$\s?\d/.test(title)) return false;
  return /\bgift ?cards?\b|\be-?gift\b|store credit|prepaid (visa|mastercard|card)|\bgift certificates?\b/.test(t);
};

/**
 * Channel3's taxonomy to Giftwise's categories: the product's category path first (Electronics > Computers > Laptops),
 * then its title. A toy grocery set is a toy, not food. The organizer can still change the category before adding.
 */
export function categoryFor(title: string, path: string | null): Category {
  if (isGiftCard(title, path)) return "other";
  const p = (path ?? "").toLowerCase();
  const t = title.toLowerCase();
  const byPath: [RegExp, Category][] = [
    [/toys|games|pretend play/, "personal"],
    [/wheelchair|mobility|walkers?|canes|crutches|bath safety|daily living aids|patient (lifts|care)|hearing aids/, "equipment"],
    [/medical|health care|first aid|pharmacy|medicine|vitamins|supplements/, "medical"],
    [/textbooks|school supplies|office supplies > (school|education)|educational/, "education"],
    [/computers|laptops|tablets|electronics/, "equipment"],
    [/cell phones|mobile phones|smartphones/, "phone"],
    [/apparel|clothing|shoes|footwear|outerwear/, "clothing"],
    [/grocery|food|beverages/, "food"],
    [/tickets|event/, "event"],
    [/bicycles|scooters|transportation/, "transport"],
  ];
  for (const [re, c] of byPath) if (re.test(p)) return c;
  if (/wheelchair|walker|mobility|cane|crutch|shower chair|commode|grab bar|lift|ramp|hearing aid|cushion|brace/.test(t)) return "equipment";
  if (/medical|pharmacy|medicine|vitamin|first aid|thermometer|blood pressure/.test(t)) return "medical";
  if (/textbook|school|backpack|calculator|notebook|tuition/.test(t)) return "education";
  if (/laptop|computer|tablet|chromebook|ipad|monitor|keyboard|headphone/.test(t)) return "equipment";
  if (/phone|smartphone/.test(t)) return "phone";
  if (/coat|jacket|sweater|shirt|pants|sock|shoe|boot/.test(t)) return "clothing";
  if (/ticket|concert|admission/.test(t)) return "event";
  if (/bike|bicycle|scooter|bus pass/.test(t)) return "transport";
  return "personal";
}

function normalize(p: C3Product): FoundProduct | null {
  const offer = (p.offers ?? []).find((o) => o.availability === "InStock") ?? p.offers?.[0];
  if (!offer) return null;
  const img = p.images?.find((i) => i.is_main_image) ?? p.images?.[0];
  const raw = p.category?.path;
  const path = Array.isArray(raw) ? raw.map((x) => (typeof x === "string" ? x : (x.title ?? x.slug ?? ""))).filter(Boolean).join(" > ") : (raw ?? p.category?.title ?? null);
  return {
    id: p.id,
    title: p.title,
    brand: p.brands?.[0]?.name ?? null,
    image: img ? (img.cleaned_url ?? img.url) : null,
    imageAlt: img?.alt_text ?? null,
    url: offer.url,
    domain: offer.domain,
    price: Math.round(offer.price.price * 100) / 100,
    currency: offer.price.currency,
    inStock: offer.availability === "InStock",
    categoryPath: path,
  };
}

/** Each product through the rules: paid straight to the retailer, what happens to the check. */
export function checkProducts(products: FoundProduct[], profile: Profile, date: string): CheckedProduct[] {
  return products.map((p) => {
    const giftCard = isGiftCard(p.title, p.categoryPath);
    const category = categoryFor(p.title, p.categoryPath);
    if (giftCard) {
      const cash = evaluateGift({ id: p.id, date, amount: p.price, delivery: "cash", category: "other" }, profile);
      return {
        ...p,
        category,
        giftCard,
        addable: false,
        check: cash.checkAfter,
        checkBaseline: cash.checkBaseline,
        rule: `SSA counts a gift card that can buy food or shelter, or can be resold, like cash, so ${p.title.length > 40 ? "this card" : `"${p.title}"`} is not added. Choose the item itself instead.`,
        ruleIds: ["R-CASH-01"],
      };
    }
    const r = evaluateGift({ id: p.id, date, amount: p.price, delivery: "vendor", category }, profile);
    return { ...p, category, giftCard, addable: p.inStock && p.currency === "USD" && r.checkAfter >= r.checkBaseline, check: r.checkAfter, checkBaseline: r.checkBaseline, rule: r.explanation.plain, ruleIds: r.ruleIds };
  });
}

/** The built-in catalog: fictional products on example domains, so the finder works without a key. */
export function sampleProducts(query: string, maxPrice?: number, limit = 8): FoundProduct[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const all = (sample.products as FoundProduct[]).filter((p) => !maxPrice || p.price <= maxPrice);
  const hits = all.filter((p) => words.some((w) => `${p.title} ${p.categoryPath ?? ""}`.toLowerCase().includes(w)));
  return (hits.length ? hits : all).slice(0, limit);
}

const cache = new Map<string, { at: number; value: FoundProduct[] }>();

/** Search Channel3, or the sample catalog without a key. Results are cached for ten minutes to save credits. */
export async function findProducts(query: string, o: { maxPrice?: number; user?: string; limit?: number } = {}): Promise<{ mode: "live" | "sample"; products: FoundProduct[]; note?: string }> {
  const q = query.trim().slice(0, 120);
  const limit = Math.min(12, o.limit ?? 8);
  if (!channel3Configured()) return { mode: "sample", products: sampleProducts(q, o.maxPrice, limit), note: "Sample products, for trying the finder. Live results come from Channel3 when its key is set." };
  const key = JSON.stringify([q, o.maxPrice ?? null, limit]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return { mode: "live", products: hit.value };
  const body: Record<string, unknown> = { query: q, limit, filters: { availability: ["InStock"], ...(o.maxPrice ? { price: { max_price: o.maxPrice } } : {}) } };
  const r = await fetch(API, {
    method: "POST",
    headers: {
      "x-api-key": process.env.CHANNEL3_API_KEY!.trim(),
      "x-user-id": createHash("sha256").update(o.user ?? "giftwise").digest("hex").slice(0, 24),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Channel3 answered ${r.status}`);
  const j = (await r.json()) as { products?: C3Product[] };
  const products = (j.products ?? []).map(normalize).filter((p): p is FoundProduct => p !== null);
  cache.set(key, { at: Date.now(), value: products });
  return { mode: "live", products };
}

/** Find and check in one step, falling back to the sample catalog if Channel3 does not answer. */
export async function findGifts(query: string, profile: Profile, date: string, o: { maxPrice?: number; user?: string } = {}): Promise<FinderResult> {
  try {
    const f = await findProducts(query, o);
    return { mode: f.mode, query, products: checkProducts(f.products, profile, date), note: f.note };
  } catch {
    return { mode: "sample", query, products: checkProducts(sampleProducts(query, o.maxPrice), profile, date), note: "Channel3 did not answer just now, so these are sample products." };
  }
}
