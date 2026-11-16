import { redirect } from "next/navigation";
import { managementHref } from "@/app/utils/tournament-workflow";

export default async function LegacyGroups({ searchParams }) {
  const params = await searchParams;
  redirect(managementHref({ tour: params.tour, step: "groups" }));
}
