import { z } from "zod";

export const DeliverySchema = z.enum(["cash", "vendor", "item", "able"]).describe("How the gift reaches her: cash to her, paid to a vendor, the item itself, or her ABLE account.");

export const CategorySchema = z
  .enum(["medical", "equipment", "phone", "internet", "education", "utility", "rent", "mortgage", "property_tax", "food", "clothing", "transport", "personal", "other"])
  .describe("What the money is for. Rent, mortgage, property tax and utilities are housing (shelter).");

export const GiftSchema = z.object({
  amount: z.number().min(0).max(100000).describe("Gift amount in US dollars."),
  delivery: DeliverySchema,
  category: CategorySchema.default("other"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Date the gift arrives, YYYY-MM-DD. Defaults to today."),
  recurring: z.boolean().optional().describe("True when the same giver pays this every month."),
  giver: z.string().max(80).optional(),
  label: z.string().max(120).optional(),
});

export const ProfileSchema = z
  .object({
    couple: z.boolean().default(false),
    livesInAnothersHousehold: z.boolean().default(false),
    otherUnearnedMonthly: z.number().min(0).max(100000).default(0),
    earnedMonthly: z.number().min(0).max(100000).default(0),
    ableEligible: z.boolean().default(true),
    ableBalance: z.number().min(0).default(0),
    ableContributedThisYear: z.number().min(0).default(0),
    savings: z.number().min(0).default(1240),
  })
  .partial();

export const CheckGiftRequest = z.object({
  gift: GiftSchema,
  profile: ProfileSchema.optional(),
});
export type CheckGiftRequest = z.infer<typeof CheckGiftRequest>;

export const PlanMonthRequest = z.object({
  gifts: z.array(GiftSchema.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).min(1).max(500),
  profile: ProfileSchema.optional(),
});

export const AnalyzeFundraiserRequest = z.object({
  url: z.string().min(8).max(2000).describe("A public fundraiser page, http or https. A path on this site, such as /samples/fundraiser.html, also works."),
});

export const ReviewBillRequest = z.object({
  description: z.string().min(3).max(2000).describe("What the bill is for, in its own words: the business, the service and any line items."),
  amount: z.number().min(1).max(100000).describe("Amount someone else would pay, in US dollars."),
  category: CategorySchema.describe("The category the bill was read as. Housing categories (rent, mortgage, property tax, utility) are the ones the reviewers settle."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Date it is paid, YYYY-MM-DD. Defaults to today."),
  recurring: z.boolean().optional().describe("True when the same person pays it every month."),
  profile: ProfileSchema.optional(),
});

export const KeyRequest = z.object({
  name: z.string().min(1).max(80).describe("Your name or your team's."),
  email: z.email().max(200),
  purpose: z.string().max(200).optional().describe("What you are building. Optional."),
  accept: z.literal(true).describe("You accept that sandbox keys are for testing, with no real money and no real personal data."),
});
