// ============================================================
// BASKET STEPH - ENGINE UNIFICATO GIRONI & PLAYOFF (app.js)
// ============================================================

let portalConfig = { tournaments: [] };
let activeTournament = null;
let matchesData = [];
let teamsData = [];
let playersData = [];

const GRADE_VALUES = {
  "A+": 99, "A": 92, "A-": 87,
  "B+": 82, "B": 77, "B-": 72,
  "C+": 67, "C": 62, "C-": 55
};

const ROLE_WEIGHTS = {
  PG: { tir: 0.25, pas: 0.30, dri: 0.25, dif: 0.10, rim: 0.05, fis: 0.05 },
  SG: { tir: 0.35, pas: 0.15, dri: 0.25, dif: 0.15, rim: 0.05, fis: 0.05 },
  SF: { tir: 0.25, pas: 0.15, dri: 0.20, dif: 0.15, rim: 0.15, fis: 0.10 },
  PF: { tir: 0.15, pas: 0.10, dri: 0.10, dif: 0.25, rim: 0.25, fis: 0.15 },
  C:  { tir: 0.10, pas: 0.05, dri: 0.05, dif: 0.25, rim: 0.35, fis: 0.20 }
};

const STAT_LABELS_BASKET = [
  { id: "tir", label: "TIR" }, { id: "pas", label: "PAS" },
  { id: "dri", label: "DRI" }, { id: "dif", label: "DIF" },
  { id: "rim", label: "RIM" }, { id: "fis", label: "FIS" }
];

async function fetchFirstAvailable(paths) {
  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (res.ok) return await res.json();
    } catch (_) {}
  }
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [tourConfig, matches, teams, players] = await Promise.all([
      fetchFirstAvailable(["data/tournaments.json", "data/scheduled.json"]),
      fetchFirstAvailable(["data/match.json", "data/matches.json"]),
      fetchFirstAvailable(["data/teams.json", "data/squadre.json"]),
      fetchFirstAvailable(["data/player.json", "data/players.json"])
    ]);

    portalConfig = tourConfig || { tournaments: [] };
    matchesData = Array.isArray(matches) ? matches : [];
    teamsData = Array.isArray(teams) ? teams : [];
    playersData = Array.isArray(players) ? players : [];

    // Fallback se tournaments.json non ha l'array
    if (!portalConfig.tournaments || portalConfig.tournaments.length === 0) {
      portalConfig.tournaments = [{
        id: portalConfig.tournamentId || "default",
        name: portalConfig.tournamentName || "TORNEO",
        type: portalConfig.stages ? "knockout" : "round_robin",
        rounds: portalConfig.rounds || [],
        stages: portalConfig.stages || []
      }];
    }

    const defaultId = portalConfig.activeTournamentId || portalConfig.tournaments[0].id;
    initTournamentSwitcher(defaultId);

    document.getElementById("loading-state").style.display = "none";
  } catch (err) {
    console.error("Errore caricamento:", err);
    document.getElementById("loading-state").innerHTML = `<p style="color:#EF4444; font-weight:bold;">Errore caricamento dati data/.</p>`;
  }
});

// ============================================================
// SWITCHER GIRONI / PLAYOFF A ZERO LAG
// ============================================================
function initTournamentSwitcher(selectedId) {
  const container = document.getElementById("tournament-switcher");
  container.innerHTML = "";

  portalConfig.tournaments.forEach(t => {
    const btn = document.createElement("button");
    btn.className = `switch-pill ${t.id === selectedId ? "active" : ""}`;
    btn.innerText = t.name;
    btn.onclick = () => switchTournament(t.id);
    container.appendChild(btn);
  });

  switchTournament(selectedId);
}

function switchTournament(tId) {
  activeTournament = portalConfig.tournaments.find(x => x.id === tId) || portalConfig.tournaments[0];

  document.querySelectorAll(".switch-pill").forEach(p => {
    p.classList.toggle("active", p.innerText === activeTournament.name);
  });

  // document.getElementById("tournament-title").innerText = activeTournament.name;

  // Ricostruisce le schede in base alla modalità (Gironi o Knockout)
  setupNavigationTabs(activeTournament.type === "knockout");
  renderTournamentContent();
}

function setupNavigationTabs(isKnockout) {
  const nav = document.getElementById("sub-tabs-nav");
  nav.innerHTML = isKnockout ? `
    <button class="tab-pill active" data-tab="tabellone">TABELLONE</button>
    <button class="tab-pill" data-tab="marcatori">STATS</button>
    <button class="tab-pill" data-tab="squadre">SQUADRE</button>
  ` : `
    <button class="tab-pill active" data-tab="classifica">CLASSIFICA</button>
    <button class="tab-pill" data-tab="partite">CALENDARIO</button>
    <button class="tab-pill" data-tab="marcatori">STATS</button>
    <button class="tab-pill" data-tab="squadre">SQUADRE</button>
  `;

  const pills = nav.querySelectorAll(".tab-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const target = pill.getAttribute("data-tab");
      document.querySelectorAll(".tab-section").forEach(sec => {
        sec.style.display = sec.id === `tab-${target}` ? "block" : "none";
      });
    });
  });

  // Mostra la prima tab
  document.querySelectorAll(".tab-section").forEach(sec => sec.style.display = "none");
  const firstTab = isKnockout ? "tab-tabellone" : "tab-classifica";
  document.getElementById(firstTab).style.display = "block";
}

