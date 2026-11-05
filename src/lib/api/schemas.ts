import { z } from "zod";

export const DeliverySchema = z.enum(["cash", "vendor", "item", "able"]).describe("How the gift reaches her: cash to her, paid to a vendor, the item itself, or her ABLE account.");

export const CategorySchema = z
  .enum(["medical", "equipment", "phone", "internet", "education", "utility", "rent", "mortgage", "property_tax", "food", "clothing", "transport", "personal", "event", "other"])
  .describe("What the money is for. Rent, mortgage, property tax and utilities are housing (shelter). event means tickets to a game, show or other event; a birthday or holiday gift of money is other.");

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
    householdProvidesAllMeals: z.boolean().optional(),
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

export const GiftPageRequest = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^\p{L}[\p{L} .'-]*$/u, "Use letters only.")
    .describe("First name of the person who receives SSI, as it should appear on the page."),
  pronoun: z.enum(["she", "he", "they"]).describe("How the page refers to them: she/her, he/him or they/them."),
  organizer: z.string().trim().max(60).optional().describe("Who is organizing, for the thank-you line. Optional."),
  note: z.string().trim().max(400).optional().describe("A short note to givers. Optional; a plain default is written if empty."),
  source_url: z.string().url().max(2000).optional().describe("The fundraiser page the needs came from. Optional."),
  needs: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(80).describe("What the money is for, in a few words."),
        amount: z.number().min(1).max(20000).describe("Dollars still needed."),
        category: CategorySchema,
        vendor: z.string().trim().max(80).nullable().optional().describe("The kind of business that would be paid, for example a van conversion shop."),
        recurring: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(8)
    .describe("What the page asks for. Giftwise decides each route: housing goes to the ABLE account, everything else straight to the shop."),
});

export const KeyRequest = z.object({
  name: z.string().min(1).max(80).describe("Your name or your team's."),
  email: z.email().max(200),
  purpose: z.string().max(200).optional().describe("What you are building. Optional."),
  accept: z.literal(true).describe("You accept that sandbox keys are for testing, with no real money and no real personal data."),
});

export const ManageNeedRequest = z.object({
  title: z.string().trim().min(2).max(80).describe("What the money is for, in a few words."),
  detail: z.string().trim().max(200).optional().describe("One line for givers. Optional."),
  amount: z.number().min(1).max(20000).describe("Dollars still needed."),
  category: CategorySchema,
  vendor: z.string().trim().max(80).nullable().optional().describe("Who is paid: the shop, clinic or school. Housing always goes to the ABLE account."),
  recurring: z.boolean().optional(),
  link: z
    .string()
    .trim()
    .max(2000)
    .regex(/^https:\/\//, "Use an https link.")
    .nullable()
    .optional()
    .describe("Where givers can see the item, for example the product page a search found."),
});

export const ManagePageRequest = z.object({
  note: z.string().trim().max(400).optional(),
  status: z.enum(["open", "closed"]).optional(),
});

export const ManageWebhookRequest = z.object({ url: z.string().trim().max(2000).nullable() });

export const AskRulesRequest = z.object({
  question: z.string().trim().min(4).max(300).describe("A question about SSI and gifts, in plain words, for example \"Does it count if my sister pays my phone bill?\""),
});
