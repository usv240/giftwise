import { paypalRest } from "@/lib/paypal/client";

/**
 * PayPal's reporting APIs, read from the organization's own account: the Balances API for what the fund holds, and
 * Transaction Search to confirm each payout in PayPal's own transaction report. In the sandbox, new transactions can
 * take up to three hours to appear in Transaction Search, so a payout reads "waiting for PayPal's report" until then.
 */
type Balance = { balances?: { currency?: string; available_balance?: { value?: string } }[]; as_of_time?: string };
type Search = { transaction_details?: { transaction_info?: { transaction_id?: string; transaction_event_code?: string; transaction_amount?: { value?: string }; transaction_status?: string; transaction_updated_date?: string } }[] };

export async function fundBalance() {
  const r = await paypalRest<Balance>("/v1/reporting/balances?currency_code=USD", { method: "GET" });
  if (r.status >= 400) return null;
  const usd = r.body.balances?.find((b) => b.currency === "USD") ?? r.body.balances?.[0];
  return { available: Number(usd?.available_balance?.value ?? 0), asOf: r.body.as_of_time ?? null };
}

const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Transaction ids PayPal's report holds for this account, from `since` until now (at most 31 days, as the API allows). */
export async function reportedTransactions(since: Date) {
  const end = new Date();
  const start = new Date(Math.max(since.getTime() - 86400_000, end.getTime() - 31 * 86400_000));
  const ids = new Map<string, { code: string; amount: number; status: string }>();
  for (let page = 1; page <= 5; page++) {
    const q = new URLSearchParams({ start_date: stamp(start), end_date: stamp(end), fields: "transaction_info", page_size: "100", page: String(page) });
    const r = await paypalRest<Search & { total_pages?: number }>(`/v1/reporting/transactions?${q}`, { method: "GET" });
    if (r.status >= 400) return { ok: false as const, ids };
    for (const t of r.body.transaction_details ?? []) {
      const i = t.transaction_info;
      if (i?.transaction_id) ids.set(i.transaction_id, { code: i.transaction_event_code ?? "", amount: Number(i.transaction_amount?.value ?? 0), status: i.transaction_status ?? "" });
    }
    if ((r.body.total_pages ?? 1) <= page) break;
  }
  return { ok: true as const, ids };
}
