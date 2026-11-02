import type { Category, Delivery } from "@/lib/rules";

/** Labels the dashboard shows, and the reverse lookups its custom widget uses to hand rows back to the rules engine. Client-safe. */
export const ROUTE_LABEL: Record<Delivery, string> = { vendor: "Paid to the shop", able: "ABLE account", item: "The item itself", cash: "Cash" };
export const CATEGORY_LABEL: Record<Category, string> = {
  medical: "Medical",
  equipment: "Equipment and repairs",
  phone: "Phone",
  internet: "Internet",
  education: "School",
  utility: "Utilities",
  rent: "Rent",
  mortgage: "Mortgage",
  property_tax: "Property tax",
  food: "Food",
  clothing: "Clothing",
  transport: "Transport",
  personal: "Personal",
  other: "Savings and other",
};

const invert = <K extends string>(m: Record<K, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, K>;
export const ROUTE_CODE = invert(ROUTE_LABEL);
export const CATEGORY_CODE = invert(CATEGORY_LABEL);
