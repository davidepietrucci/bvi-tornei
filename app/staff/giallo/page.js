import { redirect } from "next/navigation";
import { managementHref } from "@/app/utils/tournament-workflow";

export default async function LegacyGiallo({ searchParams }) {
  const params = await searchParams;
  redirect(managementHref({ family: "giallo", tour: params.tour }));
}
