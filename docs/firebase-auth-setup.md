# Etapa 2: adaptador de autenticación y consultas

Esta rama introduce adaptadores para Firebase Auth y consultas Firestore,
**sin cambiar aún las pantallas de demostración**.

## Requisitos antes de integrar en la UI

1. Ejecutar localmente `npm install firebase` y confirmar los cambios en
   `package.json` y `package-lock.json` **juntos**.
2. Configurar `.env.local` con los valores de `.env.example`.
3. Definir `NEXT_PUBLIC_FIREBASE_LOGIN_DOMAIN` con un dominio bajo control
   institucional. No asumir que `.invalid` es aceptado por Firebase Auth;
   verificar el dominio y el flujo de creación antes de elegirlo.
4. Publicar reglas revisadas y probadas; en Git solo son archivos.
5. Crear cuentas piloto en Firebase Authentication y el correspondiente
   `usuarios/{uid}` desde un entorno confiable.
6. Conectar `PortalProvider` a `observePortalIdentity`,
   `loginWithUsername`, `logoutFirebase` y las consultas. Evitar que
   el modo demo sea accesible en la versión de producción.

## Importante

- Las reglas actuales deniegan escrituras; ninguna operación administrativa
  está lista para producción.
- No crear usuarios de otros hermanos con el SDK Auth principal desde la
  sesión de Secretaría.
- Las consultas de datos propios incluyen filtros `memberId` o
  `requesterId`; Firestore Security Rules no filtra resultados.
- Las cuotas automáticas actuales se generan en el navegador y necesitan
  operaciones idempotentes/atómicas antes de su persistencia compartida.
- El SDK de Firebase no se ha instalado en esta rama porque no es posible
  regenerar de forma verificable el lockfile sin resolver dependencias npm.
