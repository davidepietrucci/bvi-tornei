"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { getTornei, getGironi, getBracket } from "@/app/utils/db";

export default function PortaleLiveMobile() {
  const [tornei, setTornei] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [activeGirone, setActiveGirone] = useState("A");
  const [config, setConfig] = useState(null);
  const [bracketConfig, setBracketConfig] = useState(null);
  const [activeTab, setActiveTab] = useState("iniziali"); // "iniziali", "intermedi", "finali"
  const [loading, setLoading] = useState(true);

  // 1. Carica l'elenco dei tornei e determina quello da visualizzare
  useEffect(() => {
    getTornei().then((parsed) => {
      setTornei(parsed);

      const params = new URLSearchParams(window.location.search);
      const urlTour = params.get("tour");

      if (urlTour && parsed.some((t) => t.nome === urlTour)) {
        setSelectedTorneo(urlTour);
      } else {
        // Cerca tornei attivi per primi
        const attivi = parsed.filter(
          (t) => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione"
        );
        if (attivi.length > 0) {
          setSelectedTorneo(attivi[0].nome);
        } else if (parsed.length > 0) {
          setSelectedTorneo(parsed[0].nome);
        }
      }
      setLoading(false);
    });
  }, []);

  // 2. Caricamento live dei gironi e dei bracket del torneo selezionato
  useEffect(() => {
    if (!selectedTorneo) return;
    setActiveTab("iniziali");
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_");

    const fetchLive = () => {
      getGironi(slug).then((data) => {
        setConfig(data);
        if (data) {
          const gDisponibili = data.numGironi
            ? Array.from({ length: data.numGironi }, (_, i) => String.fromCharCode(65 + i))
            : [];
          setActiveGirone((prev) => {
            if (gDisponibili.length > 0 && !gDisponibili.includes(prev)) {
              return gDisponibili[0];
            }
            return prev;
          });
        }
      });
      getBracket(slug).then((data) => {
        setBracketConfig(data);
      });
    };

    fetchLive();
    const interval = setInterval(fetchLive, 10000);
    return () => clearInterval(interval);
  }, [selectedTorneo]);

  const gironiDisponibili =
    config && config.pubblicato
      ? Array.from({ length: config.numGironi || 0 }, (_, i) => String.fromCharCode(65 + i))
      : [];
  const selectedTorneoObj = tornei.find((t) => t.nome === selectedTorneo);
  const isConcluso = selectedTorneoObj?.stato === "Concluso";

  // Logica per calcolare il calendario degli incontri
  const getSchedule = (numTeams, gironeId, assignments = {}) => {
    const getName = (idx) =>
      assignments[idx] && assignments[idx] !== "—" && assignments[idx] !== "Slot Libero"
        ? assignments[idx]
        : `Slot ${idx + 1}`;
    const type = config?.gironeTypes?.[gironeId] || "Pool";
    if (!numTeams || numTeams < 2) return [];

    if (type === "Girone all'italiana") {
      const rrMatches = [];
      for (let i = 0; i < numTeams; i++) {
        for (let j = i + 1; j < numTeams; j++) {
          rrMatches.push({ left: getName(i), right: getName(j) });
        }
      }
      return rrMatches;
    }

    if (numTeams === 2) return [{ left: getName(0), right: getName(1) }];
    if (numTeams === 3)
      return [
        { left: getName(0), right: getName(2) },
        { left: getName(1), right: getName(2) },
        { left: getName(0), right: getName(1) },
      ];
    if (numTeams === 4) {
      const getResult = (idx) => {
        const meta = config?.matchMetadata?.[`${gironeId}-${idx}`] || {};
        const s1L = parseInt(meta.s1L || 0);
        const s1R = parseInt(meta.s1R || 0);
        if (s1L === 0 && s1R === 0)
          return { winner: `Vincente G${idx + 1}`, loser: `Perdente G${idx + 1}` };

        if (config?.gironeSets?.[gironeId] === "3 set") {
          let winL = 0, winR = 0;
          if (s1L > s1R) winL++;
          else if (s1R > s1L) winR++;
          if (parseInt(meta.s2L || 0) > parseInt(meta.s2R || 0)) winL++;
          else if (parseInt(meta.s2R || 0) > parseInt(meta.s2L || 0)) winR++;
          if (parseInt(meta.s3L || 0) > parseInt(meta.s3R || 0)) winL++;
          else if (parseInt(meta.s3R || 0) > parseInt(meta.s3L || 0)) winR++;

          if (winL > winR)
            return {
              winner: idx === 0 ? getName(0) : getName(1),
              loser: idx === 0 ? getName(3) : getName(2),
            };
          return {
            winner: idx === 0 ? getName(3) : getName(2),
            loser: idx === 0 ? getName(0) : getName(1),
          };
        }

        if (s1L > s1R)
          return {
            winner: idx === 0 ? getName(0) : getName(1),
            loser: idx === 0 ? getName(3) : getName(2),
          };
        return {
          winner: idx === 0 ? getName(3) : getName(2),
          loser: idx === 0 ? getName(0) : getName(1),
        };
      };

      const g1 = getResult(0);
      const g2 = getResult(1);

      return [
        { left: getName(0), right: getName(3) },
        { left: getName(1), right: getName(2) },
        { left: g1.winner, right: g2.winner },
        { left: g1.loser, right: g2.loser },
      ];
    }
    if (numTeams === 5)
      return [
        { left: getName(0), right: getName(4) },
        { left: getName(1), right: getName(3) },
        { left: getName(2), right: getName(4) },
        { left: getName(0), right: getName(1) },
        { left: getName(2), right: getName(3) },
      ];
    return [];
  };

  const calculateRanking = () => {
    if (!config || !config.gironeAssignments || !config.gironeAssignments[activeGirone]) return [];

    const assignments = config.gironeAssignments[activeGirone];
    const teamCount = config.teamCounts[activeGirone] || 0;
    const metadata = config.matchMetadata || {};
    const isThreeSets = config.gironeSets?.[activeGirone] === "3 set";

    const stats = {};
    for (let i = 0; i < teamCount; i++) {
      const name = assignments[i];
      if (name && name !== "—" && name !== "Slot Libero") {
        stats[name] = {
          nome: name,
          giocate: 0,
          vinte: 0,
          perse: 0,
          puntiFatti: 0,
          puntiSubiti: 0,
          score: 0,
        };
      }
    }

    const schedule = getSchedule(teamCount, activeGirone, assignments);
    schedule.forEach((match, i) => {
      const meta = metadata[`${activeGirone}-${i}`];
      if (!meta) return;

      const teamL = match.left;
      const teamR = match.right;

      if (!stats[teamL] || !stats[teamR]) return;

      const s1L = parseInt(meta.s1L || 0),
        s1R = parseInt(meta.s1R || 0);
      const s2L = parseInt(meta.s2L || 0),
        s2R = parseInt(meta.s2R || 0);
      const s3L = parseInt(meta.s3L || 0),
        s3R = parseInt(meta.s3R || 0);
      if (s1L === 0 && s1R === 0) return;

      stats[teamL].giocate++;
      stats[teamR].giocate++;
      stats[teamL].puntiFatti += s1L + s2L + s3L;
      stats[teamL].puntiSubiti += s1R + s2R + s3R;
      stats[teamR].puntiFatti += s1R + s2R + s3R;
      stats[teamR].puntiSubiti += s1L + s2L + s3L;

      let matchWinL = 0;
      if (isThreeSets) {
        let setsL = 0,
          setsR = 0;
        if (s1L > s1R) setsL++;
        else if (s1R > s1L) setsR++;
        if (s2L > s2R) setsL++;
        else if (s2R > s2L) setsR++;
        if (s3L > s3R) setsL++;
        else if (s3R > s3L) setsR++;
        matchWinL = setsL > setsR ? 1 : 0;
      } else {
        matchWinL = s1L > s1R ? 1 : 0;
      }
      if (matchWinL) {
        stats[teamL].vinte++;
        stats[teamL].score++;
        stats[teamR].perse++;
      } else {
        stats[teamR].vinte++;
        stats[teamR].score++;
        stats[teamL].perse++;
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const qzTeamA = a.puntiSubiti === 0 ? a.puntiFatti : a.puntiFatti / a.puntiSubiti;
      const qzTeamB = b.puntiSubiti === 0 ? b.puntiFatti : b.puntiFatti / b.puntiSubiti;
      return qzTeamB - qzTeamA;
    });
  };

  // Metodi per i playoff
  const getAllBracketMatches = () => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};
    const isGroups = bracketConfig.subPhaseType === "groups";

    const matchIds = Object.keys(assignments)
      .map((k) => k.replace(/-L$|-R$/, ""))
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter((mid) => {
        if (isGroups) {
          return (
            mid.endsWith("-s1") ||
            mid.endsWith("-s2") ||
            mid.endsWith("-f1") ||
            mid.endsWith("-f3")
          );
        }
        return (
          !mid.includes("-A-") &&
          !mid.includes("-B-") &&
          !mid.match(/-(?:A|B)-\d/) &&
          !mid.match(/-(?:A|B)-m\d/)
        );
      });

    return matchIds.map((mid) => ({
      id: mid,
      label: mid.toUpperCase(),
      left: assignments[`${mid}-L`],
      right: assignments[`${mid}-R`],
      scoreL: metadata[mid]?.scoreL,
      scoreR: metadata[mid]?.scoreR,
      time: metadata[mid]?.time,
      court: metadata[mid]?.court,
    }));
  };

  const getIntermediateGroupStats = (groupKey) => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};
    const stats = {};
    const teams = [
      assignments[`${groupKey}-0`],
      assignments[`${groupKey}-1`],
      assignments[`${groupKey}-2`],
      assignments[`${groupKey}-3`],
    ].filter((t) => t && t !== "—" && t !== "Slot Libero");

    teams.forEach((t) => {
      stats[t] = { nome: t, giocate: 0, vinte: 0, perse: 0, pf: 0, ps: 0, punti: 0 };
    });

    const pairMaps = [
      [0, 3],
      [1, 2],
      [0, 2],
      [1, 3],
      [0, 1],
      [2, 3],
    ];

    pairMaps.forEach((pair, idx) => {
      const teamL = assignments[`${groupKey}-${pair[0]}`];
      const teamR = assignments[`${groupKey}-${pair[1]}`];
      if (!teamL || !teamR || !stats[teamL] || !stats[teamR]) return;

      const mKey = `${groupKey}-m${idx}`;
      const meta = metadata[mKey] || {};
      const s1L = parseInt(meta.scoreL || 0);
      const s1R = parseInt(meta.scoreR || 0);
      if (s1L === 0 && s1R === 0) return;

      stats[teamL].giocate++;
      stats[teamR].giocate++;
      stats[teamL].pf += s1L;
      stats[teamR].pf += s1R;
      stats[teamL].ps += s1R;
      stats[teamR].ps += s1L;

      if (s1L > s1R) {
        stats[teamL].vinte++;
        stats[teamL].punti++;
        stats[teamR].perse++;
      } else {
        stats[teamR].vinte++;
        stats[teamR].punti++;
        stats[teamL].perse++;
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.punti !== a.punti) return b.punti - a.punti;
      const qzA = a.ps === 0 ? a.pf : a.pf / a.ps;
      const qzB = b.ps === 0 ? b.pf : b.pf / b.ps;
      return qzB - qzA;
    });
  };

  const getIntermediateGroupMatches = (groupKey) => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};
    const teams = [
      assignments[`${groupKey}-0`],
      assignments[`${groupKey}-1`],
      assignments[`${groupKey}-2`],
      assignments[`${groupKey}-3`],
    ];

    const matchPairs = [
      { l: 0, r: 3, label: "Gara 1" },
      { l: 1, r: 2, label: "Gara 2" },
      { l: 0, r: 2, label: "Gara 3" },
      { l: 1, r: 3, label: "Gara 4" },
      { l: 0, r: 1, label: "Gara 5" },
      { l: 2, r: 3, label: "Gara 6" },
    ];

    return matchPairs
      .map((pair, idx) => {
        const teamL = teams[pair.l];
        const teamR = teams[pair.r];
        const mKey = `${groupKey}-m${idx}`;
        return {
          label: pair.label,
          left: teamL,
          right: teamR,
          meta: metadata[mKey] || {},
        };
      })
      .filter(
        (m) =>
          m.left &&
          m.left !== "—" &&
          m.left !== "Slot Libero" &&
          m.right &&
          m.right !== "—" &&
          m.right !== "Slot Libero"
      );
  };

  const renderIntermediateGroupForSpectator = (groupKey, title, color) => {
    const stats = getIntermediateGroupStats(groupKey);
    const matches = getIntermediateGroupMatches(groupKey);
    const titleColor = color === "gold" ? "text-yellow-600" : "text-gray-500";
    const badgeColor =
      color === "gold" ? "bg-yellow-400 text-white shadow-sm" : "bg-gray-400 text-white shadow-sm";

    return (
      <div className="space-y-4 mb-8">
        <h3 className={`text-sm font-black uppercase tracking-widest text-center ${titleColor}`}>
          {title}
        </h3>

        {/* Card-based Standings */}
        <div className="space-y-3">
          {stats.map((team, idx) => {
            const quotient = team.ps === 0 ? team.pf : (team.pf / team.ps).toFixed(3);
            const isQualified = idx < 2;
            return (
              <div
                key={team.nome}
                className={`bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex items-center justify-between ${
                  isQualified
                    ? color === "gold"
                      ? "border-l-4 border-l-yellow-400"
                      : "border-l-4 border-l-gray-400"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                      isQualified ? badgeColor : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[#0a1628] text-xs uppercase tracking-tight truncate">
                      {team.nome}
                    </p>
                    <p className="text-[9px] text-gray-400 font-semibold mt-0.5">
                      G: <span className="text-[#0a1628] font-bold">{team.giocate}</span> | V/P:{" "}
                      <span className="text-green-600 font-bold">{team.vinte}</span>/
                      <span className="text-red-500 font-bold">{team.perse}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black text-[#0a1628] tracking-tighter leading-none">
                    {team.punti}
                  </p>
                  <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mt-1">
                    Punti
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stacked Matches List */}
        <div className="space-y-3 mt-4">
          {matches.map((m, idx) => {
            const hasScore = m.meta?.scoreL || m.meta?.scoreR;
            const scoreL = parseInt(m.meta?.scoreL || 0);
            const scoreR = parseInt(m.meta?.scoreR || 0);
            const isWinnerL = hasScore && scoreL > scoreR;
            const isWinnerR = hasScore && scoreR > scoreL;

            return (
              <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-2.5 border-b border-gray-50 pb-2">
                  <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">
                    {m.label}
                  </span>
                  <div className="flex gap-1">
                    {m.meta?.time && (
                      <span className="text-[8px] font-black text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                        {m.meta.time}
                      </span>
                    )}
                    {m.meta?.court && (
                      <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        C.{m.meta.court}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs uppercase font-bold truncate pr-4 ${
                        isWinnerL ? "text-[#0a1628] font-black" : "text-gray-500"
                      }`}
                    >
                      {m.left}
                    </span>
                    <span
                      className={`text-xs font-black ${
                        isWinnerL ? "text-green-600 font-extrabold" : "text-gray-400"
                      }`}
                    >
                      {hasScore ? scoreL : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs uppercase font-bold truncate pr-4 ${
                        isWinnerR ? "text-[#0a1628] font-black" : "text-gray-500"
                      }`}
                    >
                      {m.right}
                    </span>
                    <span
                      className={`text-xs font-black ${
                        isWinnerR ? "text-green-600 font-extrabold" : "text-gray-400"
                      }`}
                    >
                      {hasScore ? scoreR : "-"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBracketMatch = (matchId, customLabel) => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return null;
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};

    const left = assignments[`${matchId}-L`];
    const right = assignments[`${matchId}-R`];

    const meta = metadata[matchId] || {};
    const scoreL = parseInt(meta.scoreL || 0);
    const scoreR = parseInt(meta.scoreR || 0);
    const hasScore = meta.scoreL || meta.scoreR;
    const isWinnerL = hasScore && scoreL > scoreR;
    const isWinnerR = hasScore && scoreR > scoreL;

    return (
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 transition-all hover:shadow-md text-left">
        <div className="flex justify-between items-center mb-2.5 border-b border-gray-50 pb-2">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
            {customLabel || matchId.toUpperCase()}
          </span>
          <div className="flex gap-1.5">
            {meta.time && (
              <span className="text-[8px] font-black text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                {meta.time}
              </span>
            )}
            {meta.court && (
              <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                C.{meta.court}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span
              className={`text-xs uppercase font-bold truncate pr-4 ${
                isWinnerL ? "text-[#0a1628] font-black" : "text-gray-500"
              }`}
            >
              {left || "TBD"}
            </span>
            <span
              className={`text-xs font-black ${
                isWinnerL ? "text-green-600 font-extrabold" : "text-gray-400"
              }`}
            >
              {hasScore ? scoreL : "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span
              className={`text-xs uppercase font-bold truncate pr-4 ${
                isWinnerR ? "text-[#0a1628] font-black" : "text-gray-500"
              }`}
            >
              {right || "TBD"}
            </span>
            <span
              className={`text-xs font-black ${
                isWinnerR ? "text-green-600 font-extrabold" : "text-gray-400"
              }`}
            >
              {hasScore ? scoreR : "-"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderGoldSilverFinals = () => {
    if (!bracketConfig) return null;
    const isGroups = bracketConfig?.subPhaseType === "groups";

    return (
      <div className="space-y-8">
        {/* GOLD CATEGORY */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <span className="text-lg">🏆</span>
            <h3 className="text-xs font-black uppercase text-yellow-600 tracking-wider">
              Fasi Finali GOLD
            </h3>
          </div>

          {isGroups ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {renderBracketMatch("gold-s1", "Semifinale 1")}
                {renderBracketMatch("gold-s2", "Semifinale 2")}
                {renderBracketMatch("gold-f3", "Finale 3°/4°")}
                {renderBracketMatch("gold-f1", "Finale 1°/2°")}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {bracketConfig?.bracketSize === 8 && (
                <div className="space-y-3">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block pl-1">
                    Quarti di finale
                  </span>
                  {renderBracketMatch("gold-q1", "Quarto 1")}
                  {renderBracketMatch("gold-q2", "Quarto 2")}
                  {renderBracketMatch("gold-q3", "Quarto 3")}
                  {renderBracketMatch("gold-q4", "Quarto 4")}
                </div>
              )}
              <div className="space-y-3">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block pl-1">
                  Semifinali e Finali
                </span>
                {renderBracketMatch("gold-s1", "Semifinale 1")}
                {renderBracketMatch("gold-s2", "Semifinale 2")}
                {renderBracketMatch("gold-f3", "Finale 3°/4°")}
                {renderBracketMatch("gold-f1", "Finale 1°/2°")}
              </div>
            </div>
          )}
        </div>

        {/* SILVER CATEGORY */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <span className="text-lg">🥈</span>
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">
              Fasi Finali SILVER
            </h3>
          </div>

          {isGroups ? (
            <div className="space-y-3">
              {renderBracketMatch("silver-s1", "Semifinale 1")}
              {renderBracketMatch("silver-s2", "Semifinale 2")}
              {renderBracketMatch("silver-f3", "Finale 3°/4°")}
              {renderBracketMatch("silver-f1", "Finale 1°/2°")}
            </div>
          ) : (
            <div className="space-y-4">
              {bracketConfig?.bracketSize === 8 && (
                <div className="space-y-3">
                  {renderBracketMatch("silver-q1", "Quarto 1")}
                  {renderBracketMatch("silver-q2", "Quarto 2")}
                  {renderBracketMatch("silver-q3", "Quarto 3")}
                  {renderBracketMatch("silver-q4", "Quarto 4")}
                </div>
              )}
              <div className="space-y-3">
                {renderBracketMatch("silver-s1", "Semifinale 1")}
                {renderBracketMatch("silver-s2", "Semifinale 2")}
                {renderBracketMatch("silver-f3", "Finale 3°/4°")}
                {renderBracketMatch("silver-f1", "Finale 1°/2°")}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDoubleEliminationFinals = () => {
    if (!bracketConfig) return null;
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 border-b pb-2 mb-4">
            <span className="text-lg">🏆</span>
            <h3 className="text-xs font-black uppercase text-blue-600 tracking-wider">
              Winners Bracket
            </h3>
          </div>
          <div className="space-y-3">
            {bracketConfig?.bracketSize === 8 && (
              <>
                {renderBracketMatch("wb-q1", "Quarto 1")}
                {renderBracketMatch("wb-q2", "Quarto 2")}
                {renderBracketMatch("wb-q3", "Quarto 3")}
                {renderBracketMatch("wb-q4", "Quarto 4")}
              </>
            )}
            {renderBracketMatch("wb-s1", "Semifinale 1")}
            {renderBracketMatch("wb-s2", "Semifinale 2")}
            {renderBracketMatch("wb-f", "Finale Vincenti")}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 border-b pb-2 mb-4">
            <span className="text-lg">🔄</span>
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">
              Losers Bracket
            </h3>
          </div>
          <div className="space-y-3">
            {renderBracketMatch("lb-s1", "Semifinale Perdenti 1")}
            {renderBracketMatch("lb-s2", "Semifinale Perdenti 2")}
            {renderBracketMatch("lb-f", "Finale Perdenti")}
          </div>
        </div>

        <div className="bg-[#0a1628] p-5 rounded-[1.8rem] text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full -mr-12 -mt-12"></div>
          <h3 className="text-xs font-black text-[#FFD700] uppercase mb-3 text-center tracking-wider">
            GRAND FINAL 👑
          </h3>
          {renderBracketMatch("grand-final", "Finalissima")}
        </div>
      </div>
    );
  };

  const schedule = config
    ? getSchedule(config.teamCounts[activeGirone], activeGirone, config.gironeAssignments[activeGirone] || {})
    : [];
  const bracketMatches = getAllBracketMatches();
  const matchMetadata = config?.matchMetadata || {};

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Caricamento...
          </p>
        </div>
      </div>
    );
  }

  const isPublished = config && config.pubblicato;

  return (
    <main className="min-h-screen bg-[#f0f4ff] pb-10">
      {/* Header Mobile Premium */}
      <header
        style={{ backgroundColor: "#0a1628" }}
        className="text-white py-4 px-5 flex justify-between items-center shadow-lg border-b-4 border-[#FFD700] sticky top-0 z-50"
      >
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="BVI Logo" width={32} height={32} />
          <div>
            <h1 className="text-sm font-black tracking-tight uppercase leading-none">BVI Live</h1>
            <p className="text-[7px] text-[#FFD700] font-black uppercase tracking-[0.2em] mt-0.5">
              Smartphone Portal
            </p>
          </div>
        </div>
        <a
          href="/"
          className="text-[10px] font-black bg-[#FFD700] text-[#0a1628] px-4 py-1.5 rounded-xl transition-transform active:scale-95 shadow-sm uppercase tracking-wider"
        >
          Home
        </a>
      </header>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-4">
        {/* Torneo Info Title Card */}
        <div className="relative bg-white rounded-3xl p-5 border border-gray-100 shadow-sm overflow-hidden text-center">
          {isConcluso ? (
            <span className="inline-block px-3 py-1 rounded-full text-[8px] font-black bg-gray-100 text-gray-600 uppercase tracking-widest mb-2">
              Concluso 🏁
            </span>
          ) : (
            <span className="inline-block px-3 py-1 rounded-full text-[8px] font-black bg-green-100 text-green-700 uppercase tracking-widest mb-2 animate-pulse">
              Torneo Attivo 🟢
            </span>
          )}
          <h2 className="text-2xl font-black text-[#0a1628] uppercase tracking-tighter leading-tight">
            {selectedTorneo || "Nessun Torneo"}
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1.5">
            {selectedTorneoObj?.categoria} · {selectedTorneoObj?.data}
          </p>

          {/* Selector per altri tornei */}
          {tornei.length > 1 && (
            <div className="mt-4 pt-4 border-t border-gray-100 relative">
              <select
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 font-black text-[#0a1628] text-xs focus:ring-2 focus:ring-[#0a1628] appearance-none cursor-pointer"
                value={selectedTorneo}
                onChange={(e) => setSelectedTorneo(e.target.value)}
              >
                {tornei.map((t) => (
                  <option key={t.id} value={t.nome}>
                    Cambia: {t.nome}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-0.5 pointer-events-none text-[#0a1628]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={4}
                  stroke="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Controllo Pubblicazione */}
        {isPublished ? (
          <>
            {/* Tabs per smartphone */}
            {bracketConfig && (
              <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                <button
                  onClick={() => setActiveTab("iniziali")}
                  className={`flex-1 py-3 text-center rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${
                    activeTab === "iniziali"
                      ? "bg-[#0a1628] text-white shadow-md"
                      : "text-gray-400 hover:text-[#0a1628]"
                  }`}
                >
                  Gironi
                </button>
                {bracketConfig?.phaseType === "gold_silver" &&
                  bracketConfig?.subPhaseType === "groups" && (
                    <button
                      onClick={() => setActiveTab("intermedi")}
                      className={`flex-1 py-3 text-center rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${
                        activeTab === "intermedi"
                          ? "bg-[#0a1628] text-white shadow-md"
                          : "text-gray-400 hover:text-[#0a1628]"
                      }`}
                    >
                      Intermedi
                    </button>
                  )}
                <button
                  onClick={() => setActiveTab("finali")}
                  className={`flex-1 py-3 text-center rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${
                    activeTab === "finali"
                      ? "bg-[#0a1628] text-white shadow-md"
                      : "text-gray-400 hover:text-[#0a1628]"
                  }`}
                >
                  Playoff
                </button>
              </div>
            )}

            {/* Visualizzazione Gironi Iniziali */}
            {activeTab === "iniziali" && (
              <div className="space-y-4">
                {/* Gironi Selector Tabs */}
                {gironiDisponibili.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar justify-start">
                    {gironiDisponibili.map((g) => (
                      <button
                        key={g}
                        onClick={() => setActiveGirone(g)}
                        className={`px-5 py-2.5 rounded-xl font-black transition-all text-xs shrink-0 ${
                          activeGirone === g
                            ? "bg-[#0a1628] text-white shadow-md"
                            : "bg-white text-gray-400 hover:bg-gray-50 border border-gray-100"
                        }`}
                      >
                        GIRONE {g}
                      </button>
                    ))}
                  </div>
                )}

                {/* Classifica Girone */}
                <div className="space-y-2">
                  <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">
                    Classifica Girone {activeGirone}
                  </h3>
                  <div className="space-y-2.5">
                    {calculateRanking().map((team, idx) => {
                      const quotient =
                        team.puntiSubiti === 0
                          ? team.puntiFatti
                          : (team.puntiFatti / team.puntiSubiti).toFixed(3);
                      const isQualified = idx < 2;

                      return (
                        <div
                          key={team.nome}
                          className={`bg-white rounded-3xl p-4.5 shadow-sm border border-gray-100 flex items-center justify-between ${
                            isQualified ? "border-l-4 border-l-yellow-400" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span
                              className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                isQualified
                                  ? "bg-yellow-400 text-white shadow-sm"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-black text-[#0a1628] text-xs uppercase tracking-tight truncate">
                                {team.nome}
                              </p>
                              <p className="text-[9px] text-gray-400 font-semibold mt-0.5">
                                G: {team.giocate} | V/P: {team.vinte}/{team.perse} | Quoz:{" "}
                                {quotient}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-black text-[#0a1628] leading-none">
                              {team.score}
                            </p>
                            <p className="text-[7px] font-black text-gray-300 uppercase mt-0.5">
                              Punti
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Partite Girone */}
                <div className="space-y-3.5">
                  <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">
                    Incontri e Risultati
                  </h3>
                  {schedule.length > 0 ? (
                    schedule.map((match, idx) => {
                      const meta = matchMetadata[`${activeGirone}-${idx}`] || {};
                      const hasScore = meta.s1L || meta.s1R;

                      const s1L = parseInt(meta.s1L || 0);
                      const s1R = parseInt(meta.s1R || 0);
                      const s2L = parseInt(meta.s2L || 0);
                      const s2R = parseInt(meta.s2R || 0);
                      const s3L = parseInt(meta.s3L || 0);
                      const s3R = parseInt(meta.s3R || 0);

                      let isWinnerL = false;
                      let isWinnerR = false;
                      if (hasScore) {
                        if (config.gironeSets?.[activeGirone] === "3 set") {
                          let winL = 0,
                            winR = 0;
                          if (s1L > s1R) winL++;
                          else if (s1R > s1L) winR++;
                          if (s2L > s2R) winL++;
                          else if (s2R > s2L) winR++;
                          if (s3L > s3R) winL++;
                          else if (s3R > s3L) winR++;
                          isWinnerL = winL > winR;
                          isWinnerR = winR > winL;
                        } else {
                          isWinnerL = s1L > s1R;
                          isWinnerR = s1R > s1L;
                        }
                      }

                      return (
                        <div key={idx} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                          <div className="flex justify-between items-center mb-2.5 border-b border-gray-50 pb-2">
                            <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">
                              Gara {idx + 1}
                            </span>
                            <div className="flex gap-1">
                              {meta.time && (
                                <span className="text-[8px] font-black text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                                  {meta.time}
                                </span>
                              )}
                              {meta.court && (
                                <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                  C.{meta.court}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span
                                className={`text-xs uppercase font-bold truncate pr-4 ${
                                  isWinnerL ? "text-[#0a1628] font-black" : "text-gray-500"
                                }`}
                              >
                                {match.left}
                              </span>
                              <div className="flex items-center gap-1">
                                <span
                                  className={`text-xs font-black ${
                                    isWinnerL ? "text-green-600 font-extrabold" : "text-gray-400"
                                  }`}
                                >
                                  {hasScore ? s1L : "-"}
                                </span>
                                {config.gironeSets?.[activeGirone] === "3 set" && hasScore && (
                                  <span className="text-[8px] text-gray-400 font-semibold bg-gray-50 px-1 rounded">
                                    ({s2L}, {s3L})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span
                                className={`text-xs uppercase font-bold truncate pr-4 ${
                                  isWinnerR ? "text-[#0a1628] font-black" : "text-gray-500"
                                }`}
                              >
                                {match.right}
                              </span>
                              <div className="flex items-center gap-1">
                                <span
                                  className={`text-xs font-black ${
                                    isWinnerR ? "text-green-600 font-extrabold" : "text-gray-400"
                                  }`}
                                >
                                  {hasScore ? s1R : "-"}
                                </span>
                                {config.gironeSets?.[activeGirone] === "3 set" && hasScore && (
                                  <span className="text-[8px] text-gray-400 font-semibold bg-gray-50 px-1 rounded">
                                    ({s2R}, {s3R})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-white rounded-3xl p-6 text-center border border-gray-100">
                      <p className="text-gray-400 italic text-xs">Nessun match schedulato.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gironi Intermedi */}
            {activeTab === "intermedi" &&
              bracketConfig?.phaseType === "gold_silver" &&
              bracketConfig?.subPhaseType === "groups" && (
                <div className="space-y-6 text-left">
                  {renderIntermediateGroupForSpectator("gold-A", "Girone Gold A", "gold")}
                  {config?.numGironi === 4 &&
                    renderIntermediateGroupForSpectator("gold-B", "Girone Gold B", "gold")}
                  <div className="border-b border-dashed border-gray-200 my-4" />
                  {renderIntermediateGroupForSpectator("silver-A", "Girone Silver A", "silver")}
                  {config?.numGironi === 4 &&
                    renderIntermediateGroupForSpectator("silver-B", "Girone Silver B", "silver")}
                </div>
              )}

            {/* Fasi Finali Tabellone */}
            {activeTab === "finali" && bracketConfig && (
              <div className="space-y-6">
                {bracketConfig.phaseType === "gold_silver"
                  ? renderGoldSilverFinals()
                  : renderDoubleEliminationFinals()}
              </div>
            )}
          </>
        ) : (
          /* Messaggio Gironi non Pubblicati */
          <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-gray-100 px-6">
            <span className="text-5xl mb-4 block">⏳</span>
            <h3 className="text-lg font-black text-[#0a1628] uppercase tracking-tight mb-2">
              Calendario in Elaborazione
            </h3>
            <p className="text-gray-400 font-medium text-xs max-w-xs mx-auto">
              Lo staff sta configurando i gironi e le partite per il torneo. I dati saranno visibili in tempo reale su questa pagina non appena verranno pubblicati!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
