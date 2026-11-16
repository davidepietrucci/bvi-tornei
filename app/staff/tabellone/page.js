import { redirect } from "next/navigation";
import { managementHref } from "@/app/utils/tournament-workflow";

export default async function LegacyFinals({ searchParams }) {
  const params = await searchParams;
  redirect(managementHref({ tour: params.tour, step: "finals" }));
}