function renderTournamentContent() {
  if (activeTournament.type === "knockout") {
    renderKnockoutBracket();
  } else {
    renderLeagueTable();
    renderMatchesAndSchedule();
  }
  renderScorers();
  renderTeams();
}

// Helper filtri
function getActiveMatches() {
  return matchesData.filter(m => m.tournamentId && String(m.tournamentId).trim() === activeTournament.id);
}

function getActiveTeams() {
  if (activeTournament.teamIds && activeTournament.teamIds.length > 0) {
    return teamsData.filter(t => activeTournament.teamIds.includes(t.id));
  }
  return teamsData;
}

function getPlayerFromDb(playerId, fallbackName = "Giocatore") {
  const found = playersData.find(p => String(p.id) === String(playerId));
  if (found) return found;
  return { id: String(playerId || ""), name: fallbackName, role: "SF", stats: {} };
}

function computeOVR(player) {
  if (!player || !player.stats || Object.keys(player.stats).length === 0) return 70;
  const role = player.role || "SF";
  const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.SF;
  let sum = 0, totalWeight = 0;
  for (const [statKey, weight] of Object.entries(weights)) {
    const grade = player.stats[statKey] || "B";
    sum += (GRADE_VALUES[grade] || 75) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.round(sum / totalWeight) : 70;
}

function getTierInfo(ovr) {
  if (ovr >= 80) return { cls: "tier-gold", label: "GOLD", emoji: "🥇" };
  if (ovr >= 70) return { cls: "tier-silver", label: "SILVER", emoji: "🥈" };
  return { cls: "tier-bronze", label: "BRONZE", emoji: "🥉" };
}

function colorValToHex(colorValue) {
  if (!colorValue) return "#F97316";
  let hex = Number(colorValue).toString(16).toUpperCase();
  if (hex.length > 6) hex = hex.substring(hex.length - 6);
  return `#${hex.padStart(6, "0")}`;
}

function findTeamColorHex(teamName, fallbackColorValue) {
  const t = teamsData.find(x => x.name.trim().toLowerCase() === String(teamName).trim().toLowerCase());
  if (t && t.colorValue) return colorValToHex(t.colorValue);
  if (fallbackColorValue) return colorValToHex(fallbackColorValue);
  return "#F97316";
}

function getTeamColorDot(teamName, fallbackColorValue, isTbd = false) {
  if (isTbd) return "🏀";
  const str = String(teamName || "").toLowerCase();
  if (!teamName || str.includes("vincente") || str.includes("perdente") || str === "tbd") return "🏀";
  const hex = findTeamColorHex(teamName, fallbackColorValue).toUpperCase();
  if (hex === "#EAB308") return "🟡";
  if (hex === "#EF4444") return "🔴";
  if (hex === "#3B82F6") return "🔵";
  if (hex === "#F8FAFC") return "⚪";
  if (hex === "#8B5CF6") return "🟣";
  if (hex === "#10B981") return "🟢";
  if (hex === "#F97316") return "🟠";
  if (hex === "#1E293B") return "⚫";
  return `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${hex}; vertical-align:middle;"></span>`;
}

// Calcolo Pagelle Basket Flashscore-style
function calculateMatchRatings(m) {
  const ratings = {};
  const hWon = m.homeScore > m.awayScore;
  const aWon = m.awayScore > m.homeScore;

  let maxScore = 0.0;
  let currentMvp = null;
  let isDrawMvp = false;

  ["home", "away"].forEach(team => {
    const teamWon = team === "home" ? hWon : aWon;
    const teamLost = team === "home" ? aWon : hWon;
    const list = team === "home" ? (m.homeRoster || []) : (m.awayRoster || []);

    list.forEach(p => {
      const playerId = String(p.dbId);
      let pts1 = 0, pts2 = 0, pts3 = 0, assists = 0, rebounds = 0, goodPlays = 0, fouls = 0, turnovers = 0;

      (m.events || []).forEach(e => {
        if (String(e.playerId) === playerId) {
          if (e.type === "SCORE_1PT") pts1++;
          if (e.type === "SCORE_2PT") pts2++;
          if (e.type === "SCORE_3PT") pts3++;
          if (e.type === "FOUL") fouls++;
          if (e.type === "REBOUND") rebounds++;
          if (e.type === "GOOD_PLAY") goodPlays++;
          if (e.type === "TURNOVER") turnovers++;
        }
        if (e.sub && e.sub.includes(`Assist: #${p.num} ${p.name}`)) assists++;
      });

      const totalPoints = (pts3 * 3) + (pts2 * 2) + pts1;
      const hasAction = (totalPoints > 0 || assists > 0 || rebounds > 0 || goodPlays > 0);
      const playedEnough = (p.playedSeconds || 0) >= 180;

      if (!hasAction && !playedEnough) {
        ratings[playerId] = "SV";
        return;
      }

      let score = 6.0;
      if (teamWon) score += 0.2;
      else if (teamLost) score -= 0.1;

      score += (pts3 * 0.5);
      score += (pts2 * 0.3);
      score += (pts1 * 0.1);
      score += (assists * 0.2);
      score += (rebounds * 0.2);
      score += (goodPlays * 0.1);
      score -= (turnovers * 0.2);
      score -= (fouls * 0.4);

      score = Math.min(9.9, Math.max(1.0, score));
      ratings[playerId] = Number(score.toFixed(1));

      const pData = { id: playerId, numScore: score, isWinner: teamWon, totalPoints, assists };
      if (score > maxScore) {
        maxScore = score; currentMvp = pData; isDrawMvp = false;
      } else if (score === maxScore && currentMvp !== null) {
        if (pData.isWinner && !currentMvp.isWinner) {
          currentMvp = pData; isDrawMvp = false;
        } else if (pData.isWinner === currentMvp.isWinner) {
          if (pData.totalPoints > currentMvp.totalPoints) {
            currentMvp = pData; isDrawMvp = false;
          } else if (pData.totalPoints === currentMvp.totalPoints && pData.assists > currentMvp.assists) {
            currentMvp = pData; isDrawMvp = false;
          } else {
            isDrawMvp = true;
          }
        }
      }
    });
  });

  return { ratings, mvpId: (currentMvp && !isDrawMvp) ? currentMvp.id : null };
}

// 1. CLASSIFICA GIRONI
function renderLeagueTable() {
  const tbody = document.getElementById("league-table-body");
  tbody.innerHTML = "";

  const tourMatches = getActiveMatches();
  const activeTeams = getActiveTeams();
  const stats = {};

  activeTeams.forEach(t => {
    stats[t.name] = { name: t.name, colorValue: t.colorValue, pt: 0, g: 0, v: 0, p: 0, pf: 0, ps: 0, dc: 0 };
  });

  tourMatches.forEach(m => {
    if (!stats[m.homeName]) stats[m.homeName] = { name: m.homeName, colorValue: m.homeColorValue, pt: 0, g: 0, v: 0, p: 0, pf: 0, ps: 0, dc: 0 };
    if (!stats[m.awayName]) stats[m.awayName] = { name: m.awayName, colorValue: m.awayColorValue, pt: 0, g: 0, v: 0, p: 0, pf: 0, ps: 0, dc: 0 };

    const h = stats[m.homeName];
    const a = stats[m.awayName];
    h.g++; a.g++;
    h.pf += m.homeScore; h.ps += m.awayScore;
    a.pf += m.awayScore; a.ps += m.homeScore;

    if (m.homeScore > m.awayScore) {
      h.v++; h.pt += 2; a.p++;
    } else {
      a.v++; a.pt += 2; h.p++;
    }
  });

  Object.values(stats).forEach(s => { s.dc = s.pf - s.ps; });

  const sorted = Object.values(stats).sort((a, b) => {
    if (b.pt !== a.pt) return b.pt - a.pt;
    // Scontro Diretto
    const h2h = tourMatches.filter(m => (m.homeName === a.name && m.awayName === b.name) || (m.homeName === b.name && m.awayName === a.name));
    let ptsA = 0, ptsB = 0;
    h2h.forEach(m => {
      if (m.homeName === a.name) {
        if (m.homeScore > m.awayScore) ptsA += 2; else ptsB += 2;
      } else {
        if (m.homeScore > m.awayScore) ptsB += 2; else ptsA += 2;
      }
    });
    if (ptsB !== ptsA) return ptsB - ptsA;
    if (b.dc !== a.dc) return b.dc - a.dc;
    return b.pf - a.pf;
  });

  sorted.forEach((row, idx) => {
    const hex = findTeamColorHex(row.name, row.colorValue);
    const dcColor = row.dc > 0 ? "#10B981" : (row.dc < 0 ? "#EF4444" : "#94A3B8");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-pos">${idx + 1}</td>
      <td class="col-team">
        <div class="team-cell">
          <span class="color-bar" style="background:${hex};"></span>
          <span>${row.name}</span>
        </div>
      </td>
      <td class="col-pt">${row.pt}</td>
      <td>${row.g}</td>
      <td>${row.v}</td>
      <td>${row.p}</td>
      <td>${row.pf}</td>
      <td>${row.ps}</td>
      <td style="color:${dcColor}; font-weight:700;">${row.dc > 0 ? `+${row.dc}` : row.dc}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 2. CALENDARIO GIRONI
function renderMatchesAndSchedule() {
  const container = document.getElementById("matches-container");
  container.innerHTML = "";

  const playedPool = [...getActiveMatches()];
  const rounds = activeTournament.rounds || [];

  rounds.forEach(round => {
    const roundBlock = document.createElement("div");
    roundBlock.className = "round-block";
    roundBlock.innerHTML = `<div class="round-header"><span class="round-badge">📅 ${round.roundName}</span></div>`;

    (round.matches || []).forEach(sched => {
      const matchIdx = playedPool.findIndex(m =>
        m.homeName.trim().toLowerCase() === sched.homeName.trim().toLowerCase() &&
        m.awayName.trim().toLowerCase() === sched.awayName.trim().toLowerCase()
      );

      let matchObj = null;
      if (matchIdx !== -1) {
        matchObj = playedPool[matchIdx];
        playedPool.splice(matchIdx, 1);
      }
      roundBlock.appendChild(buildMatchCard(sched, matchObj));
    });
    container.appendChild(roundBlock);
  });
}

function buildMatchCard(sched, matchObj) {
  const isPlayed = matchObj !== null;
  const homeName = isPlayed ? matchObj.homeName : sched.homeName;
  const awayName = isPlayed ? matchObj.awayName : sched.awayName;
  const homeDot = getTeamColorDot(homeName, isPlayed ? matchObj.homeColorValue : null);
  const awayDot = getTeamColorDot(awayName, isPlayed ? matchObj.awayColorValue : null);

  const card = document.createElement("div");
  card.className = "match-card";

  if (isPlayed) {
    card.innerHTML = `
      <div class="match-meta-row">
        <span>🗓️ ${matchObj.date || ""}</span>
        <span class="status-pill status-played">FINALE</span>
      </div>
      <div class="match-score-row">
        <div class="match-team-home">${homeName} ${homeDot}</div>
        <div class="match-center-score"><span class="score-text">${matchObj.homeScore} - ${matchObj.awayScore}</span></div>
        <div class="match-team-away">${awayDot} ${awayName}</div>
      </div>
    `;
    card.onclick = () => openPlayedMatchModal(matchObj, sched);
  } else {
    card.innerHTML = `
      <div class="match-meta-row">
        <span>🕒 ${sched.scheduledDate || "Data da definire"}</span>
        <span class="status-pill status-scheduled">DA GIOCARE</span>
      </div>
      <div class="match-score-row">
        <div class="match-team-home">${homeName} ${homeDot}</div>
        <div class="match-center-score"><span class="score-dash">- : -</span></div>
        <div class="match-team-away">${awayDot} ${awayName}</div>
      </div>
      ${sched.locationName ? `<div class="match-location-sub">📍 ${sched.locationName}</div>` : ""}
    `;
    card.onclick = () => openScheduledMatchModal(sched);
  }
  return card;
}

// 3. TABELLONE PLAYOFF CON AUTO-AVANZAMENTO
function renderKnockoutBracket() {
  const container = document.getElementById("bracket-container");
  const champContainer = document.getElementById("champion-banner-container");
  container.innerHTML = "";
  champContainer.innerHTML = "";

  const playedPool = [...getActiveMatches()];
  const resolvedNodes = {};
  let champion = null;

  (activeTournament.stages || []).forEach(stage => {
    const rawTitle = stage.stageName || "";
    const isFinal = stage.isFinal === true;
    const isSemi = stage.isSemi === true;
    const isThird = stage.isThirdPlace === true;

    let badgeClass = isFinal ? "final-badge" : (isSemi ? "semi-badge" : (isThird ? "third-badge" : ""));
    let icon = isFinal ? "🏆" : (isSemi ? "🛡️" : "🎭");

    const roundBlock = document.createElement("div");
    roundBlock.className = "round-block";
    roundBlock.innerHTML = `<div class="round-header"><span class="round-badge ${badgeClass}">${icon} ${rawTitle}</span></div>`;

    (stage.matches || []).forEach((slot, idx) => {
      const code = slot.matchCode || `M_${idx}`;
      let homeName = slot.homeName || null;
      let awayName = slot.awayName || null;

      if (!homeName && slot.homeFromWinner && resolvedNodes[slot.homeFromWinner]) homeName = resolvedNodes[slot.homeFromWinner].winner;
      if (!homeName && slot.homeFromLoser && resolvedNodes[slot.homeFromLoser]) homeName = resolvedNodes[slot.homeFromLoser].loser;

      if (!awayName && slot.awayFromWinner && resolvedNodes[slot.awayFromWinner]) awayName = resolvedNodes[slot.awayFromWinner].winner;
      if (!awayName && slot.awayFromLoser && resolvedNodes[slot.awayFromLoser]) awayName = resolvedNodes[slot.awayFromLoser].loser;

      let matchObj = null;
      if (homeName && awayName) {
        const hN = homeName.trim().toLowerCase();
        const aN = awayName.trim().toLowerCase();
        const fIdx = playedPool.findIndex(m => {
          const mH = m.homeName.trim().toLowerCase();
          const mA = m.awayName.trim().toLowerCase();
          return (mH === hN && mA === aN) || (mH === aN && mA === hN);
        });
        if (fIdx !== -1) {
          matchObj = playedPool[fIdx];
          playedPool.splice(fIdx, 1);
        }
      }

      let winner = null, loser = null, winnerSide = null;
      if (matchObj) {
        if (matchObj.homeScore > matchObj.awayScore) {
          winner = matchObj.homeName; loser = matchObj.awayName; winnerSide = "home";
        } else {
          winner = matchObj.awayName; loser = matchObj.homeName; winnerSide = "away";
        }
      }

      resolvedNodes[code] = { winner, loser };
      if (isFinal && winner) champion = winner;

      roundBlock.appendChild(buildKnockoutCard({
        slot, label: slot.label || code, isFinal, isSemi, isThird,
        homeName: homeName || (slot.homeFromWinner ? `Vincente ${slot.homeFromWinner}` : (slot.homeFromLoser ? `Perdente ${slot.homeFromLoser}` : "TBD")),
        awayName: awayName || (slot.awayFromWinner ? `Vincente ${slot.awayFromWinner}` : (slot.awayFromLoser ? `Perdente ${slot.awayFromLoser}` : "TBD")),
        isHomeTbd: !homeName, isAwayTbd: !awayName, matchObj, winnerSide
      }));
    });

    container.appendChild(roundBlock);
  });

  if (champion) {
    const dot = getTeamColorDot(champion, null);
    champContainer.innerHTML = `
      <div class="champion-banner">
        <div class="trophy-icon">🏆</div>
        <div class="champ-label">CAMPIONE BASKET STEPH</div>
        <div class="champ-team">${dot} ${champion.toUpperCase()}</div>
      </div>
    `;
  }
}

function buildKnockoutCard(info) {
  const { slot, label, isFinal, isSemi, isThird, homeName, awayName, isHomeTbd, isAwayTbd, matchObj, winnerSide } = info;
  const isPlayed = matchObj !== null;

  let extraCls = isFinal ? "final-match-card" : (isSemi ? "semi-match-card" : (isThird ? "third-match-card" : ""));
  const card = document.createElement("div");
  card.className = `match-card ${extraCls}`;

  if (isPlayed) {
    const hDot = getTeamColorDot(matchObj.homeName, matchObj.homeColorValue);
    const aDot = getTeamColorDot(matchObj.awayName, matchObj.awayColorValue);
    const crown = isFinal ? "🏆" : (isThird ? "🥉" : "👑");

    card.innerHTML = `
      <div class="match-meta-row">
        <span><strong>${label}</strong> • 🗓️ ${matchObj.date || ""}</span>
        <span class="status-pill status-played">FINALE</span>
      </div>
      <div class="match-score-row">
        <div class="match-team-home ${winnerSide === 'home' ? 'team-Qualified' : 'team-Eliminated'}">
          ${winnerSide === 'home' ? `<span class="qual-crown">${crown}</span>` : ""}
          ${matchObj.homeName} ${hDot}
        </div>
        <div class="match-center-score"><span class="score-text">${matchObj.homeScore} - ${matchObj.awayScore}</span></div>
        <div class="match-team-away ${winnerSide === 'away' ? 'team-Qualified' : 'team-Eliminated'}">
          ${aDot} ${matchObj.awayName}
          ${winnerSide === 'away' ? `<span class="qual-crown">${crown}</span>` : ""}
        </div>
      </div>
    `;
    card.onclick = () => openPlayedMatchModal(matchObj, slot);
  } else {
    card.innerHTML = `
      <div class="match-meta-row">
        <span><strong>${label}</strong> • 🕒 ${slot.scheduledDate || "Da definire"}</span>
        <span class="status-pill status-scheduled">DA GIOCARE</span>
      </div>
      <div class="match-score-row">
        <div class="match-team-home ${isHomeTbd ? 'tbd-team' : ''}">${homeName}</div>
        <div class="match-center-score"><span class="score-dash">- : -</span></div>
        <div class="match-team-away ${isAwayTbd ? 'tbd-team' : ''}">${awayName}</div>
      </div>
    `;
    card.onclick = () => openScheduledMatchModal({ ...slot, homeName, awayName });
  }
  return card;
}

// 4. STATISTICHE (LEADERBOARD)
function renderScorers() {
  const tbody = document.getElementById("scorers-table-body");
  tbody.innerHTML = "";

  const tourMatches = getActiveMatches();
  const activeTeams = getActiveTeams();
  const statsMap = {};

  const ensureEntry = (id, name, tName) => {
    if (!statsMap[id]) statsMap[id] = { id, name, team: tName, points: 0, rebounds: 0, assists: 0 };
  };

  activeTeams.forEach(team => {
    (team.roster || []).forEach(e => {
      const p = getPlayerFromDb(e.playerId);
      if (p) ensureEntry(String(p.id), p.name, team.name);
    });
  });

  tourMatches.forEach(m => {
    (m.events || []).forEach(e => {
      const tName = e.team === "home" ? m.homeName : m.awayName;
      if (e.playerId) {
        const p = getPlayerFromDb(e.playerId);
        ensureEntry(String(e.playerId), p.name, tName);
        if (e.pts > 0) statsMap[String(e.playerId)].points += e.pts;
        if (e.type === "REBOUND") statsMap[String(e.playerId)].rebounds++;
      }
      if (e.sub && e.sub.includes("Assist:")) {
        const rawA = e.sub.split("Assist:")[1].trim().replace(/^#\d+\s*/, "").split("•")[0].trim();
        const found = playersData.find(x => x.name.toLowerCase() === rawA.toLowerCase());
        if (found) {
          ensureEntry(String(found.id), found.name, tName);
          statsMap[String(found.id)].assists++;
        }
      }
    });
  });

  const sorted = Object.values(statsMap).sort((a, b) => b.points !== a.points ? b.points - a.points : (b.rebounds !== a.rebounds ? b.rebounds - a.rebounds : b.assists - a.assists));

  sorted.forEach((sc, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-pos">${idx + 1}</td>
      <td class="col-team">
        <div style="font-weight:800; color:#FFFFFF; font-size:13px;">${sc.name}</div>
        <div style="font-size:10px; color:#94A3B8;">${sc.team}</div>
      </td>
      <td class="col-pt">${sc.points}</td>
      <td class="col-rim">${sc.rebounds}</td>
      <td class="col-ass">${sc.assists}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 5. SQUADRE E SCHEDE ATLETI
function renderTeams() {
  const container = document.getElementById("teams-container");
  container.innerHTML = "";

  const activeTeams = getActiveTeams();
  const roleOrder = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

  activeTeams.forEach(team => {
    const hex = colorValToHex(team.colorValue);
    const roster = (team.roster || []).map((entry, idx) => {
      const dbP = getPlayerFromDb(entry.playerId, `Giocatore ${idx + 1}`);
      return {
        id: dbP.id,
        name: dbP.name,
        role: dbP.role || "SF",
        stats: dbP.stats || {},
        ovr: computeOVR(dbP),
        shirtNum: entry.customNum || String(idx + 1)
      };
    });

    roster.sort((a, b) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99) || b.ovr - a.ovr);
    const avgOvr = roster.length > 0 ? (roster.reduce((a, b) => a + b.ovr, 0) / roster.length).toFixed(1) : "--";

    const acc = document.createElement("div");
    acc.className = "team-accordion";
    acc.innerHTML = `
      <div class="team-acc-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="color-bar" style="background:${hex}; width:10px; height:32px; border-radius:4px;"></span>
          <div>
            <div style="font-size:15px; font-weight:900; color:#FFFFFF;">${team.name}</div>
            <div style="font-size:11px; color:#94A3B8;">${roster.length} Giocatori in rosa</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="background:#0F172A; border:1px solid #1E293B; color:#F97316; font-weight:900; font-size:12px; padding:4px 8px; border-radius:6px;">
            OVR ${avgOvr}
          </span>
          <span class="acc-arrow" style="font-size:12px; color:#94A3B8;">▼</span>
        </div>
      </div>
      <div class="team-acc-body" style="display:none;"></div>
    `;

    const body = acc.querySelector(".team-acc-body");
    roster.forEach(p => {
      const tier = getTierInfo(p.ovr);
      const row = document.createElement("div");
      row.className = "roster-row";
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="role-badge role-${p.role}">${p.role}</span>
          <span style="font-size:11px; color:#94A3B8; font-weight:800; width:26px;">#${p.shirtNum}</span>
          <span style="font-size:13px; font-weight:700; color:#FFFFFF;">${p.name}</span>
        </div>
        <span class="ovr-pill ${tier.cls}">${p.ovr}</span>
      `;
      row.onclick = () => openPlayerModal(p, team.name);
      body.appendChild(row);
    });

    acc.querySelector(".team-acc-header").onclick = () => {
      const open = body.style.display === "block";
      body.style.display = open ? "none" : "block";
      acc.querySelector(".acc-arrow").innerText = open ? "▼" : "▲";
    };

    container.appendChild(acc);
  });
}

function openScheduledMatchModal(sched) {
  document.getElementById("modal-match-meta").innerText = `PROGRAMMA PARTITA`;
  const homeName = sched.homeName || "TBD";
  const awayName = sched.awayName || "TBD";
  const homeDot = getTeamColorDot(homeName, null, !sched.homeName);
  const awayDot = getTeamColorDot(awayName, null, !sched.awayName);

  document.getElementById("modal-score-box").innerHTML = `
    <div class="match-score-row">
      <div class="match-team-home">${homeName} ${homeDot}</div>
      <div class="match-center-score"><span class="score-dash">- : -</span></div>
      <div class="match-team-away">${awayDot} ${awayName}</div>
    </div>
  `;

  let infoHtml = `
    <div style="text-align:center; padding: 20px 10px;">
      <div style="font-size: 32px; margin-bottom: 8px;">⏳</div>
      <h3 style="color: var(--orange); font-size: 16px; font-weight: 900; margin-bottom: 6px;">
        PARTITA ANCORA DA DISPUTARE
      </h3>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
        🗓️ Data: <strong>${sched.scheduledDate || "Data e orario da definire"}</strong>
      </p>
  `;

  if (sched.locationName) {
    infoHtml += `
      <div style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; margin-top: 10px;">
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">LUOGO DELLA PARTITA</div>
        <div style="font-size: 14px; font-weight: 800; color: #FFFFFF;">📍 ${sched.locationName}</div>
        ${sched.mapsUrl ? `
          <a href="${sched.mapsUrl}" target="_blank" rel="noopener noreferrer" 
             style="display: inline-block; margin-top: 10px; background: var(--orange); color: #fff; text-decoration: none; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 6px;">
            Apri su Google Maps ↗
          </a>
        ` : ''}
      </div>
    `;
  }

  infoHtml += `</div>`;

  const schedView = document.getElementById("modal-scheduled-view");
  schedView.innerHTML = infoHtml;
  schedView.style.display = "block";
  document.getElementById("modal-played-view").style.display = "none";
  document.getElementById("match-modal").style.display = "flex";
}

// Modali Partita e Atleta
function openPlayedMatchModal(m, sched) {
  document.getElementById("modal-match-meta").innerText = `TABELLINO • ${m.date || ""}`;
  const hDot = getTeamColorDot(m.homeName, m.homeColorValue);
  const aDot = getTeamColorDot(m.awayName, m.awayColorValue);

  document.getElementById("modal-score-box").innerHTML = `
    <div class="match-score-row">
      <div class="match-team-home">${m.homeName} ${hDot}</div>
      <div class="match-center-score"><span class="score-text">${m.homeScore} - ${m.awayScore}</span></div>
      <div class="match-team-away">${aDot} ${m.awayName}</div>
    </div>
  `;

  document.getElementById("modal-scheduled-view").style.display = "none";
  document.getElementById("modal-played-view").style.display = "flex";

  renderMatchCronaca(m);
  renderMatchPagelle(m);
  switchMatchModalTab("cronaca");
  document.getElementById("match-modal").style.display = "flex";
}

function switchMatchModalTab(tab) {
  document.getElementById("btn-tab-cronaca").classList.toggle("active", tab === "cronaca");
  document.getElementById("btn-tab-pagelle").classList.toggle("active", tab === "pagelle");
  document.getElementById("modal-tab-cronaca").style.display = tab === "cronaca" ? "block" : "none";
  document.getElementById("modal-tab-pagelle").style.display = tab === "pagelle" ? "block" : "none";
}

function renderMatchCronaca(m) {
  const container = document.getElementById("modal-tab-cronaca");
  container.innerHTML = "";

  const salienti = ["SCORE_1PT", "SCORE_2PT", "SCORE_3PT", "FOUL", "SUB"];
  const events = (m.events || []).filter(e => salienti.includes(e.type));

  if (events.length === 0) {
    container.innerHTML = `<p style="color:#94A3B8; text-align:center; padding:20px;">Nessuna azione saliente registrata.</p>`;
    return;
  }

  let lastPeriod = "";
  events.forEach(e => {
    let pHeader = "";
    const minUpper = String(e.minute).toUpperCase();
    if (minUpper.includes("1°OT")) pHeader = "1° OVERTIME";
    else if (minUpper.includes("2°OT")) pHeader = "2° OVERTIME";
    else if (minUpper.includes("1°Q")) pHeader = "1° QUARTO";
    else if (minUpper.includes("2°Q")) pHeader = "2° QUARTO";
    else if (minUpper.includes("3°Q")) pHeader = "3° QUARTO";
    else if (minUpper.includes("4°Q")) pHeader = "4° QUARTO";

    if (pHeader && pHeader !== lastPeriod) {
      lastPeriod = pHeader;
      container.innerHTML += `<div class="period-divider"><hr/><span>${pHeader}</span><hr/></div>`;
    }

    const cleanTime = String(e.minute || "").replace(/^(1°Q|2°Q|3°Q|4°Q|1°OT|2°OT)\s*/i, "").trim();
    const cleanSub = String(e.sub || "").replace(/Squadra:\s*[^•\n]+(•\s*)?/gi, "").trim();

    container.innerHTML += `
      <div class="event-row ${e.team === 'away' ? 'away' : 'home'}">
        <span class="minute-badge">${cleanTime}</span>
        <div style="font-size:12px;">
          <div style="font-weight:800; color:#FFFFFF;">${e.title}</div>
          ${cleanSub ? `<div style="font-size:10px; color:#94A3B8;">${cleanSub}</div>` : ""}
        </div>
      </div>
    `;
  });
}

function renderMatchPagelle(m) {
  const container = document.getElementById("modal-tab-pagelle");
  container.innerHTML = "";
  const { ratings, mvpId } = calculateMatchRatings(m);

  const buildBox = (name, roster, cVal, icon) => {
    const hex = findTeamColorHex(name, cVal);
    let sum = 0, count = 0;
    (roster || []).forEach(p => {
      const v = ratings[String(p.dbId)];
      if (typeof v === "number") { sum += v; count++; }
    });
    const avg = count > 0 ? (sum / count).toFixed(1) : "N.D.";

    let html = `
      <div style="background:#111827; border:1px solid #1E293B; border-radius:12px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #1E293B; padding-bottom:6px;">
          <span style="color:${hex}; font-weight:900;">${icon} ${name}</span>
          <span class="team-avg-badge">⭐ ${avg}</span>
        </div>
    `;

    let benchDividerAdded = false;
    const sortedRoster = [...(roster || [])].sort((a, b) => (b.inField !== false ? 1 : 0) - (a.inField !== false ? 1 : 0));

    sortedRoster.forEach((p, idx) => {
      // Se inField è false, oppure se siamo in una partita con più di 3 giocatori e siamo oltre il 3° (indice >= 3)
      const isBench = p.inField === false || (sortedRoster.length > 3 && idx >= 3 && sortedRoster.every(x => x.inField !== false));
      if (isBench && !benchDividerAdded) {
        html += `<div class="bench-divider"><span>Panchina</span></div>`;
        benchDividerAdded = true;
      }
      const v = ratings[String(p.dbId)] ?? "SV";
      const isMvp = v !== "SV" && String(p.dbId) === String(mvpId);
      let bColor = isMvp ? "#0044FF" : (v === "SV" ? "#334155" : (v >= 6.8 ? "#0A7227" : (v >= 5.8 ? "#D97706" : "#D50000")));

      html += `
        <div class="pagella-row">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="role-badge role-${p.role}">${p.role}</span>
            <span style="font-size:12px; font-weight:700;">#${p.num} ${p.name}</span>
            ${isMvp ? `<span class="mvp-tag">MVP</span>` : ""}
          </div>
          <span class="vote-badge" style="background:${bColor};">${typeof v === 'number' ? v.toFixed(1) : 'SV'}</span>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  };

  container.innerHTML = buildBox(m.homeName, m.homeRoster, m.homeColorValue, "🏠") + buildBox(m.awayName, m.awayRoster, m.awayColorValue, "🚗");
}

function openPlayerModal(player, teamName) {
  const tier = getTierInfo(player.ovr);
  const attributesHtml = STAT_LABELS_BASKET.map(def => {
    const grade = (player.stats && player.stats[def.id]) ? player.stats[def.id] : "B";
    return `
      <div class="stat-item" style="background:#1E293B; border:1px solid #334155;">
        <span style="color:#94A3B8; font-weight:700;">${def.label}</span>
        <strong style="color:#F97316; font-size:13px;">${grade}</strong>
      </div>
    `;
  }).join("");

  const tourMatches = getActiveMatches();
  let presenze = 0, points = 0, rebounds = 0, assists = 0, goodPlays = 0, fouls = 0, mvpCount = 0, sumVoti = 0, countVoti = 0;

  tourMatches.forEach(m => {
    const inMatch = [...(m.homeRoster || []), ...(m.awayRoster || [])].some(x => String(x.dbId) === String(player.id));
    if (inMatch) {
      presenze++;
      const { ratings, mvpId } = calculateMatchRatings(m);
      if (String(mvpId) === String(player.id)) mvpCount++;
      const v = ratings[String(player.id)];
      if (typeof v === "number") { sumVoti += v; countVoti++; }
    }
    (m.events || []).forEach(e => {
      if (String(e.playerId) === String(player.id)) {
        if (e.pts > 0) points += e.pts;
        if (e.type === "REBOUND") rebounds++;
        if (e.type === "GOOD_PLAY") goodPlays++;
        if (e.type === "FOUL") fouls++;
      }
      if (e.sub && e.sub.includes("Assist:") && e.sub.includes(player.name)) assists++;
    });
  });

  document.getElementById("player-card-content").innerHTML = `
    <div style="text-align:center; padding:18px; border-radius:16px; margin-bottom:14px;" class="${tier.cls}">
      <div style="font-size:11px; font-weight:900;">${tier.emoji} ${tier.label} CARD</div>
      <div style="font-size:34px; font-weight:900; margin:4px 0;">${player.ovr}</div>
      <div style="font-size:18px; font-weight:900;">#${player.shirtNum} ${player.name}</div>
      <div style="font-size:12px; opacity:0.85;">${player.role} • ${teamName}</div>
    </div>
    <div style="font-size:11px; font-weight:900; color:#94A3B8; margin-bottom:6px;">ATTRIBUTI BASKET</div>
    <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:14px;">${attributesHtml}</div>
    <div style="font-size:11px; font-weight:900; color:#94A3B8; margin-bottom:6px;">RENDIMENTO NEL TORNEO</div>
    <div class="stats-grid">
      <div class="stat-item"><span>Presenze:</span><strong style="color:#FFFFFF;">${presenze}</strong></div>
      <div class="stat-item"><span>Media Voto:</span><strong style="color:#FFFFFF;">⭐ ${countVoti > 0 ? (sumVoti / countVoti).toFixed(2) : '--'}</strong></div>
      <div class="stat-item"><span>Punti:</span><strong style="color:#FFFFFF;">🏀 ${points}</strong></div>
      <div class="stat-item"><span>Rimbalzi:</span><strong style="color:#FFFFFF;">🖐️ ${rebounds}</strong></div>
      <div class="stat-item"><span>Assist:</span><strong style="color:#FFFFFF;">🅰️ ${assists}</strong></div>
      <div class="stat-item"><span>Falli:</span><strong style="color:#FFFFFF;">⚠️ ${fouls}</strong></div>
      <div class="stat-item" style="grid-column: span 2;"><span>Premi MVP:</span><strong style="color:#F59E0B;">🏆 ${mvpCount}</strong></div>
    </div>
  `;
  document.getElementById("player-modal").style.display = "flex";
}

function openRulesModal() {
  document.getElementById("rules-modal").style.display = "flex";
}

function closeRulesModal() {
  document.getElementById("rules-modal").style.display = "none";
}

function closeMatchModal() { document.getElementById("match-modal").style.display = "none"; }
function closePlayerModal() { document.getElementById("player-modal").style.display = "none"; }
window.onclick = (e) => {
  if (e.target.id === "match-modal") closeMatchModal();
  if (e.target.id === "player-modal") closePlayerModal();
  if (e.target.id === "rules-modal") closeRulesModal();
};
