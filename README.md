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

El formulario separa nombres, primer apellido y segundo apellido. Al guardar se
crean juntos la ficha y el acceso: el usuario usa el primer nombre y primer
apellido (`nombre.apellido`); si ya existe, se añade el segundo apellido y, si
aún coincide, un sufijo numérico. La contraseña inicial es individual y el
perfil de acceso Estándar. No existe un registro sin acceso.
La contraseña puede cambiarse desde **Mi perfil**, proporcionando la actual.
La categoría predeterminada es **Postulante**; Secretaría puede elegir
intencionalmente **Activo** cuando se cumplan los requisitos o **Reingresante**
para registrar un hermano que vuelve en periodo de prueba y todavía no tiene
ficha en el portal. Si ya existe como retirado, debe registrarse su reingreso
desde su ficha para evitar duplicados.

## Categorías y permisos

La categoría del hermano es independiente del perfil de acceso:

- **Postulante:** periodo de prueba; únicamente perfil Estándar.
- **Activo:** debe ser mayor de edad, superar el periodo de prueba y juramentar.
  El cambio es manual; cumplir 18 años no activa automáticamente al hermano.
- **Reingresante:** adulto en periodo de prueba para recuperar la categoría
  Activo. Tiene perfil Estándar; Secretaría registra el cambio manual cuando
  supera la prueba, sin modificar su fecha original de ingreso ni juramentación.
- **Vitalicio:** cambio manual cuando cumple 65 años de edad o 30 años desde la
  **fecha de juramentación**, no desde el ingreso. El padrón señala la elegibilidad.

| Módulo                            | Estándar | Tesorería | Secretaría      | Presidencia |
| --------------------------------- | -------- | --------- | --------------- | ----------- |
| Mi perfil y cambio de contraseña  | Propio   | Propio    | Propio          | Propio      |
| Mi estado de cuenta               | Propio   | Propio    | Propio          | Propio      |
| Padrón y fichas                   | —        | —         | Gestiona y crea | Consulta    |
| Ingresos, egresos, cargos y pagos | —        | Gestiona  | —               | Consulta    |
| Deudas generales                  | —        | —         | Consulta        | —           |
| Solicitudes                       | Propias  | Propias   | Gestiona todas  | Propias     |

Tesorería registra las cuotas ordinarias como cargos al iniciar el mes
siguiente: S/ 10 mensuales para Activos y Reingresantes, y 50% para
Postulantes. Vitalicios están exonerados. Las cuotas extraordinarias son fijas
(S/ 10 con vencimiento el 6 de mayo y S/ 20 el 3 de noviembre); también se
registran S/ 200 por reingreso. La cuota ordinaria puede actualizarse y el nuevo
monto se aplica desde el próximo mes, sin alterar cargos existentes. El resumen
mensual de caja muestra ingresos, pagos y egresos por separado, excluye cargos
no cobrados y permite descargar un PDF con subtotales y total neto de caja.
Los cargos automáticos comienzan en el mes de inicio de facturación guardado en
la configuración local; los cambios de importe conservan su fecha efectiva.
El módulo de Tesorería organiza su contenido en Resumen, Movimientos, Cuotas y
cobranzas, y Reportes; cada sección tiene un enlace directo y Deudas generales
se mantiene como módulo independiente.

Todos los perfiles tienen acceso al módulo Solicitudes. Los perfiles distintos
de Secretaría pueden enviar solicitudes con título y detalle, y consultar el
estado de las propias. Secretaría ve todas las solicitudes y puede cambiar su
estado entre Enviada, En revisión, Derivada y Resuelta.

Secretaría gestiona manualmente categorías y perfiles desde el padrón. Los
postulantes y reingresantes no pueden tener perfiles administrativos. Cambiar
a cualquiera de estas categorías requiere dejar el perfil Estándar. Presidencia no tiene acciones de edición
institucional, pero sí puede actualizar su información personal.

## Ficha, descargas y retirados

**Ver ficha** abre un modal de pantalla completa en modo detalle. Secretaría
puede pulsar **Habilitar edición**; Presidencia conserva una vista de consulta.
Cancelar o cerrar no guarda los cambios pendientes. Al guardar se vuelve al
detalle actualizado.

Cada fila del padrón permite **Descargar ficha**, también disponible en el
modal. La descarga produce un PDF rellenado usando los formatos originales
aportados: el de menores incluye al apoderado; desde los 18 años se utiliza el de
mayores. Conserva la identidad del formato y los espacios para firmas manuales.
Los botones de descarga permiten generar el padrón completo del listado abierto
o solo los resultados de la búsqueda y filtros aplicados (vigentes o retirados,
categoría y mayores o menores de edad). El PDF incluye nombre, DNI, edad,
categoría, estado, fechas de ingreso y juramentación, y celular; puede abarcar
varias páginas. La generación se realiza localmente en el navegador.
Las bases PDF se distribuyen en `public/templates/`, derivadas de las fichas
Word originales. La fuente tipográfica se incluye en `public/fonts/` con su
licencia. La generación del PDF se realiza
en el navegador, sin enviar datos a un backend. Los datos demasiado largos para
el espacio del formato se conservan completos en un anexo legible del PDF.

Para regenerar las bases desde los Word originales, se necesita Python con
`lxml` y `PyMuPDF`, además de LibreOffice (`soffice`). Estas herramientas se usan
solo para preparar los formatos; no son dependencias del portal en producción.

```bash
python scripts/prepare-member-templates.py "mayores.docx" "menores.docx" --pdf --coordinates /tmp/fichas-coordinates.json
```

Si cambia la disposición del formato, las coordenadas generadas permiten
actualizar `pdfLayouts` en `lib/member-document.ts`.

**Retirado** es un estado independiente de la categoría. Los retirados se
conservan en el almacenamiento, pero se excluyen del padrón vigente y de sus
contadores. Se consultan desde la opción **Retirados**. Secretaría puede
registrar el retiro desde la ficha: se suspende el acceso al portal y se cierra
cualquier sesión abierta al sincronizar el cambio. La ficha, cuenta, fechas y
movimientos no se eliminan. Las deudas permanecen visibles en Tesorería para
conservar la trazabilidad contable.

**Registrar reingreso** reutiliza esa misma ficha y cuenta, reactiva el acceso y
asigna la categoría Reingresante y el perfil Estándar. No genera otra contraseña
ni duplica al hermano. Si quien vuelve es menor de edad, se reactiva como
Postulante con perfil Estándar, conservando los datos del apoderado. El historial registra los retiros y reingresos; la fecha
de juramentación original sigue siendo la referencia para los 30 años de
Vitalicio. Los datos locales de la versión anterior se migran automáticamente,
sin reiniciar el padrón ni las contraseñas.

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

Las fichas PDF se renderizaron y revisaron para mayores, menores con apoderado,
fotografía y datos largos. No se realizaron pruebas de interacción de las
pantallas en un navegador: el entorno no dispone de la herramienta de navegador
gestionado. Las comprobaciones ejecutadas se registran en la descripción del
pull request.
