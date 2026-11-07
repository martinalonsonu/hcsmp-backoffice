# Firebase: integración gradual

## Estado

Esta rama incorpora la **base técnica**, no una migración terminada. La aplicación
continúa utilizando la demo local hasta sustituir `PortalProvider`.
No cargar datos personales reales todavía.

## Servicios

- Firebase Authentication: proveedor email/password habilitado; la interfaz
  seguirá mostrando un nombre de usuario.
- Cloud Firestore Standard: reglas inicialmente de **solo lectura autorizada**.
- Hosting: GitHub Pages; no es necesario Firebase Hosting.

## Colecciones

- `usuarios/{uid}`: acceso, rol, vínculo `hermanoId`; nunca contraseñas.
- `hermanos/{id}`: ficha institucional (campos de `MemberDraft`).
- `movimientos/{id}`: transición del modelo económico actual.
- `historialInstitucional/{id}`: eventos de retiro, reingreso y categoría.
- `configuracion/{id}`: configuración institucional futura.

Los tipos están en `lib/firebase/models.ts`. El modelo financiero definitivo
requerirá obligaciones, pagos imputados, actividades y cortes; no se deben
convertir movimientos de demo en deuda real.

## Pasos para activar

1. Ejecutar `npm install firebase` en el proyecto y confirmar el lockfile.
2. Copiar `.env.example` a `.env.local` y completar los datos de configuración
   de la app web desde Firebase Console.
3. Probar reglas con Firebase Emulator antes de publicarlas.
4. Publicar `firestore.rules` e índices con Firebase CLI (o consola).
5. Crear una cuenta de prueba en Firebase Authentication desde la consola.
6. Crear manualmente `usuarios/{uid}` con el mismo UID y
   `hermanoId` correspondiente. El documento de usuario debe tener
   `activo: true` y un rol válido.
7. Migrar `PortalProvider` a Firebase Auth + Firestore, con consultas
   restringidas por usuario y control de permisos.
8. Diseñar aprovisionamiento seguro de cuentas por Secretaría y escrituras
   con validación fuerte; **no habilitar escrituras generales**.

## Precauciones

- La configuración pública de Firebase no es una clave de administrador.
- No se debe guardar `passwordHash` ni imágenes base64 en Firestore.
- No usar credenciales demo ni datos reales mientras exista `localStorage`
  como fuente de verdad.
- Los hermanos honorarios pueden conservar ficha sin cuenta Auth.
- Los cambios de perfil, creación de cuentas, caja y auditoría requieren
  mecanismos confiables; las reglas actuales los bloquean deliberadamente.
- El correo técnico basado en usuario no permite recuperación por correo;
  hace falta un flujo administrativo seguro de restablecimiento.
