import {
  collection, doc, getDocs, query, runTransaction, serverTimestamp, where,
} from "firebase/firestore";
import type { PortalIdentity } from "./auth";
import type { MemberRecord } from "./models";
import { getFirebaseServices } from "./client.ts";
import { makeRosterIndex, normalizeRosterSearch } from "../roster-index.ts";
import { rosterImportIdentityKey, type RosterImportRow } from "../member-import.ts";
import { todayDate } from "../portal.ts";

export type ExistingRosterMatch = { id: string; fullName: string; birthDate: string };
export type RosterImportResult = {
  created: number;
  alreadyExists: number;
  failures: Array<{ sourceSheet: string; rowNumber: number; message: string }>;
};

function requireSecretary(identity: PortalIdentity) {
  if (identity.user.role !== "secretaria")
    throw new Error("Solo Secretaría puede importar el padrón.");
}

function addMatch(
  matches: Map<string, ExistingRosterMatch[]>,
  key: string,
  match: ExistingRosterMatch,
) {
  const current = matches.get(key) ?? [];
  if (!current.some((item) => item.id === match.id))
    matches.set(key, [...current, match]);
}

export async function findExistingRosterMatches(
  identity: PortalIdentity,
  rows: RosterImportRow[],
): Promise<Map<string, ExistingRosterMatch[]>> {
  requireSecretary(identity);
  const { db } = getFirebaseServices();
  const members = collection(db, "hermanos");
  const matches = new Map<string, ExistingRosterMatch[]>();
  const candidateKeys = new Set(rows.map((row) => row.identityKey));
  const names = [...new Set(rows.map((row) => normalizeRosterSearch(row.member.fullName)).filter(Boolean))];
  const dnis = [...new Set(rows.map((row) => row.member.dni).filter(Boolean))];

  for (const [field, values] of [["rosterIndex.name", names], ["rosterIndex.dni", dnis]] as const) {
    for (let offset = 0; offset < values.length; offset += 30) {
      const snapshot = await getDocs(query(members, where(field, "in", values.slice(offset, offset + 30))));
      for (const item of snapshot.docs) {
        const member = item.data() as MemberRecord;
        const key = rosterImportIdentityKey(member.fullName ?? "", member.birthDate ?? "");
        const match = { id: item.id, fullName: member.fullName ?? "", birthDate: member.birthDate ?? "" };
        if (field === "rosterIndex.dni") {
          for (const row of rows) {
            if (row.member.dni && row.member.dni === member.dni)
              addMatch(matches, row.identityKey, match);
          }
        } else if (candidateKeys.has(key)) {
          addMatch(matches, key, match);
        }
      }
    }
  }
  return matches;
}

async function documentIdForImport(row: RosterImportRow): Promise<string> {
  if (row.member.dni) return `dni-${row.member.dni}`;
  if (!globalThis.crypto?.subtle)
    throw new Error("Este navegador no permite crear identificadores seguros para la importación.");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(row.identityKey),
  );
  const suffix = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `import-${suffix}`;
}

export async function importRosterMembers(
  identity: PortalIdentity,
  rows: RosterImportRow[],
  onProgress: (processed: number, total: number) => void,
): Promise<RosterImportResult> {
  requireSecretary(identity);
  if (rows.some((row) => row.errors.length))
    throw new Error("Corrige o excluye las filas con errores antes de importar.");

  const { db } = getFirebaseServices();
  const result: RosterImportResult = { created: 0, alreadyExists: 0, failures: [] };
  const today = todayDate();
  const concurrency = 10;

  for (let offset = 0; offset < rows.length; offset += concurrency) {
    const chunk = rows.slice(offset, offset + concurrency);
    const outcomes = await Promise.all(chunk.map(async (row) => {
      try {
        const memberId = await documentIdForImport(row);
        const memberRef = doc(db, "hermanos", memberId);
        const created = await runTransaction(db, async (transaction) => {
          const current = await transaction.get(memberRef);
          if (current.exists()) return false;
          const member = row.member;
          transaction.set(memberRef, {
            ...member,
            rosterIndex: makeRosterIndex(member),
            createdAt: today,
            updatedAt: today,
            createdAtServer: serverTimestamp(),
            updatedAtServer: serverTimestamp(),
            createdBy: identity.uid,
          });
          return true;
        });
        return created
          ? { kind: "created" as const }
          : { kind: "exists" as const };
      } catch (cause) {
        return {
          kind: "failed" as const,
          message: cause instanceof Error ? cause.message : "Error desconocido de Firestore.",
        };
      }
    }));

    outcomes.forEach((outcome, index) => {
      if (outcome.kind === "created") result.created += 1;
      else if (outcome.kind === "exists") result.alreadyExists += 1;
      else result.failures.push({
        sourceSheet: chunk[index].sourceSheet,
        rowNumber: chunk[index].rowNumber,
        message: outcome.message,
      });
    });
    onProgress(offset + chunk.length, rows.length);
  }

  return result;
}
