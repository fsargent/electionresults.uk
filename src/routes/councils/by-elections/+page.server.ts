import { allByElections, byElectionsAfter, distinctCouncilSlugs, generatedAt } from '$lib/data';

export const prerender = true;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function load() {
  // Only counted by-elections carry vote shares. Scottish (STV) and
  // not-yet-declared polls are counted in the lede but kept out of
  // every share below.
  const counted = allByElections.filter((b) => b.status === 'result');

  const rows = counted.map((b) => {
    const winner = b.candidates.find((c) => c.elected) ?? b.candidates[0];
    const runnerUp = b.candidates.find((c) => !c.elected) ?? null;
    return {
      ballotId: b.ballotId,
      electionDate: b.electionDate,
      council: b.council,
      councilSlug: b.councilSlug,
      nation: b.nation,
      wardName: b.wardName,
      seats: b.seats,
      winnerName: winner.name,
      winnerParty: winner.party,
      winnerVotes: winner.votes ?? 0,
      runnerUpName: runnerUp?.name ?? null,
      runnerUpParty: runnerUp?.party ?? null,
      candidateCount: b.candidates.length,
      winningPct: b.winningPct ?? 0,
      quota: b.quota,
      underPar: b.underPar ?? 0,
      isBelowQuota: b.isBelowQuota ?? false,
      turnout: b.turnout,
      // Winner's votes as a share of everyone on the electoral roll.
      winnerShareOfElectorate:
        b.electorate && winner.votes != null ? winner.votes / b.electorate : null,
      // Democracy Club's source field is free text. Keep the first URL.
      resultsSource: b.resultsSource?.match(/https?:\/\/[^\s,;]+/)?.[0] ?? null
    };
  });

  // Seats won per party, and how many of those wins were below half
  // the vote.
  const byParty = new Map<string, { party: string; wins: number; belowQuota: number }>();
  for (const r of rows) {
    const cur = byParty.get(r.winnerParty) ?? { party: r.winnerParty, wins: 0, belowQuota: 0 };
    cur.wins += 1;
    if (r.isBelowQuota) cur.belowQuota += 1;
    byParty.set(r.winnerParty, cur);
  }
  const partyWins = [...byParty.values()].sort(
    (a, b) => b.wins - a.wins || a.party.localeCompare(b.party)
  );

  const dates = allByElections.map((b) => b.electionDate).sort();

  return {
    generatedAt,
    after: byElectionsAfter,
    lastDate: dates[dates.length - 1] ?? null,
    rows,
    partyWins,
    parties: partyWins.map((p) => p.party).sort(),
    councilsWithPages: distinctCouncilSlugs().map((c) => c.councilSlug),
    stats: {
      held: allByElections.length,
      counted: counted.length,
      belowQuota: rows.filter((r) => r.isBelowQuota).length,
      stv: allByElections.filter((b) => b.status === 'stv').length,
      awaiting: allByElections.filter((b) => b.status === 'awaiting').length,
      uncontested: allByElections.filter((b) => b.status === 'uncontested').length,
      wales: rows.filter((r) => r.nation === 'wales').length,
      medianTurnout: median(rows.flatMap((r) => (r.turnout == null ? [] : [r.turnout]))),
      medianWinnerShareOfElectorate: median(
        rows.flatMap((r) => (r.winnerShareOfElectorate == null ? [] : [r.winnerShareOfElectorate]))
      ),
      withElectorate: rows.filter((r) => r.winnerShareOfElectorate != null).length
    }
  };
}
