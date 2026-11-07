import {doc,serverTimestamp,updateDoc} from "firebase/firestore";
import {getFirebaseServices} from "./client";
import type {PortalIdentity} from "./auth";
import type {UserRecord} from "./models";

export async function updateAccountAccess(identity:PortalIdentity,uid:string,
  changes:{role?:UserRecord["role"];activo?:boolean}) {
  if(identity.user.role!=="secretaria") throw new Error("Solo Secretaría administra accesos.");
  if(uid===identity.uid) throw new Error("No puedes modificar tu propia cuenta.");
  if(changes.role!==undefined && !["estandar","tesoreria","secretaria","presidencia"].includes(changes.role))
    throw new Error("Rol inválido.");
  if(changes.activo!==undefined && typeof changes.activo!=="boolean") throw new Error("Estado inválido.");
  if(changes.role===undefined && changes.activo===undefined) return;
  const {db}=getFirebaseServices();
  await updateDoc(doc(db,"usuarios",uid),{...changes,updatedAt:new Date().toISOString().slice(0,10),
    updatedAtServer:serverTimestamp()});
}
