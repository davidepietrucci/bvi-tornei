"use client";

import { Suspense, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import AthleteNameForm from "@/app/components/AthleteNameForm";
import { getAthleteName } from "@/app/utils/athleteIdentity";
import { getAthleteRedirectUrl } from "@/app/utils/athleteRedirect";

function CompleteProfile() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const requested = getAthleteRedirectUrl(params.get("redirect_url"));
  const target = requested.split("?")[0].split("#")[0] === "/atleta/completa-profilo" ? "/atleta/dashboard" : requested;
  const complete = Boolean(getAthleteName(user));
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      const returnUrl = `/atleta/completa-profilo?redirect_url=${encodeURIComponent(target)}`;
      router.replace(`/atleta?redirect_url=${encodeURIComponent(returnUrl)}`);
    } else if (complete) {
      router.replace(target);
    }
  }, [isLoaded, user, complete, router, target]);
  if (!isLoaded || !user || complete) return <p className="p-8" role="status">Caricamento…</p>;
  return <AthleteNameForm />;
}

export default function CompleteProfilePage() {
  return <Suspense fallback={<p className="p-8">Caricamento…</p>}><CompleteProfile /></Suspense>;
}
