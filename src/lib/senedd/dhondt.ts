// Senedd constituency seat allocation, as written in the Government of
// Wales Act 2006 ss. 8–9 (substituted by the Senedd Cymru (Members and
// Elections) Act 2024, s. 8):
//
//   https://www.legislation.gov.uk/ukpga/2006/32/section/8
//   https://www.legislation.gov.uk/ukpga/2006/32/section/9
//
// The method is D'Hondt with four statutory details that a generic
// D'Hondt function gets wrong:
//
//   • An individual (independent) candidate's figure is their vote total,
//     never divided. Once elected they drop out: they can win one seat.
//     (s. 8(4), s. 9(4))
//   • A party whose list is exhausted drops out. (s. 9(6))
//   • Equal highest figures: every tied entrant gets a seat if that fits
//     in the seats left. (s. 9(7))
//   • If it doesn't fit, recalculate the tied entrants' figures after
//     adding one to their *votes* (not their divisor). If they're still
//     tied, the returning officer draws lots. (s. 9(8)–(9))
//
// We never invent the result of a drawing of lots. If one would be
// needed, the allocation returns `needsLots` and stops, so the importer
// can fail loudly rather than publish a guessed outcome.
//
// Pure, dependency-free and shared between the importer (run with Bun)
// and the site, so the tested code is the code that produced the data.

export interface AllocationEntrant {
  /** Stable id for the list or individual candidate. */
  id: string;
  kind: 'party' | 'individual';
  votes: number;
  /** Number of candidates on the list. Individuals are always 1. */
  listLength: number;
}

export interface AllocationQuotient {
  id: string;
  /** Divisor applied (1 for individuals and for a party's first figure). */
  divisor: number;
  /** votes ÷ divisor, unrounded. */
  figure: number;
  /** True when the entrant was excluded (list exhausted / already elected). */
  excluded: boolean;
}

export interface AllocationRound {
  seat: number;
  /** Entrant that won this seat. */
  winnerId: string;
  /** Winner's figure when the seat was awarded. */
  winningFigure: number;
  /** Divisor the winner was on when it took this seat. */
  winningDivisor: number;
  /** Every entrant's figure going into this round, highest first. */
  figures: AllocationQuotient[];
  /** Highest figure that did *not* win this round (null if no rival). */
  runnerUpId: string | null;
  runnerUpFigure: number | null;
  /** True if two or more entrants shared the highest figure. */
  tie: boolean;
  /** How a tie was settled, if there was one. */
  tieResolution: 'all-seated' | 'votes-plus-one' | null;
}

export interface AllocationResult {
  seats: number;
  rounds: AllocationRound[];
  /** Seats won per entrant id. */
  seatsWon: Record<string, number>;
  /**
   * Set when the statute would send the decision to lots. `rounds`
   * then holds only the seats that could be decided from the votes.
   */
  needsLots: { seat: number; tiedIds: string[] } | null;
  /**
   * The highest figure left once every seat is filled: who would have
   * taken one more seat. Null if every entrant is excluded.
   */
  nextInLine: { id: string; figure: number; divisor: number } | null;
}

function figureFor(e: AllocationEntrant, won: number, votesBonus = 0): number {
  const votes = e.votes + votesBonus;
  return e.kind === 'individual' ? votes : votes / (won + 1);
}

function isExcluded(e: AllocationEntrant, won: number): boolean {
  if (e.kind === 'individual') return won >= 1;
  return won >= e.listLength;
}

export function allocateSeats(
  entrants: AllocationEntrant[],
  seats: number
): AllocationResult {
  const ids = new Set<string>();
  for (const e of entrants) {
    if (ids.has(e.id)) throw new Error(`duplicate entrant id ${e.id}`);
    ids.add(e.id);
    if (!Number.isInteger(e.votes) || e.votes < 0) {
      throw new Error(`entrant ${e.id} has invalid votes ${e.votes}`);
    }
    if (e.kind === 'individual' && e.listLength !== 1) {
      throw new Error(`individual candidate ${e.id} must have listLength 1`);
    }
  }

  const seatsWon: Record<string, number> = Object.fromEntries(
    entrants.map((e) => [e.id, 0])
  );
  const rounds: AllocationRound[] = [];

  while (rounds.length < seats) {
    const seatNo = rounds.length + 1;
    const figures: AllocationQuotient[] = entrants
      .map((e) => {
        const won = seatsWon[e.id];
        return {
          id: e.id,
          divisor: e.kind === 'individual' ? 1 : won + 1,
          figure: figureFor(e, won),
          excluded: isExcluded(e, won)
        };
      })
      .sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.figure - a.figure);

    const live = figures.filter((f) => !f.excluded);
    if (live.length === 0) break; // every list exhausted; seats stay unfilled

    const top = live[0].figure;
    const tied = live.filter((f) => f.figure === top);
    const remaining = seats - rounds.length;

    let winners: AllocationQuotient[];
    let tieResolution: AllocationRound['tieResolution'] = null;

    if (tied.length === 1) {
      winners = tied;
    } else if (tied.length <= remaining) {
      // s. 9(7): each tied entrant takes a seat.
      winners = tied;
      tieResolution = 'all-seated';
    } else {
      // s. 9(8): add one to the tied entrants' votes and recalculate.
      const byId = new Map(entrants.map((e) => [e.id, e]));
      const bumped = tied
        .map((t) => ({
          ...t,
          figure: figureFor(byId.get(t.id)!, seatsWon[t.id], 1)
        }))
        .sort((a, b) => b.figure - a.figure);
      const bumpedTop = bumped[0].figure;
      const stillTied = bumped.filter((b) => b.figure === bumpedTop);
      if (stillTied.length > remaining) {
        // s. 9(9): lots. We do not simulate this.
        return {
          seats,
          rounds,
          seatsWon,
          needsLots: { seat: seatNo, tiedIds: stillTied.map((s) => s.id) },
          nextInLine: null
        };
      }
      // Adding one to the vote count multiplies every tied figure's
      // increase by 1/divisor, so the entrant on the lowest divisor
      // pulls ahead. Seat the leaders after the bump.
      winners = stillTied.map((s) => tied.find((t) => t.id === s.id)!);
      tieResolution = 'votes-plus-one';
    }

    for (const w of winners) {
      if (rounds.length >= seats) break;
      const rival = live.find((f) => !winners.some((x) => x.id === f.id)) ?? null;
      rounds.push({
        seat: rounds.length + 1,
        winnerId: w.id,
        winningFigure: w.figure,
        winningDivisor: w.divisor,
        figures,
        runnerUpId: rival?.id ?? null,
        runnerUpFigure: rival?.figure ?? null,
        tie: tied.length > 1,
        tieResolution
      });
      seatsWon[w.id] += 1;
    }
  }

  const leftover = entrants
    .filter((e) => !isExcluded(e, seatsWon[e.id]))
    .map((e) => ({
      id: e.id,
      figure: figureFor(e, seatsWon[e.id]),
      divisor: e.kind === 'individual' ? 1 : seatsWon[e.id] + 1
    }))
    .sort((a, b) => b.figure - a.figure);

  return { seats, rounds, seatsWon, needsLots: null, nextInLine: leftover[0] ?? null };
}
