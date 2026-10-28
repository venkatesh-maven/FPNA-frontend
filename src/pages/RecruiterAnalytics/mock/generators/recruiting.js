// The recruiting organisation over the same sample company, four layers deep:
// Recruiting Director → Account Manager → Recruiter Lead → Recruiter.
// The sample's client desks become recruiters' desks (same person ids, so
// desks, job orders, plans and expenses carry over); each desk team becomes
// an Account Manager's book, split between two Recruiter Leads. Every
// requisition, contractor assignment and permanent placement is credited to
// the recruiter who filled it, drawn from the client's desk split.

import { FIRST_NAMES, LAST_NAMES } from "../seedLists";
import { addDays, dayDiff, maxDate, minDate } from "../../calc/dates";

const DIRECTORS = [
  { id: "RD1", title: "Recruiting Director, East", books: ["T1", "T2", "T3"] },
  { id: "RD2", title: "Recruiting Director, Central & West", books: ["T4", "T5"] },
];

const pickOwner = (rng, owners) => rng.weighted(owners.map((o) => [o.repId, o.share]));

/**
 * Stamps `recruiterId` on requisitions, assignments, placements and every
 * fact, so each dollar has exactly one recruiter behind it.
 */
export function assignRecruiters(rng, { clients, requisitions, assignments, placements, facts }) {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const reqById = new Map();
  for (const r of requisitions) {
    r.recruiterId = pickOwner(rng, clientById.get(r.clientId).owners);
    reqById.set(r.id, r);
  }
  const asgById = new Map();
  for (const a of assignments) {
    a.recruiterId = reqById.get(a.requisitionId)?.recruiterId || pickOwner(rng, clientById.get(a.clientId).owners);
    asgById.set(a.id, a);
  }
  const placementById = new Map();
  for (const p of placements) {
    p.recruiterId = pickOwner(rng, clientById.get(p.clientId).owners);
    placementById.set(p.id, p);
  }
  for (const f of facts) {
    f.recruiterId = f.assignmentId ? asgById.get(f.assignmentId).recruiterId : placementById.get(f.placementId).recruiterId;
  }
}

/**
 * Each client's desk split recomputed from what its recruiters actually filled
 * (GP share, all history), and every recruiter who has worked the client.
 */
export function desksFromPlacements(clients, facts, requisitions) {
  const gp = new Map();
  const worked = new Map(clients.map((c) => [c.id, new Set()]));
  for (const r of requisitions) worked.get(r.clientId).add(r.recruiterId);
  for (const f of facts) {
    const m = gp.get(f.clientId) || new Map();
    m.set(f.recruiterId, (m.get(f.recruiterId) || 0) + Math.max(0, f.gp));
    gp.set(f.clientId, m);
    worked.get(f.clientId).add(f.recruiterId);
  }
  for (const c of clients) {
    c.recruiterIds = [...worked.get(c.id)];
    const m = gp.get(c.id);
    const total = m ? [...m.values()].reduce((s, v) => s + v, 0) : 0;
    if (!total) continue;
    const shares = [...m].filter(([, v]) => v > 0).map(([repId, v]) => ({ repId, share: Math.round((v / total) * 1000) / 1000 }));
    // Rounding must still add up to the whole client.
    const drift = 1 - shares.reduce((s, o) => s + o.share, 0);
    shares.sort((a, b) => b.share - a.share)[0].share = Math.round((shares[0].share + drift) * 1000) / 1000;
    c.owners = shares;
  }
}

/**
 * Recruiting org from the desk org: same recruiters (renamed), two lead teams
 * per Account Manager book, two Recruiting Directors. Shared people (CEO,
 * finance, access admin) stay as they are.
 */
