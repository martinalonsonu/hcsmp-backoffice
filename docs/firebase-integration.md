# HCSMP: integración Firebase (actualizada con main 4502dcde)

## Estado real

**Infraestructura preparada; aplicación aún en modo demostración.**
`components/portal/portal-provider.tsx` sigue usando `localStorage` y
`sessionStorage`. `lib/firebase/client.ts` todavía no se importa en la UI.
**No usar datos reales ni publicar el portal como sistema productivo.**

## Modelo existente que debemos preservar

- Roles: estandar, tesoreria, secretaria, presidencia.
- Categorías: postulante, reingresante, activo, vitalicio.
- Alta de hermanos: usuario `nombre.apellido` con manejo de duplicados.
- Padrón y fichas PDF, retiros y reingresos.
- Movimientos: ingreso, egreso, cargo y pago.
- Cuotas ordinarias con historial de vigencias, inicio de facturación,
  cuotas extraordinarias de mayo/noviembre y cargo por reingreso.
- Solicitudes: enviada, en_revision, derivada y resuelta.
- Reporte mensual de caja en PDF.

## Colecciones previstas

| Ruta | Finalidad |
| --- | --- |
| `usuarios/{uid}` | vínculo a hermano, usuario, rol y acceso activo |
| `hermanos/{id}` | ficha institucional sin credenciales |
| `movimientos/{id}` | caja y cargos actuales (importe en céntimos) |
| `solicitudes/{id}` | peticiones y estado de seguimiento |
| `historialInstitucional/{id}` | retiros, reingresos y categorías |
| `configuracionEconomica/general` | tarifas por vigencia e inicio de facturación |

Las reglas están **deliberadamente en solo lectura**. En particular, no
confieren a usuarios normales permisos para cambiar roles, importes ni estados.

## Activación por etapas

1. En local, instalar `firebase` con `npm install firebase`; confirmar el
   cambio de `package.json` **y** `package-lock.json` en el mismo commit.
   No agregar solo la dependencia sin actualizar el lockfile: rompería `npm ci`.
2. Copiar `.env.example` a `.env.local` y completar los valores públicos del
   SDK Web. No compartir service accounts ni claves privadas.
3. Probar `firestore.rules` en emulador, publicar las reglas y crear cuenta
   piloto Auth con su documento `usuarios/{uid}`.
4. Reemplazar login y sesión simulados con Firebase Authentication.
5. Migrar `PortalProvider` a un adaptador de Firestore con consultas por rol,
   operaciones atómicas e idempotencia de cargos programados.
6. Implementar aprovisionamiento seguro para Secretaría. Firebase Auth Web SDK
   no debe crear cuentas secundarias usando la sesión principal de Secretaría;
   utilizar un entorno confiable o flujo controlado.
7. Implementar escrituras con reglas exhaustivas, pruebas de autorización y
   control de concurrencia. Recién entonces usar datos reales.

## Consideraciones de seguridad

- No guardar `passwordHash` ni fotografías Base64 en documentos Firestore.
- El alias de usuario y la cuenta Auth no son equivalentes: definir y verificar
  el método de resolución de alias antes de exponerlo al público.
- Una baja institucional debe bloquear lecturas de datos incluso si el token
  Auth anterior sigue vigente.
- El cálculo actual de cuotas se ejecuta en el navegador; al migrarlo se
  necesitan IDs deterministas y transacciones para evitar duplicados entre
  dispositivos y cierres de sesión.
- Los filtros de Firestore son parte del control de acceso: las reglas no
  filtran automáticamente los resultados de una consulta.
- `firestore.rules` en Git no cambia las reglas de Firebase hasta desplegarlas.
