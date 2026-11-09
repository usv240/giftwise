import { z } from "zod";

export const DeliverySchema = z
  .enum(["cash", "vendor", "item", "able"])
  .describe("How the gift reaches her: cash to her, paid to a vendor, the item itself, or her ABLE account. A home given outright is item, with category mortgage.");

export const CategorySchema = z
  .enum(["medical", "equipment", "phone", "internet", "education", "utility", "rent", "mortgage", "property_tax", "food", "clothing", "transport", "personal", "event", "other"])
  .describe("What the money is for. Rent, mortgage, property tax and utilities are housing (shelter). event means tickets to a game, show or other event; a birthday or holiday gift of money is other.");

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const CoversSchema = z
  .object({ from: MonthSchema.describe("First month covered, YYYY-MM."), to: MonthSchema.describe("Last month covered, YYYY-MM.") })
  .refine((c) => c.from <= c.to, { message: "from must be the same month as to or earlier." })
  .describe("For a housing bill paid ahead or behind: the months it covers. A gift's share for months up to the payment counts when it is paid, and each later month's share in that month (POMS SI 00835.360 D.2).");

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
  giver: z
    .string()
    .max(80)
    .optional()
    .describe("Who gives it, for example a first name. In a list of gifts, two gifts from the same giver in one quarter (or the months either side) are not one-off, so neither gets the $60 exclusion."),
  label: z.string().max(120).optional().describe("A short name for the gift, such as Wheelchair repair. It comes back with the answer and does not change the math."),
  covers: CoversSchema.optional(),
  payerCoOwns: z
    .boolean()
    .optional()
    .describe("True when the person paying a housing bill co-owns the home. The payment is not a gift, so with covers each month's share counts in that month, past months included (POMS SI 00835.360 D.3)."),
  rentPaid: z
    .number()
    .min(0)
    .max(100000)
    .optional()
    .describe("For rent below market from a landlord who is her parent or child: the monthly rent she pays, with category rent and amount the market rent less that rent. The subsidy counted is the lesser of the market rent and the presumed maximum value, less this rent (POMS SI 00835.380)."),
});

export const ProfileSchema = z
  .object({
    couple: z.boolean().default(false).describe("True for a couple who both receive SSI. A couple's full check is higher ($1,491 a month in 2026) and their savings limit is $3,000."),
    livesInAnothersHousehold: z
      .boolean()
      .default(false)
      .describe("True when she lives all month in someone else's home and does not pay her share of the housing costs. Housing help is then counted with the one-third reduction ($331.33 in 2026)."),
    householdProvidesAllMeals: z
      .boolean()
      .optional()
      .describe("Only used when livesInAnothersHousehold is true: whether that household gives her all her meals. The one-third reduction applies only then. Leave it out to mean true; false values housing help at up to $351.33 instead."),
    otherUnearnedMonthly: z.number().min(0).max(100000).default(0).describe("Other unearned income each month, in US dollars, such as a pension. It is counted along with any cash gift."),
    earnedMonthly: z.number().min(0).max(100000).default(0).describe("Wages each month, in US dollars. After the first $65 and any of the $20 exclusion that is left, half of the rest is counted."),
    ableEligible: z.boolean().default(true).describe("False when she cannot have an ABLE account. Then no gift is routed to ABLE."),
    ableBalance: z.number().min(0).default(0).describe("Her ABLE account balance, in US dollars. The answer does not depend on it, because the first $100,000 in an ABLE account does not count toward savings."),
    ableContributedThisYear: z
      .number()
      .min(0)
      .default(0)
      .describe("Dollars already put into her ABLE account this year. An ABLE gift that would pass the $20,000 yearly limit comes back with ambiguous set to true."),
    savings: z
      .number()
      .min(0)
      .default(1240)
      .describe("Her countable savings at the start of the month the gift arrives, in US dollars. Cash she keeps adds to it, and the answer says when it would pass the limit on the 1st ($2,000, or $3,000 for a couple)."),
  })
  .partial()
  .describe("The person who receives SSI. Every field is optional; leave it out for one adult who lives on her own with $1,240 in savings.");

export const CheckGiftRequest = z.object({
  gift: GiftSchema.describe("The gift to check."),
  profile: ProfileSchema.optional(),
});
export type CheckGiftRequest = z.infer<typeof CheckGiftRequest>;

export const PlanMonthRequest = z.object({
  gifts: z
    .array(GiftSchema.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date the gift arrives, YYYY-MM-DD.") }))
    .min(1)
    .max(500)
    .describe("Between 1 and 500 gifts, in any order. Each one needs a date."),
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
        recurring: z.boolean().optional().describe("True when the need comes back every month, such as rent."),
      }),
    )
    .min(1)
    .max(8)
    .describe("What the page asks for. Giftwise decides each route: housing goes to the ABLE account, everything else straight to the shop."),
});

export const KeyRequest = z.object({
  name: z.string().min(1).max(80).describe("Your name or your team's."),
  email: z.email().max(200).describe("Where to reach you about the key."),
  purpose: z.string().max(200).optional().describe("What you are building. Optional."),
  accept: z.literal(true).describe("You accept that sandbox keys are for testing, with no real money and no real personal data."),
});

export const ManageNeedRequest = z.object({
  title: z.string().trim().min(2).max(80).describe("What the money is for, in a few words."),
  detail: z.string().trim().max(200).optional().describe("One line for givers. Optional."),
  amount: z.number().min(1).max(20000).describe("Dollars still needed."),
  category: CategorySchema,
  vendor: z.string().trim().max(80).nullable().optional().describe("Who is paid: the shop, clinic or school. Housing always goes to the ABLE account."),
  payeePaypal: z
    .string()
    .trim()
    .max(254)
    .nullable()
    .optional()
    .describe("The shop's own PayPal email, so this need pays that account (sandbox only). Leave it out to keep the need's payee; send null or an empty string for the shared sandbox shop account. Housing always goes to the ABLE account."),
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
