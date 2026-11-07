# Creación de cuentas desde Secretaría (Spark + Cloudflare Workers)

La creación de credenciales se ejecuta desde **Usuarios y accesos** en el portal. El navegador envía un token Firebase ID al Worker; el Worker verifica el token con Firebase Admin, lee el rol vigente en Firestore y exige Secretaría. Presidencia solo consulta. Los documentos de `usuarios` se crean mediante credenciales de servicio, nunca con permisos públicos de Firestore.

## Configuración inicial (administrador técnico)

1. En Cloudflare, crea un Worker gratuito con el código de `worker/`. Ejecuta `npm install` y `npm run deploy` dentro de esa carpeta. Cloudflare debe tener habilitada la compatibilidad Node.js para Firebase Admin. **Verifica en un entorno de prueba** que la versión del SDK funciona en el runtime.
2. Crea una cuenta de servicio de Google Cloud con los permisos mínimos necesarios para gestionar usuarios de Firebase Auth y documentos de Firestore. Configura como **secretos del Worker**, nunca en el repositorio: `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_LOGIN_DOMAIN`, `ALLOWED_ORIGIN`. `ALLOWED_ORIGIN` debe ser el origen HTTPS exacto del portal, sin barra final. Los secretos se configuran con `npx wrangler secret put NOMBRE`.
3. Configura `NEXT_PUBLIC_ACCOUNT_WORKER_URL` en el despliegue Next.js con la URL HTTPS pública del Worker, sin la ruta `/accounts`. Configura `NEXT_PUBLIC_FIREBASE_LOGIN_DOMAIN` con el **mismo** dominio de alias que `FIREBASE_LOGIN_DOMAIN`.
4. Despliega y prueba con una cuenta de Secretaría, una de Presidencia y una cuenta sin autorización. Comprueba que las últimas dos reciben 403. Verifica que no se pueden duplicar cuentas para un hermano ni reutilizar alias.
5. La contraseña temporal se muestra una sola vez a Secretaría. No se guarda en Firestore. Debe entregarse al hermano por un canal seguro.

**Importante:** La bandera `passwordChangeRequired` se registra, pero el portal todavía no implementa el flujo que obliga a cambiar la contraseña al primer acceso. **No debe considerarse una protección activa** hasta que se implemente y se verifique ese flujo. La creación puede generar una reserva si el proceso se interrumpe después de reservar y antes de completar el registro; el administrador técnico deberá reconciliar esos casos. No habilitar en producción sin completar las pruebas del Worker.

Firebase Spark y el plan gratuito de Cloudflare tienen límites de uso y cuotas. No requiere activar Blaze, pero Cloudflare es un servicio externo independiente.
