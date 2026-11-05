import { redirect } from "next/navigation";
import { Suspense } from "react";

/** Old address for starting a gift page: the fundraiser tab on Try it makes one, and a ?name= carries over to it. */
async function Forward({ searchParams }: { searchParams: Promise<{ name?: string | string[] }> }) {
  const { name } = await searchParams;
  const first = (Array.isArray(name) ? name[0] : name)?.trim().slice(0, 40);
  return redirect(first ? `/try?name=${encodeURIComponent(first)}#fundraiser` : "/try#fundraiser");
}

export default function AppPage({ searchParams }: { searchParams: Promise<{ name?: string | string[] }> }) {
  return (
    <Suspense fallback={null}>
      <Forward searchParams={searchParams} />
    </Suspense>
  );
}
