# HCSMP Backoffice

Portal interno de demostración para la Hermandad de Cargadores de San Martín de
Porres de Cruz Blanca. Conserva la identidad visual de la maqueta original.

## Desarrollo y validación

Requiere Node.js 22.18+ (o una versión posterior con soporte para ejecutar TypeScript).

```bash
npm ci
npm run dev
```

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

La ruta `/` permite ingresar y `/dashboard` contiene los módulos. No se necesita
configurar un backend ni variables de entorno.

## Cuentas para probar

| Usuario       | Perfil      |
| ------------- | ----------- |
| `secretaria`  | Secretaría  |
| `tesoreria`   | Tesorería   |
| `presidencia` | Presidencia |
| `hermano`     | Estándar    |

La contraseña inicial de estas cuatro cuentas de ejemplo es `Demo2026!`.
Los botones de la pantalla de acceso completan los datos; luego se pulsa
**Iniciar sesión**. Las credenciales de los hermanos nuevos se generan al guardar
su ficha y se muestran al secretario para entregarlas al hermano. El correo es
opcional; también se puede ingresar con él si se registró.

## Registro de hermanos

Solo Secretaría puede abrir **Nuevo hermano** en el padrón. Un modal de pantalla
completa guía el registro: datos personales, información complementaria,
apoderado (solo menores), datos institucionales y revisión del acceso.
Los campos se basan en las fichas de inscripción de mayores y menores.
La foto es opcional. Las firmas de las fichas físicas no se sustituyen por una
firma digital en esta versión.

Al guardar se crean juntos la ficha y el acceso con un usuario único, contraseña
inicial individual y perfil Estándar. No existe un registro sin acceso.
La contraseña puede cambiarse desde **Mi perfil**, proporcionando la actual.
La categoría predeterminada es **Postulante**; Secretaría puede elegir
intencionalmente Activo cuando se cumplan los requisitos.

## Categorías y permisos

La categoría del hermano es independiente del perfil de acceso:

- **Postulante:** periodo de prueba; únicamente perfil Estándar.
- **Activo:** debe ser mayor de edad, superar el periodo de prueba y juramentar.
  El cambio es manual; cumplir 18 años no activa automáticamente al hermano.
- **Vitalicio:** cambio manual cuando cumple 65 años de edad o 30 años desde la
  **fecha de juramentación**, no desde el ingreso. El padrón señala la elegibilidad.

| Módulo                            | Estándar | Tesorería | Secretaría      | Presidencia |
| --------------------------------- | -------- | --------- | --------------- | ----------- |
| Mi perfil y cambio de contraseña  | Propio   | Propio    | Propio          | Propio      |
| Mi estado de cuenta               | Propio   | Propio    | Propio          | Propio      |
| Padrón y fichas                   | —        | —         | Gestiona y crea | Consulta    |
| Ingresos, egresos, cargos y pagos | —        | Gestiona  | —               | Consulta    |
| Deudas generales                  | —        | Consulta  | Consulta        | Consulta    |

Secretaría gestiona manualmente categorías y perfiles desde el padrón. Los
postulantes no pueden tener perfiles administrativos. Cambiar a Postulante
requiere dejar el perfil Estándar. Presidencia no tiene acciones de edición
institucional, pero sí puede actualizar su información personal.

## Datos simulados e integración futura

El proveedor de datos está en `components/portal/portal-provider.tsx`; las reglas,
tipos y operaciones comprobables están en `lib/portal.ts`. Las pantallas usan
este contrato para facilitar su conexión posterior a un servicio de backend.

Los registros se guardan en `localStorage` y la sesión en `sessionStorage` del
mismo navegador y origen. Los accesos creados sirven para probar el flujo en ese
navegador; no son cuentas remotas ni se sincronizan entre dispositivos. Las
contraseñas se guardan como hashes para la demostración. **La validación y los
permisos en el cliente no sustituyen una autenticación y autorización de backend.**
Usar únicamente datos de prueba, sin información personal real. El borrado de los
datos de almacenamiento de este sitio restablece las cuentas de ejemplo.

No se realizó verificación visual automatizada: el entorno no dispone de la
herramienta de navegador gestionado. Las comprobaciones ejecutadas se registran
en la descripción del pull request.
