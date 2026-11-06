/** The failure cases the Evidence page's runner checks live. Client-safe: titles and expectations only. */
export const CASES = [
  { id: "declined", title: "The donor's card is declined", expected: "Nothing is charged, nothing is marked paid, and the donor sees a plain next step." },
  { id: "double", title: "The donor clicks Pay twice", expected: "PayPal charges once. Both clicks get the same capture." },
  { id: "unapproved", title: "Someone tries to complete a payment PayPal has not approved", expected: "PayPal refuses, nothing is charged, and the message is plain." },
  { id: "tamper", title: "A browser tries to change the amount or the payee", expected: "The server ignores both. Amount and payee come only from the need record." },
  { id: "rules", title: "A gift would lower her check", expected: "The rules engine skips that route and sends the money a benefit-safe way." },
  { id: "reviewer", title: "An AI reviewer gets the rule wrong", expected: "Its quote is not in its rulebook, so the referee sets it aside and her check stays whole." },
  { id: "ledger", title: "Someone edits a past ledger entry", expected: "Recomputing the chain finds the exact entry that changed." },
  { id: "refund", title: "Only the shop can send money back", expected: "Giftwise cannot pull money from a shop. PayPal allows the refund only from the account that received it." },
] as const;
export type CaseId = (typeof CASES)[number]["id"];
