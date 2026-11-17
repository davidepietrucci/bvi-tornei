// Sporting identity must come from the account, never from a username or email.
export function getAthleteName(user) {
  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();
  return firstName && lastName ? `${firstName} ${lastName}` : "";
}
