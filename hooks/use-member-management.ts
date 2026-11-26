"use client";

import { useState, type FormEvent } from "react";
import { useLoadedPortal, type MemberRow } from "@/components/dashboard/portal-session";
import { changeMemberCategory, changeMemberLifecycle, createInstitutionalMember, updateInstitutionalMemberContact } from "@/lib/firebase/members";
import type { MemberSex } from "@/lib/member-roster";
import type { Category, Guardian, Role } from "@/lib/portal";

const emptyDraft = {
  fullName: "", dni: "", birthDate: "", sex: null as MemberSex | null, hasChildren: null as boolean | null,
  nonResidentHuacho: false,
  address: "", phone: "", email: "", occupation: "", maritalStatus: "", joinedAt: "", swornAt: "",
  category: "activo" as Category, sacraments: [] as string[], guardian: null as Guardian | null,
};

export function useMemberManagement() {
  const { identity, reload } = useLoadedPortal();
  const [memberBusy, setMemberBusy] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<MemberRow | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<MemberRow | null>(null);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [nextCategory, setNextCategory] = useState<Category>("activo");
  const [categoryReason, setCategoryReason] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState<Role>("estandar");
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [memberDraft, setMemberDraft] = useState(emptyDraft);

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (memberBusy) return;
    setMemberBusy(true); setMemberMessage("");
    try {
      if (editingMember) {
        await updateInstitutionalMemberContact(identity, editingMember.id, memberDraft);
      } else {
        await createInstitutionalMember(identity, memberDraft, newMemberRole);
      }
      setMemberFormOpen(false);
      reload();
    } catch (cause) {
      setMemberMessage(cause instanceof Error ? cause.message : "No se pudo guardar la ficha.");
    } finally { setMemberBusy(false); }
  }

  async function submitCategoryChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryTarget || memberBusy) return;
    setMemberBusy(true); setMemberMessage("");
    try {
      await changeMemberCategory(identity, categoryTarget.id, nextCategory, categoryReason);
      setCategoryOpen(false); setCategoryReason("");
      reload();
    } catch (cause) {
      setMemberMessage(cause instanceof Error ? cause.message : "No se pudo cambiar la categoría.");
    } finally { setMemberBusy(false); }
  }

  async function submitLifecycleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lifecycleTarget || memberBusy) return;
    setMemberBusy(true); setMemberMessage("");
    try {
      await changeMemberLifecycle(identity, lifecycleTarget.id,
        lifecycleTarget.status === "vigente" ? "retiro" : "reingreso", lifecycleReason);
      setLifecycleOpen(false); setLifecycleReason("");
      reload();
    } catch (cause) {
      setMemberMessage(cause instanceof Error ? cause.message : "No se pudo registrar el cambio de estado.");
    } finally { setMemberBusy(false); }
  }

  function openMember(member: MemberRow | null) {
    setEditingMember(member);
    setMemberMessage("");
    setNewMemberRole("estandar");
    setMemberDraft(member ? {
      fullName: member.fullName, dni: member.dni ?? "", birthDate: member.birthDate ?? "",
      sex: member.sex ?? null, hasChildren: member.hasChildren ?? null,
      nonResidentHuacho: member.nonResidentHuacho ?? false,
      address: member.address ?? "", phone: member.phone ?? "", email: member.email ?? "",
      occupation: member.occupation ?? "", maritalStatus: member.maritalStatus ?? "",
      joinedAt: member.joinedAt ?? "", swornAt: member.swornAt ?? "",
      category: member.category, sacraments: member.sacraments ?? [], guardian: member.guardian ?? null,
    } : emptyDraft);
    setMemberFormOpen(true);
  }

  function openCategory(member: MemberRow) {
    setCategoryTarget(member); setCategoryOpen(true); setNextCategory(member.category); setCategoryReason(""); setMemberMessage("");
  }

  function openLifecycle(member: MemberRow) {
    setLifecycleTarget(member); setLifecycleOpen(true); setLifecycleReason(""); setMemberMessage("");
  }

  return {
    memberBusy, categoryTarget, categoryOpen, setCategoryOpen, lifecycleTarget,
    lifecycleOpen, setLifecycleOpen, lifecycleReason, setLifecycleReason,
    nextCategory, setNextCategory, categoryReason, setCategoryReason, memberMessage,
    memberFormOpen, setMemberFormOpen, newMemberRole, setNewMemberRole,
    editingMember, memberDraft, setMemberDraft, saveMember, submitCategoryChange,
    submitLifecycleChange, openMember, openCategory, openLifecycle,
  };
}
