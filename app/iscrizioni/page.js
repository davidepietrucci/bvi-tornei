import { redirect } from "next/navigation";

export default async function Iscrizioni({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item != null) query.append(key, item);
    }
  }

  const suffix = query.toString();
  redirect(`/atleta/iscriviti${suffix ? `?${suffix}` : ""}`);
}
