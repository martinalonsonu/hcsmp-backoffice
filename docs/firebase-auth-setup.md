# Acceso y activación con Firebase

El acceso usa el correo personal, sin un dominio obligatorio. Secretaría registra
el hermano y asigna su perfil; el hermano solicita un enlace de activación,
verifica el correo y elige su contraseña. No se guardan contraseñas en Firestore.

## Configuración

1. Configurar las variables `NEXT_PUBLIC_FIREBASE_API_KEY`,
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` y
   `NEXT_PUBLIC_FIREBASE_APP_ID`. `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` y
   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` son opcionales para este flujo.
   `NEXT_PUBLIC_FIREBASE_LOGIN_DOMAIN` ya no se usa.
   Para desplegar en GitHub Pages, registrar esos mismos valores como variables
   de repositorio en **Settings → Secrets and variables → Actions → Variables**.
   El workflow valida las cuatro variables requeridas antes de compilar.
2. En Firebase Authentication, habilitar **Correo/contraseña** y **Enlace de
   correo electrónico**. Añadir el dominio del portal a los dominios autorizados;
   añadir `localhost` para pruebas locales si hace falta.
3. Probar y desplegar `firestore.rules` antes de usar el flujo. Cambiar el
   archivo local no publica reglas.
4. Una cuenta inicial de Secretaría y su documento `usuarios/{uid}` deben
   aprovisionarse desde un entorno confiable. Después, Secretaría crea las
   fichas y preautorizaciones desde el portal.

## Operación

- `preautorizaciones/{correo-en-minúsculas}` contiene el hermano, perfil,
  estado y UID reclamado. Secretaría administra los accesos pendientes.
- El correo se verifica antes de reclamar la preautorización y crear
  `usuarios/{uid}`. El perfil se copia de la autorización de Secretaría.
- Tras la activación, Secretaría modifica el perfil o acceso en Usuarios y
  accesos. La baja institucional también bloquea las lecturas.
- Cambiar el correo de la ficha antes de activar mueve la preautorización.
  Después de activar, el correo de la ficha es de contacto y no modifica el
  correo de Firebase Authentication; este cambio requiere un flujo separado.
- Las cuentas existentes siguen usando su correo actual de Firebase Auth; no
  se migran automáticamente desde direcciones del antiguo dominio.

La creación de cuentas Auth no autorizadas no concede acceso a Firestore.
Controlar las cuotas y las restricciones del plan Firebase y revisar los
registros de errores y los flujos de recuperación antes de producción.
