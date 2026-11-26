import {
  collection, documentId, getCountFromServer, getDocs, limit, orderBy, query,
  runTransaction, startAfter, where, type DocumentData, type QueryConstraint, type QueryDocumentSnapshot, type QuerySnapshot,
} from "firebase/firestore";
import type { MemberRecord } from "./models";
import type { PortalIdentity } from "./auth";
import { getFirebaseServices } from "./client.ts";
import type { RosterFilters } from "../member-roster.ts";
import { makeRosterIndex, normalizeRosterSearch, rosterDateBounds, rosterFilterKey } from "../roster-index.ts";

type Cursor = QueryDocumentSnapshot<DocumentData>;
export type RosterPage = {
  members: Array<MemberRecord & { id: string }>;
  count: number;
  last: Cursor | null;
};

export async function rosterCoverage(identity: PortalIdentity) {
  if (!["secretaria", "presidencia"].includes(identity.user.role))
    throw new Error("No tienes permiso para consultar el padrón.");
  const { db } = getFirebaseServices();
  const members = collection(db, "hermanos");
  const [total, indexed] = await Promise.all([
    getCountFromServer(members),
    getCountFromServer(query(members, where("rosterIndex.facets", "array-contains", "*"))),
  ]);
  return { total: total.data().count, indexed: indexed.data().count };
}

export async function backfillRosterIndex(identity: PortalIdentity, onProgress: (count: number) => void) {
  if (identity.user.role !== "secretaria")
    throw new Error("Solo Secretaría puede preparar el índice del padrón.");
  const { db } = getFirebaseServices();
  const members = collection(db, "hermanos");
  let cursor: Cursor | null = null;
  let processed = 0;
  while (true) {
    const snapshot: QuerySnapshot<DocumentData> = await getDocs(query(members, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(100)));
    if (snapshot.empty) break;
    for (const item of snapshot.docs) {
      await runTransaction(db, async (tx) => {
        const current = await tx.get(item.ref);
        if (!current.exists()) return;
        const member = current.data() as MemberRecord;
        if (member.rosterIndex) {
          if (!member.rosterIndex.facets?.includes("*"))
            throw new Error(`El índice de la ficha ${item.id} no es válido.`);
          return;
        }
        tx.update(item.ref, {rosterIndex: makeRosterIndex(member)});
      });
      onProgress(++processed);
    }
    cursor = snapshot.docs.at(-1) ?? null;
    if (snapshot.size < 100) break;
  }
}

function rosterQuery(identity: PortalIdentity, filters: RosterFilters) {
  if (!["secretaria", "presidencia"].includes(identity.user.role))
    throw new Error("No tienes permiso para consultar el padrón.");
  const key = rosterFilterKey(filters);
  if (key === null) return null;
  const { db } = getFirebaseServices();
  const constraints: QueryConstraint[] = [where("rosterIndex.facets", "array-contains", key)];
  const search = normalizeRosterSearch(filters.search);
  const field = /^\d+$/.test(search) ? "rosterIndex.dni" : "rosterIndex.name";
  if (search) {
    constraints.push(where(field, ">=", search), where(field, "<=", `${search}\uf8ff`), orderBy(field));
  }
  const bounds = rosterDateBounds(filters);
  if (bounds) {
    constraints.push(
      where("rosterIndex.birthDate", bounds.minExclusive ? ">" : ">=", bounds.min),
      where("rosterIndex.birthDate", "<=", bounds.max),
      orderBy("rosterIndex.birthDate"),
    );
  }
  constraints.push(orderBy(documentId()));
  return query(collection(db, "hermanos"), ...constraints);
}

export async function readRosterPage(identity: PortalIdentity, filters: RosterFilters, cursor: Cursor | null): Promise<RosterPage> {
  const base = rosterQuery(identity, filters);
  if (!base) return { members: [], count: 0, last: null };
  const [snapshot, count] = await Promise.all([
    getDocs(query(base, ...(cursor ? [startAfter(cursor)] : []), limit(10))),
    getCountFromServer(base),
  ]);
  return {
    members: snapshot.docs.map((item) => ({...item.data() as MemberRecord, id:item.id})),
    count: count.data().count,
    last: snapshot.docs.at(-1) ?? null,
  };
}

export async function readFilteredRoster(identity: PortalIdentity, filters: RosterFilters) {
  const base = rosterQuery(identity, filters);
  if (!base) return [];
  const snapshot = await getDocs(base);
  return snapshot.docs.map((item) => ({...item.data() as MemberRecord, id:item.id}));
}
