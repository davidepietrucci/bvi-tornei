const ATHLETE_HOME = "/atleta/dashboard";

export function getAthleteRedirectUrl(rawUrl) {
  if (!rawUrl) return ATHLETE_HOME;

  try {
    // Keep only an internal athlete route so login cannot become an open redirect.
    const target = new URL(rawUrl, "https://bvi.invalid");
    if (!target.pathname.startsWith("/atleta/") || target.pathname === "/atleta/registrati") {
      return ATHLETE_HOME;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return ATHLETE_HOME;
  }
}
