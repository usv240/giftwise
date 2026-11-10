import { routeGift } from "@/lib/routing";
import { DEFAULT_PROFILE, type Profile } from "@/lib/rules";

export { DEFAULT_PROFILE };

/** The sample page's four needs, as open needs the router fills: shops, the electric bill to her ABLE account, therapy. */
const NEEDS = [
  { id: 1, title: "Wheelchair repair", category: "equipment", route: "vendor", payeeName: "Riverside Mobility Repair", payeeAccount: "vendor:riverside", amount: 420, funded: 0, recurring: false },
  { id: 2, title: "Laptop for college", category: "education", route: "vendor", payeeName: "Eastgate College Bookstore", payeeAccount: "vendor:eastgate", amount: 649, funded: 0, recurring: false },
  { id: 3, title: "Electric bill, this month", category: "utility", route: "able", payeeName: "ABLE account", payeeAccount: "able", amount: 138, funded: 0, recurring: true },
  { id: 4, title: "Therapy co-pay", category: "medical", route: "vendor", payeeName: "Northside Physical Therapy", payeeAccount: "vendor:northside", amount: 90, funded: 0, recurring: false },
];

/** $1,500 given to those needs in November 2026: her January 2027 check with Giftwise, with no gift, and as cash. */
export function routeGiftCheck(profile: Profile) {
  const plan = routeGift(1500, NEEDS, "2026-11-12", profile, "ABLE account");
  return { withGiftwise: plan.checkWithRouting, baseline: plan.baseline, asCash: plan.checkIfCash };
}