export function toRecruitingOrg(rng, org) {
  const used = new Set(org.people.filter((p) => ["E2", "F1", "A1"].includes(p.id)).map((p) => p.name));
  const name = () => {
    for (;;) {
      const n = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
  };

  const directors = DIRECTORS.map((d) => ({ id: d.id, name: name(), role: "recruiting_director", title: d.title }));
  const directorOfBook = new Map(DIRECTORS.flatMap((d) => d.books.map((b) => [b, d.id])));
  const managers = [];
  const leads = [];
  const teams = [];
  const reps = [];
  for (const [i, book] of org.teams.entries()) {
    const am = { id: `AM${i + 1}`, name: name(), role: "account_manager", title: `Account Manager, ${book.name}`, reportsTo: directorOfBook.get(book.id) };
    managers.push(am);
    const members = org.reps.filter((r) => r.teamId === book.id);
    const half = Math.ceil(members.length / 2);
    [members.slice(0, half), members.slice(half)].forEach((group, j) => {
      const lead = { id: `L${String(leads.length + 1).padStart(2, "0")}`, name: name(), role: "lead", title: "Recruiter Lead", reportsTo: am.id };
      leads.push(lead);
      const team = {
        id: `${book.id}${"AB"[j]}`,
        name: `${book.name} · Team ${lead.name.split(" ").pop()}`,
        bookId: book.id,
        bookName: book.name,
        directorId: am.id, // the Account Manager: drives "teams" scope and the Account manager filter
        leadId: lead.id,
        recruitingDirectorId: am.reportsTo,
        branchIds: book.branchIds,
        verticals: book.verticals,
        size: group.length,
      };
      lead.teamId = team.id;
      teams.push(team);
      group.forEach((r, k) => {
        reps.push({ ...r, name: name(), title: k === 0 ? "Senior Recruiter" : "Recruiter", role: "recruiter", teamId: team.id });
      });
    });
  }

  const shared = org.people.filter((p) => ["E2", "F1", "A1"].includes(p.id)).map((p) => ({ ...p }));
  const people = [
    ...shared,
    ...directors,
    ...managers,
    ...leads,
    ...reps.map((r) => ({ id: r.id, name: r.name, role: "recruiter", title: r.title, teamId: r.teamId, reportsTo: teams.find((t) => t.id === r.teamId).leadId })),
  ];
  return { ...org, teams, reps, people, managers, leads, directors };
}

// Harder-to-fill verticals need more submittals per job order.
const SUBMITTALS_BY_VERTICAL = { IT: [3, 8], ENG: [3, 7], HC: [2, 6], FA: [2, 5], LI: [1, 4], ADM: [1, 4] };

/**
 * The candidate funnel behind every requisition (job order): submittals,
 * interviews and offers with their dates, ending in the placement for filled
 * job orders. Sets `closedDate` (filled or cancelled) and `submittals` on each
 * requisition. Uses its own random stream, so no other sample value changes.
 */
export function generateFunnel(rng, { requisitions, clients, asOf }) {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const between = (from, to) => (to <= from ? from : addDays(from, rng.int(0, dayDiff(from, to))));
  for (const r of requisitions) {
    const [lo, hi] = SUBMITTALS_BY_VERTICAL[clientById.get(r.clientId).verticalId] || [2, 5];
    const opened = r.openedDate;
    const subs = [];
    // A filled job order: its candidates from first submittal to the accepted offer on the fill date.
    const fillFunnel = (fill) => {
      const out = [];
      const n = rng.int(Math.max(1, lo), hi);
      const placed = rng.int(0, n - 1);
      const lastSub = maxDate(addDays(opened, 1), addDays(fill, -2));
      for (let i = 0; i < n; i++) {
        const date = between(addDays(opened, 1), lastSub);
        const isPlaced = i === placed;
        const interviewed = isPlaced || rng.chance(0.45);
        const interviewDate = interviewed ? minDate(maxDate(addDays(date, rng.int(1, 5)), date), maxDate(addDays(fill, -1), date)) : null;
        const offered = isPlaced || (interviewed && rng.chance(0.15));
        const offerDate = offered ? (isPlaced ? fill : minDate(addDays(interviewDate, rng.int(1, 3)), fill)) : null;
        out.push({ date, interviewDate, offerDate, outcome: isPlaced ? "placed" : offered ? "declined" : interviewed ? "rejected" : "not_selected" });
      }
      return out;
    };
    if (r.status === "filled") {
      r.closedDate = r.filledDate;
      subs.push(...fillFunnel(r.filledDate));
    } else if (r.plannedFillDate) {
      // In flight: the same schedule as a job order filling on its planned date, seen as of the data date.
      r.closedDate = null;
      for (const s of fillFunnel(r.plannedFillDate)) {
        if (s.date > asOf) continue;
        const interviewDate = s.interviewDate && s.interviewDate <= asOf ? s.interviewDate : null;
        const offerDate = interviewDate && s.offerDate && s.offerDate <= asOf ? s.offerDate : null;
        const decided = offerDate ? s.outcome === "declined" : interviewDate ? s.outcome === "rejected" : s.outcome === "not_selected" && addDays(s.date, 7) <= asOf;
        subs.push({ date: s.date, interviewDate, offerDate, outcome: decided ? s.outcome : offerDate ? "offer_out" : interviewDate ? "interviewing" : "submitted" });
      }
    } else if (r.status === "cancelled") {
      r.closedDate = minDate(asOf, addDays(opened, rng.int(15, 45)));
      const n = rng.int(0, Math.max(1, hi - 2));
      for (let i = 0; i < n; i++) {
        const date = between(addDays(opened, 1), maxDate(addDays(opened, 1), addDays(r.closedDate, -1)));
        const interviewed = rng.chance(0.35);
        const interviewDate = interviewed ? minDate(addDays(date, rng.int(1, 6)), r.closedDate) : null;
        const offered = interviewed && rng.chance(0.12);
        subs.push({ date, interviewDate, offerDate: offered ? minDate(addDays(interviewDate, rng.int(1, 3)), r.closedDate) : null, outcome: offered ? "declined" : interviewed ? "rejected" : "not_selected" });
      }
    } else {
      r.closedDate = null;
      const age = dayDiff(opened, asOf);
      const n = Math.min(hi, Math.floor(age / rng.int(4, 8)));
      for (let i = 0; i < n; i++) {
        const date = between(addDays(opened, 1), asOf);
        const interviewDate = rng.chance(0.4) && addDays(date, 2) <= asOf ? between(addDays(date, 1), asOf) : null;
        const offerDate = interviewDate && rng.chance(0.15) && addDays(interviewDate, 1) <= asOf ? between(addDays(interviewDate, 1), asOf) : null;
        subs.push({ date, interviewDate, offerDate, outcome: offerDate ? "offer_out" : interviewDate ? "interviewing" : "submitted" });
      }
    }
    r.submittals = subs.sort((a, b) => a.date.localeCompare(b.date));
  }
}

/**
 * Job orders in flight on the data date. The workforce sample only creates a
 * requisition once its contractor has started, so job orders opened in the
 * last few weeks whose contractor starts after the data date would be
 * missing. Mirror last year: every requisition opened in the eight weeks
 * before the same date a year earlier whose contractor had not started by
 * then reappears at the same client with the same recruiter: filled and
 * awaiting the start if its fill date has passed, otherwise still open.
 */
export function addInFlightRequisitions(requisitions, assignments, clients, asOf) {
  const lastYear = addDays(asOf, -365);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const startByReq = new Map(assignments.map((a) => [a.requisitionId, a.startDate]));
  const mirrored = [];
  for (const r of requisitions) {
    if (r.status !== "filled" || r.openedDate < addDays(lastYear, -56) || r.openedDate > lastYear) continue;
    const client = clientById.get(r.clientId);
    if (!(startByReq.get(r.id) > lastYear) || (client.churnDate && client.churnDate <= asOf)) continue;
    const fill = addDays(r.filledDate, 365);
    mirrored.push({
      id: `RQ-F${String(mirrored.length + 1).padStart(3, "0")}`,
      clientId: r.clientId,
      openedDate: addDays(r.openedDate, 365),
      filledDate: fill <= asOf ? fill : null,
      status: fill <= asOf ? "filled" : "open",
      positions: 1,
      recruiterId: r.recruiterId,
      plannedFillDate: fill,
      awaitingStart: fill <= asOf,
    });
  }
  requisitions.push(...mirrored);
}
