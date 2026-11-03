import { redirect } from "next/navigation";

/** Old address for starting a gift page: the fundraiser tab on Try it makes one. */
export default function AppPage() {
  redirect("/try#fundraiser");
}
