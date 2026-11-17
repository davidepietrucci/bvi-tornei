import { completedMatch, matchStatus } from "@/app/utils/match-scoring";

export default function LiveMatchCard({ match, group }) {
  const status = matchStatus(match);
  const done = completedMatch(match);
  const sets = (match.score || []).filter((pair) => pair.every((n) => n !== "" && n !== null && n !== undefined));
  const score = match.legacyResult ? match.legacyResult.split(/[–—-]/).map(Number) : match.bestOf === 3
    ? sets.length ? [sets.filter((s) => Number(s[0]) > Number(s[1])).length, sets.filter((s) => Number(s[1]) > Number(s[0])).length] : null
    : sets[0];
  const names = (team) => team.flatMap((name) => String(name || "Da definire").split(/\s+(?:\/|&|\+|-)\s+/));
  const team = (players, side) => <p className={`min-w-0 break-words text-center text-sm leading-5 ${done && score && Number(score[side]) > Number(score[1 - side]) ? "font-bold text-[#101d2c]" : "font-medium text-[#647181]"}`}>{names(players).map((name, i) => <span key={i} className="block">{name}</span>)}</p>;
  return <article aria-label={`${group} · ${match.left.join(" + ")} contro ${match.right.join(" + ")}`} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-[#647181]"><span className="font-semibold">{group}</span><span>{[match.time, match.court && `Campo ${match.court}`].filter(Boolean).join(" · ") || "Orario e campo da definire"}</span></div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      {team(match.left, 0)}
      <div className="min-w-16 text-center"><p className="mb-1 text-[11px] font-semibold text-[#647181]">{status === "in_progress" ? "● In corso" : status === "finished" ? "Terminata" : match.ready === false ? "In attesa" : "Da giocare"}</p><p className="flex items-center justify-center gap-2 text-xl font-black tabular-nums text-[#101d2c]"><span>{score ? score[0] : "—"}</span><span aria-hidden="true" className="font-normal text-slate-300">–</span><span>{score ? score[1] : "—"}</span></p></div>
      {team(match.right, 1)}
    </div>
    {match.bestOf === 3 && sets.length > 0 && <p className="mt-2 text-center text-[11px] tabular-nums text-[#647181]">Set: {sets.map((pair) => pair.join("–")).join(" · ")}</p>}
    {match.legacyResult && <p className="mt-2 text-center text-[11px] text-[#647181]">Risultato storico</p>}
  </article>;
}
