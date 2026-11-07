/**
 * Cloudflare Worker: privileged account provisioning.
 * Deploy with nodejs_compat and secrets GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY,
 * FIREBASE_PROJECT_ID, FIREBASE_LOGIN_DOMAIN and ALLOWED_ORIGIN.
 * Requires npm dependencies firebase-admin and wrangler in this worker directory.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

interface Env {
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_LOGIN_DOMAIN: string;
  ALLOWED_ORIGIN: string;
}
type Role = "estandar"|"tesoreria"|"secretaria"|"presidencia";
const roles: Role[] = ["estandar","tesoreria","secretaria","presidencia"];
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const utf8 = (s:string) => new TextEncoder().encode(s);
function app(env:Env) {
  if(!getApps().length) initializeApp({credential:cert({
    projectId:env.FIREBASE_PROJECT_ID,clientEmail:env.GOOGLE_CLIENT_EMAIL,
    privateKey:env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,"\n"),
  })});
  return getAuth();
}
async function googleToken(env:Env) {
  const key = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,"\n");
  const bytes=Uint8Array.from(atob(key.replace(/-----[^-]+-----/g,"").replace(/\s/g,"")),c=>c.charCodeAt(0));
  const privateKey=await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const now=Math.floor(Date.now()/1000);
  const header=encode(utf8(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const claims=encode(utf8(JSON.stringify({iss:env.GOOGLE_CLIENT_EMAIL,scope:"https://www.googleapis.com/auth/datastore",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})));
  const input=header+"."+claims;
  const signature=encode(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,utf8(input))));
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:input+"."+signature})});
  if(!response.ok) throw Error("No se pudo autorizar el servicio de Firestore.");
  return (await response.json() as {access_token:string}).access_token;
}
type Field = {stringValue?:string;booleanValue?:boolean};
type FireDoc = {name?:string;fields?:Record<string,Field>;updateTime?:string};
function field(doc:FireDoc,key:string) {return doc.fields?.[key]?.stringValue ?? "";}
function enabled(doc:FireDoc) {return doc.fields?.activo?.booleanValue===true;}
function response(body:unknown,status=200,origin="") {
  return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store",...(origin?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}});
}
export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    const origin=request.headers.get("origin")||"";
    if(request.method==="OPTIONS") return origin===env.ALLOWED_ORIGIN ?
      new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization, content-type"}}):
      new Response(null,{status:403});
    if(request.method!=="POST" || new URL(request.url).pathname!=="/accounts") return response({error:"No encontrado"},404);
    if(origin!==env.ALLOWED_ORIGIN) return response({error:"Origen no autorizado"},403);
    try {
      const authorization=request.headers.get("authorization")||"";
      if(!authorization.startsWith("Bearer ")) return response({error:"No autorizado"},401,origin);
      const auth=app(env);
      const decoded=await auth.verifyIdToken(authorization.slice(7),true);
      const token=await googleToken(env);
      const base=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
      const headers={authorization:`Bearer ${token}`};
      const read=async(path:string):Promise<FireDoc|null>=>{
        const r=await fetch(base+"/"+path,{headers});
        if(r.status===404)return null;
        if(!r.ok)throw Error("No se pudo consultar Firestore.");
        return r.json() as Promise<FireDoc>;
      };
      const operator=await read("usuarios/"+encodeURIComponent(decoded.uid));
      if(!operator || !enabled(operator) || field(operator,"role")!=="secretaria")return response({error:"Solo Secretaría puede crear usuarios."},403,origin);
      const body=await request.json() as {memberId?:string;username?:string;role?:Role};
      const memberId=body.memberId?.trim()||"";
      const username=body.username?.trim().toLowerCase()||"";
      const role=body.role;
      if(!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(username) || username.length>64 ||
        !/^[a-zA-Z0-9_-]{1,120}$/.test(memberId) || !role || !roles.includes(role))
        return response({error:"Datos de cuenta inválidos."},400,origin);
      const member=await read("hermanos/"+encodeURIComponent(memberId));
      if(!member || field(member,"status")!=="vigente")return response({error:"Hermano inexistente o retirado."},400,origin);
      // Firestore transactions enforce uniqueness by reserving one stable document per member.
      // Create reservation before Auth user; rollback on failure.
      const reservationPath=`reservasUsuarios/${encodeURIComponent(memberId)}`;
      const reserve=await fetch(base+"/reservasUsuarios?documentId="+encodeURIComponent(memberId),{
        method:"POST",headers:{...headers,"content-type":"application/json"},
        body:JSON.stringify({fields:{username:{stringValue:username},createdBy:{stringValue:decoded.uid}}})
      });
      if(reserve.status===409)return response({error:"Este hermano ya tiene una cuenta o una reserva pendiente."},409,origin);
      if(!reserve.ok)throw Error("No se pudo reservar la cuenta.");
      let createdUid="";
      try {
        const existing=await auth.getUserByEmail(username+"@"+env.FIREBASE_LOGIN_DOMAIN).catch((e:unknown)=>{
          if((e as {code?:string}).code==="auth/user-not-found")return null;throw e;
        });
        if(existing)throw Error("El nombre de usuario ya está registrado.");
        const password=encode(crypto.getRandomValues(new Uint8Array(18)));
        const user=await auth.createUser({email:username+"@"+env.FIREBASE_LOGIN_DOMAIN,password,emailVerified:false,disabled:false});
        createdUid=user.uid;
        const now=new Date().toISOString().slice(0,10);
        const create=await fetch(base+"/usuarios?documentId="+encodeURIComponent(createdUid),{
          method:"POST",headers:{...headers,"content-type":"application/json"},
          body:JSON.stringify({fields:{
            hermanoId:{stringValue:memberId},username:{stringValue:username},role:{stringValue:role},
            activo:{booleanValue:true},passwordChangeRequired:{booleanValue:true},
            createdAt:{stringValue:now},updatedAt:{stringValue:now},createdBy:{stringValue:decoded.uid}
          }})
        });
        if(!create.ok)throw Error("No se pudo vincular la cuenta institucional.");
        return response({username,password},201,origin);
      } catch(e) {
        if(createdUid)await auth.deleteUser(createdUid).catch(()=>undefined);
        await fetch(base+"/"+reservationPath,{method:"DELETE",headers}).catch(()=>undefined);
        throw e;
      }
    } catch(e) {
      return response({error:e instanceof Error?e.message:"No se pudo crear la cuenta."},500,origin);
    }
  }
};
