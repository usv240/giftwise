import { redirect } from "next/navigation";

/** The caregiver workspace is in progress; until then, start from the sample gift page. */
export default function AppPage() {
  redirect("/g/maya");
}
