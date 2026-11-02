import { createAiHarness, directLlmRunner, type AgAiHarnessSetup, type AgAiPromptStarter } from "ag-studio";
import { claudeAdapter } from "./claudeAdapter";
import { DEFAULT_PROFILE, evaluateGift, monthName, usd, type Category, type Delivery } from "@/lib/rules";

const PROMPT_STARTERS: AgAiPromptStarter[] = [
  { label: "Who gave the most?", prompt: "Who gave Maya the most this year, and what did their gifts pay for?" },
  { label: "Add a chart by giver", prompt: "Add a column chart of the total given by each giver." },
  { label: "What if it were cash?", prompt: "Dan paid $800 toward Maya's rent on 2026-02-26 through her ABLE account. If he had sent it to her as cash instead, what would her SSI check have been?" },
];

const DELIVERIES = ["cash", "vendor", "item", "able"] as const satisfies readonly Delivery[];
const CATEGORIES = ["medical", "equipment", "phone", "internet", "education", "utility", "rent", "mortgage", "property_tax", "food", "clothing", "transport", "personal", "other"] as const satisfies readonly Category[];

/**
 * AG Studio's Studio Agent Framework, run on Claude: Studio's five built-in agents keep their own instructions and tools,
 * each driven by our Claude adapter, and the lead and data agents also get the Giftwise rules engine as a tool.
 */
export const studioAi: AgAiHarnessSetup = ({ api }) => {
  const adapter = claudeAdapter();
  const giftwiseCheck = api.defineAiTool({
    name: "ssi_rules_engine",
    description:
      "The Giftwise SSI rules engine (not a widget). Given one gift to Maya, real or hypothetical, returns her monthly SSI check after it, the month it changes, and the benefit-safe way to give it, with the rule ids. Call it directly for any question about how a gift would affect her check, including what-if questions; never estimate SSI benefits yourself.",
    params: (s) =>
      s.object({
        amount: s.number({ description: "Gift amount in US dollars." }),
        delivery: s.enum(DELIVERIES, { description: "How it reaches her: cash to her, vendor (paid straight to the shop), item (the item itself), or able (her ABLE account)." }),
        category: s.enum(CATEGORIES, { description: "What it pays for. Rent, mortgage, property_tax and utility are housing." }),
        date: s.string({ description: "Date the gift arrives, YYYY-MM-DD." }),
      }),
    execute: async (args, ctx) => {
      const a = args as { amount: number; delivery: Delivery; category: Category; date: string };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) return ctx.error("date must be YYYY-MM-DD.");
      const r = evaluateGift({ id: "studio", date: a.date, amount: a.amount, delivery: a.delivery, category: a.category }, DEFAULT_PROFILE);
      const better = r.checkWithBestRoute > r.checkAfter ? ` The benefit-safe way (${r.bestRoute}) keeps ${usd(r.checkWithBestRoute)}.` : "";
      return ctx.success(`${r.explanation.plain}${better} Her ${monthName(r.paymentMonth)} check: ${usd(r.checkAfter)}. Rules ${r.ruleIds.join(", ")}.`, {
        checkAfter: r.checkAfter,
        paymentMonth: r.paymentMonth,
        bestRoute: r.bestRoute,
        checkWithBestRoute: r.checkWithBestRoute,
        ruleIds: r.ruleIds,
      });
    },
  });

  return createAiHarness(api, ({ builtIn }) => ({
    agents: Object.values(builtIn).map((definition) =>
      directLlmRunner({
        ...definition,
        adapter,
        // The lead agent and the data agent can both ask the rules engine directly.
        ...(definition.id === "lead" || definition.id === "data" ? { tools: (ctx, params) => [...(definition.tools?.(ctx, params) ?? []), giftwiseCheck] } : {}),
      }),
    ),
    primary: "lead",
    promptStarters: PROMPT_STARTERS,
  }));
};
