import type {PortalIdentity} from "./auth";
import {getFirebaseServices} from "./client";
import type {UserRecord} from "./models";

export async function createMemberAccount(identity:PortalIdentity,input:{
  memberId:string;username:string;role:UserRecord["role"];
}):Promise<{username:string;password:string}> {
  if(identity.user.role!=="secretaria")throw Error("Solo Secretaría puede crear cuentas.");
  const endpoint=process.env.NEXT_PUBLIC_ACCOUNT_WORKER_URL;
  if(!endpoint || !/^https:\/\//.test(endpoint))throw Error("Configura NEXT_PUBLIC_ACCOUNT_WORKER_URL con una URL HTTPS.");
  const {auth}=getFirebaseServices();
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw Error("Tu sesión ha caducado.");
  const result=await fetch(endpoint.replace(/\/$/,"")+"/accounts",{
    method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},
    body:JSON.stringify(input),
  });
  const payload=await result.json() as {username?:string;password?:string;error?:string};
  if(!result.ok)throw Error(payload.error||"No se pudo crear la cuenta.");
  if(!payload.username||!payload.password)throw Error("El servicio devolvió una respuesta incompleta.");
  return {username:payload.username,password:payload.password};
}
