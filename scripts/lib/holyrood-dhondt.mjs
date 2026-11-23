// Scottish Parliament regional list allocation (Scotland Act 1998, s.7–8).
//
// Each region elects its list members one at a time. For every party,
// the regional vote is divided by (constituency seats already won in the
// region + list seats already allocated + 1). The highest figure takes
// the next seat. An individual regional candidate is divided by 1 and
// drops out once elected. This is the "compensatory" step: a party that
// already holds many constituency seats in the region starts with a
// larger divisor.
//
// allocateRegion returns every round with every contestant's figure,
// so the pages can show the working rather than just the answer.

/**
 * @param {{ id: string, votes: number, constituencySeats: number, individual?: boolean, listCapacity?: number }[]} contestants
 * @param {number} seats
 */
export function allocateRegion(contestants, seats) {
  const listSeats = Object.fromEntries(contestants.map((c) => [c.id, 0]));
  const rounds = [];
  for (let round = 1; round <= seats; round++) {
    const figures = contestants
      .filter((c) => c.votes > 0 && (c.individual
        ? c.constituencySeats === 0 && listSeats[c.id] === 0
        : listSeats[c.id] < (c.listCapacity ?? Infinity)))
      .map((c) => {
        const divisor = c.individual ? 1 : c.constituencySeats + listSeats[c.id] + 1;
        return {
          id: c.id,
          votes: c.votes,
          constituencySeats: c.constituencySeats,
          listSeatsBefore: listSeats[c.id],
          divisor,
          quotient: c.votes / divisor
        };
      })
      .sort((a, b) => b.votes * a.divisor - a.votes * b.divisor || a.id.localeCompare(b.id));
    if (figures.length === 0) throw new Error(`round ${round}: no contestants left`);
    const [top, next] = figures;
    if (next && top.votes * next.divisor === next.votes * top.divisor) {
      // Scotland Act s.8(7–9): add one vote and recalculate;
      // ultimately the returning officer may draw lots. No 2026 round
      // ties. Stop for source evidence rather than inventing an order.
      throw new Error(`round ${round}: tie between ${top.id} and ${next.id}`);
    }
    listSeats[top.id] += 1;
    rounds.push({ round, winner: top.id, figures });
  }
  return { rounds, listSeats };
}
