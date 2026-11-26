# HCSMP: integración Firebase (actualizada con main 4502dcde)

## Estado real

La pantalla de acceso y el dashboard actual usan Firebase. El antiguo proveedor
`components/portal/portal-provider.tsx` sigue siendo una implementación de
demostración local y no es el flujo del dashboard Firebase. La integración
todavía requiere validación operativa y de seguridad antes de datos reales.
El procedimiento de autenticación vigente está en [firebase-auth-setup.md](./firebase-auth-setup.md).

## Padrón Firebase

La ficha permite registrar sexo y si el hermano tiene hijos. Las fichas anteriores
conservan ambos datos como sin registrar hasta que se actualicen. El filtro
Padres incluye varones con hijos y Madres incluye damas con hijos; los datos
desconocidos no se consideran una respuesta negativa.

El padrón combina búsqueda por inicio de nombre completo o DNI, sexo,
padre/madre, edad, categoría, mes de cumpleaños y sacramento recibido. Incluye
vigentes y retirados. Firestore aplica los filtros antes de recuperar cada
página de 10; el PDF consulta todos los resultados filtrados y se genera
localmente en el navegador. Los recuentos se consultan mediante agregaciones.

### Importar el padrón desde Excel

Secretaría puede cargar libros `.xlsx` desde el padrón. El proceso lee todas las
hojas no vacías; cada una debe contener los encabezados del padrón. Revisa las
filas y las coincidencias por nombre y fecha de nacimiento antes de confirmar.
Las filas con errores se excluyen y se muestran para corregirlas en el Excel.
Si una hoja no tiene los encabezados esperados, se detiene la lectura para no
omitir registros. El libro se procesa en el navegador; al confirmar, solo las
fichas seleccionadas se escriben directamente en Firestore.

`ESTATUS` se interpreta como categoría (`activo`, `pasivo`/`vitalicio`,
`aspirante`/`postulante` o `reingresante`); las fichas creadas quedan vigentes.
`ACTIVO - NO RESIDENTE EN HUACHO` mantiene la categoría Activo y marca la
condición de no residente. Las demás fichas se consideran residentes en Huacho
por defecto; Secretaría puede cambiar esta opción desde la ficha.
Un aspirante sin fecha de juramentación es normal y se muestra como «Aún no
juramentó». `V` y `D`
indican varón y dama. En la columna `MADRE`, los valores `MADRE` o `PADRE`
indican que tiene hijos e infieren el género solo si el campo está vacío.
`NO`, vacío o `-` indican que no tiene hijos y no infieren el género. Las fechas
de juramentación vacías o con `-` se tratan como ausentes. Si la categoría no
es postulante, se señala como posible aspirante para revisión sin cambiarla.
Se aceptan fechas con barras o guiones, con día y mes de uno o dos dígitos
(por ejemplo, `28-3-2025`). Las fechas ambiguas se interpretan día/mes/año;
cuando una parte supera 12, se infiere el orden a partir de ese valor. Los
datos del apoderado se guardan en
la ficha solo cuando hay nombre. El `DNI` que aparece bajo `APODERADO` se asigna
al apoderado, no al hermano. Cuando falta el DNI del hermano, la importación
busca posibles coincidencias por nombre y fecha de nacimiento y las excluye
inicialmente; Secretaría debe revisarlas manualmente. El identificador de una
ficha sin DNI es estable para que volver a importar el mismo nombre y fecha no
la sobrescriba ni genere otra ficha. No sustituye una identificación
institucional: agregar el DNI del hermano posteriormente requiere un flujo de
regularización.

El tiempo en la hermandad se calcula desde la fecha de juramentación y no se
guarda como campo independiente. Las columnas `TIENE FICHA` y `TIENE FOTO` son
indicadores; no se importan. La importación no crea usuarios, autorizaciones ni
credenciales. Estado civil y profesión/ocupación son datos de texto opcionales.
Antes de una carga en producción, Secretaría debe revisar las coincidencias y
mantener una copia de respaldo del padrón.

Antes de habilitar esta versión, desplegar las reglas y los índices de
`firestore.rules` y `firestore.indexes.json`, y esperar a que los índices
estén listos. Antes de habilitar el portal, un administrador ejecuta una sola
vez desde una terminal interactiva:

```powershell
node --experimental-strip-types scripts\backfill-roster.ts --project ID_DEL_PROYECTO
```

El proyecto debe coincidir con `NEXT_PUBLIC_FIREBASE_PROJECT_ID` en el entorno,
`.env.local` o `.env`; se solicita el correo y la contraseña de una cuenta activa de
Secretaría sin mostrarlos ni guardarlos. El proceso recorre las fichas antiguas
y añade metadatos mediante transacciones; si se interrumpe puede volver a
ejecutarse. Hasta completarlo, el padrón muestra un aviso de preparación y
bloquea las consultas para evitar resultados incompletos. No deben utilizarse
versiones antiguas del portal durante la migración: las nuevas escrituras
requieren los metadatos y deben actualizarlos cuando cambien los filtros. La
sección Usuarios y accesos todavía carga el padrón completo.

La prueba de integración aislada requiere Firebase CLI y Java 21:

```powershell
firebase emulators:exec --project demo-hcsmp --only firestore "node --experimental-strip-types --test scripts\roster-emulator.test.ts"
```

El emulador no comprueba que los índices compuestos estén desplegados en el
proyecto real; verificarlos antes de habilitar el padrón.

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

Las reglas permiten algunas escrituras controladas. Los usuarios normales no
pueden asignarse roles ni modificar la preautorización de otra persona.

## Activación por etapas

1. Configurar el SDK web y los proveedores de Auth como se indica en
   [firebase-auth-setup.md](./firebase-auth-setup.md).
2. Probar las reglas en emulador, publicarlas y aprovisionar la cuenta inicial.
3. Validar todas las funcionalidades, reglas y operaciones concurrentes que
   todavía no están completas antes de usar datos reales.

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
