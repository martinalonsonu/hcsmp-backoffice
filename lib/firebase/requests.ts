import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseServices } from "./client";
import type { PortalIdentity } from "./auth";
import type { RequestStatus } from "@/lib/portal";

function today() { return new Date().toISOString().slice(0, 10); }

/** Security Rules independently verify the requester, immutable fields and role. */
export async function submitInstitutionalRequest(identity: PortalIdentity, title: string, content: string) {
  if (identity.user.role === "secretaria") throw new Error("Secretaría gestiona las solicitudes.");
  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  if (cleanTitle.length < 5 || cleanTitle.length > 120) throw new Error("El asunto debe tener entre 5 y 120 caracteres.");
  if (cleanContent.length < 10 || cleanContent.length > 5000) throw new Error("El contenido debe tener entre 10 y 5000 caracteres.");
  const { db } = getFirebaseServices();
  const date = today();
  await addDoc(collection(db, "solicitudes"), {
    requesterId: identity.user.hermanoId,
    title: cleanTitle,
    content: cleanContent,
    status: "enviada",
    submittedAt: date,
    updatedAt: date,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
}

export async function setInstitutionalRequestStatus(identity: PortalIdentity, requestId: string, status: RequestStatus) {
  if (identity.user.role !== "secretaria") throw new Error("Solo Secretaría puede gestionar solicitudes.");
  if (!["en_revision", "derivada", "resuelta"].includes(status)) throw new Error("Estado de solicitud no permitido.");
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, "solicitudes", requestId), {
    status,
    updatedAt: today(),
    updatedAtServer: serverTimestamp(),
  });
}
