import { z } from "zod";
import { asData, structured, type StructuredOpts } from "./claude";

const CATEGORIES = ["medical", "equipment", "phone", "internet", "education", "utility", "rent", "mortgage", "property_tax", "food", "clothing", "transport", "personal", "event", "other"] as const;

export const BillSchema = z.object({
  vendor_name: z.string().describe("Business that issued the bill or quote."),
  vendor_category: z.enum(CATEGORIES).describe("What the bill is for. Utilities are power, gas, water, sewer or trash."),
  amount_due: z.number().describe("Total amount due in dollars."),
  currency: z.string(),
  due_date: z.string().nullable().describe("YYYY-MM-DD if shown, otherwise null."),
  customer_name: z.string().nullable(),
  line_items: z.array(z.object({ description: z.string(), amount: z.number() })),
  is_shelter_cost: z.boolean().describe("True for rent, mortgage, property tax or utilities."),
  confidence: z.number().min(0).max(1),
  explanation: z.object({
    plain: z.string().describe("Under 40 words, everyday language, positive tone, no jargon. Say what the bill is, who sent it, the total and the due date. Do not say how it should be paid."),
    technical: z.string().describe("Which fields were read and how the category was chosen."),
  }),
});
export type Bill = z.infer<typeof BillSchema>;

const BILL_SYSTEM = `You read bills, invoices and quotes for Giftwise, a tool that helps families pay a shop directly for someone who receives SSI.
Extract only what is visible. If a value is not shown, use null. Choose the category from what the bill is for, not from the vendor's name alone.
Write explanation.plain in warm, plain words: what the bill is, who sent it, the total and when it is due. Never say how to pay it or whether paying it directly is safe, never give legal advice and never compute benefit amounts: Giftwise's rules engine chooses the route (rent and utilities paid straight to the company can count against SSI, so the engine sends those to her ABLE account).`;

/** The request that reads a bill: the document as data, the fields to fill. Its replay key names the file by `fileSha256`. */
export function billRequest(file: { base64: string; mediaType: string; fileSha256?: string }): StructuredOpts<typeof BillSchema> {
  const block =
    file.mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } } as const)
      : ({ type: "image", source: { type: "base64", media_type: file.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: file.base64 } } as const);
  return {
    schema: BillSchema,
    system: BILL_SYSTEM,
    effort: "medium",
    content: [block, { type: "text", text: "Read this document and fill in the fields." }],
    fileSha256: file.fileSha256,
  };
}

export async function readBill(file: { base64: string; mediaType: string; fileSha256?: string }, how: { replayOnly?: boolean } = {}) {
  return structured(billRequest(file), how);
}

export const FundraiserSchema = z.object({
  title: z.string(),
  goal_amount: z.number().nullable(),
  raised_amount: z.number().nullable(),
  beneficiary_description: z.string().describe("Who the fundraiser helps, without personal details beyond what the page states."),
  uses: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().nullable().describe("Dollar amount if the page states one."),
        category: z.enum(CATEGORIES),
        likely_vendor: z.string().nullable().describe("Type of business that would be paid, for example a van conversion shop."),
      }),
    )
    .describe("What the money is for, as stated on the page."),
  mentions_benefits: z.boolean().describe("True if the page mentions SSI, Medicaid or disability benefits."),
  explanation: z.object({ plain: z.string(), technical: z.string() }),
});
export type Fundraiser = z.infer<typeof FundraiserSchema>;

/**
 * The request that reads a fundraiser page. For a page this site ships, `keyUrl` is its path: the replay key reads the
 * page under that name, so the sample's recorded answer is found on every host while Claude is still sent the full address.
 */
export function fundraiserRequest(pageText: string, url: string, keyUrl?: string): StructuredOpts<typeof FundraiserSchema> {
  const ask = { type: "text" as const, text: "Extract the fundraiser details." };
  return {
    schema: FundraiserSchema,
    system: `You read public fundraising pages for Giftwise. Extract the goal, the amount raised and each stated use of the money, so Giftwise can plan benefit-safe ways to deliver the help. Use only facts on the page. Keep explanation.plain under 40 words and positive.`,
    effort: "medium",
    content: [asData("fundraiser_page", `URL: ${url}\n\n${pageText}`), ask],
    ...(keyUrl ? { keyContent: [asData("fundraiser_page", `URL: ${keyUrl}\n\n${pageText}`), ask] } : {}),
  };
}

export async function readFundraiser(pageText: string, url: string, how: { replayOnly?: boolean; keyUrl?: string } = {}) {
  return structured(fundraiserRequest(pageText, url, how.keyUrl), how);
}
