"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLoadedPortal } from "@/components/dashboard/portal-session";
import { describeRosterFilters, type RosterFilters } from "@/lib/member-roster";
import { readFilteredRoster, readRosterPage, type RosterPage } from "@/lib/firebase/roster";

export const emptyRosterFilters: RosterFilters = {
  search: "", sex: "", parent: "", ageGroup: "", category: "", birthMonth: "", sacrament: "",
};

export function useRoster() {
  const { data, identity } = useLoadedPortal();
  const [draftFilters, setDraftFilters] = useState<RosterFilters>(emptyRosterFilters);
  const [rosterFilters, setRosterFilters] = useState<RosterFilters>(emptyRosterFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterCursors, setRosterCursors] = useState<Array<RosterPage["last"]>>([null]);
  const [rosterResult, setRosterResult] = useState<RosterPage | null>(null);
  const [rosterError, setRosterError] = useState("");
  const [rosterDownloadBusy, setRosterDownloadBusy] = useState(false);
  const [rosterDownloadError, setRosterDownloadError] = useState("");
  const rosterDownloadLock = useRef(false);
  const coverage = data.rosterCoverage;
  const coverageReady = coverage !== null && coverage.indexed === coverage.total;

  useEffect(() => {
    if (!coverageReady) return;
    let active = true;
    void readRosterPage(identity, rosterFilters, rosterCursors[rosterPage - 1] ?? null)
      .then((result) => { if (active) setRosterResult(result); })
      .catch((cause) => { if (active) setRosterError(cause instanceof Error ? cause.message : "No se pudo consultar el padrón."); });
    return () => { active = false; };
  }, [identity, data, coverageReady, rosterFilters, rosterCursors, rosterPage]);

  const pageCount = Math.max(1, Math.ceil((rosterResult?.count ?? 0) / 10));
  const pageMembers = rosterResult?.members ?? [];
  const appliedChips = describeRosterFilters(rosterFilters);
  const draftEmpty = Object.values(draftFilters).every((value) => !value);
  const searching = coverageReady && !rosterResult && !rosterError;

  function openFilters() {
    setDraftFilters({ ...rosterFilters });
    setFiltersOpen(true);
  }

  function setDraftFilter<K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function resetResults() {
    setRosterPage(1);
    setRosterCursors([null]);
    setRosterResult(null);
    setRosterError("");
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching) return;
    resetResults();
    setRosterFilters({ ...draftFilters });
    setFiltersOpen(false);
  }

  function removeFilter(key: keyof RosterFilters) {
    if (searching) return;
    resetResults();
    setRosterFilters((current) => ({ ...current, [key]: "" }));
  }

  function clearAppliedFilters() {
    if (searching) return;
    resetResults();
    setRosterFilters({ ...emptyRosterFilters });
  }

  function previousPage() {
    setRosterResult(null);
    setRosterError("");
    setRosterPage(rosterPage - 1);
  }

  function nextPage() {
    if (!rosterResult) return;
    setRosterCursors((current) => [...current.slice(0, rosterPage), rosterResult.last]);
    setRosterResult(null);
    setRosterError("");
    setRosterPage(rosterPage + 1);
  }

  async function exportRoster() {
    if (rosterDownloadLock.current || !rosterResult?.count) return;
    rosterDownloadLock.current = true;
    setRosterDownloadBusy(true);
    setRosterDownloadError("");
    try {
      const { downloadMemberRoster } = await import("@/lib/member-document");
      const members = await readFilteredRoster(identity, rosterFilters);
      await downloadMemberRoster(members, {
        search: rosterFilters.search,
        sex: rosterFilters.sex || undefined,
        parent: rosterFilters.parent || undefined,
        ageGroup: rosterFilters.ageGroup || undefined,
        category: rosterFilters.category || undefined,
        birthMonth: rosterFilters.birthMonth || undefined,
        sacrament: rosterFilters.sacrament || undefined,
      });
    } catch (cause) {
      setRosterDownloadError(cause instanceof Error ? cause.message : "No se pudo exportar el padrón.");
    } finally {
      rosterDownloadLock.current = false;
      setRosterDownloadBusy(false);
    }
  }

  return {
    draftFilters, setDraftFilters, filtersOpen, setFiltersOpen, rosterPage,
    rosterResult, rosterError, rosterDownloadBusy, rosterDownloadError,
    coverage, coverageReady, pageCount, pageMembers, appliedChips, draftEmpty,
    searching, openFilters, setDraftFilter, applyFilters, removeFilter,
    clearAppliedFilters, previousPage, nextPage, exportRoster,
  };
}
