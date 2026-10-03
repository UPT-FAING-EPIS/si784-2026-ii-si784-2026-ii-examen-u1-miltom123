const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const database = new DatabaseSync(":memory:");
const schema = fs.readFileSync("database/schema.sql", "utf8");
database.exec(schema);
const tables = database
  .prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);
let dictionary = "",
  relations = "";
for (const table of tables) {
  if (!/^[a-z_]+$/.test(table)) throw new Error("Nombre de tabla inválido");
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  const foreign = database.prepare(`PRAGMA foreign_key_list(${table})`).all();
  dictionary += `\n### ${table}\n\n| Columna | Tipo | Obligatoria | Clave |\n|---|---|---|---|\n`;
  for (const c of columns)
    dictionary += `| ${c.name} | ${c.type} | ${c.notnull || c.pk ? "Sí" : "No"} | ${c.pk ? "PK" : foreign.some((f) => f.from === c.name) ? "FK" : ""} |\n`;
  relations +=
    `  ${table} {\n` +
    columns
      .map(
        (c) =>
          `    ${c.type} ${c.name}${c.pk ? " PK" : foreign.some((f) => f.from === c.name) ? " FK" : ""}\n`,
      )
      .join("") +
    "  }\n";
}
for (const table of tables)
  for (const f of database.prepare(`PRAGMA foreign_key_list(${table})`).all())
    relations += `  ${f.table} ||--o{ ${table} : "${f.from}"\n`;
const types = fs.readFileSync("lib/types.ts", "utf8");
let objects = "",
  classes = "";
for (const match of types.matchAll(
  /export interface (\w+)\s*\{([\s\S]*?)\n\}/g,
)) {
  objects += `\n### Objeto ${match[1]}\n\n\`\`\`typescript\n${match[2].trim()}\n\`\`\`\n`;
  classes += `  class ${match[1]}\n`;
}
classes +=
  '  SportEvent "1" *-- "many" Market\n  Market "1" *-- "many" Outcome\n  User "1" --> "many" Bet\n  Bet "1" *-- "many" BetItem\n  User "1" --> "many" Transaction\n  User "1" --> "many" NotificationItem\n  ReportMetrics --> ReportFilter\n';
const markdown = `# Documentación del sistema BetSport Pro

Documento generado desde database/schema.sql y lib/types.ts. No depende de datos precargados.

## Arquitectura y persistencia

Next.js y React sirven la interfaz y la API REST. El servidor Node.js 24 agrega WebSockets en /ws. SQLite guarda usuarios, eventos, relaciones, apuestas, movimientos y notificaciones. Las tablas son STRICT y activan claves foráneas. WAL y BEGIN IMMEDIATE protegen las operaciones de saldo y liquidación. Los montos disponibles se almacenan en centavos enteros; las instantáneas JSON conservan el objeto utilizado por la API. Los índices y restricciones se muestran en el esquema SQL incluido al final.

La base arranca vacía. El primer registro, elegido dentro de una transacción, es administrador; los siguientes son apostadores. Cada cuenta empieza con cero. Los movimientos son registros del proyecto personal y no invocan redes de pagos. Los cambios de eventos, cuotas y resultados provienen del administrador. No hay fluctuaciones aleatorias.

## Diccionario físico de datos
${dictionary}
Los campos data contienen JSON validado con json_valid. Sus estructuras se detallan abajo: users usa User; events usa SportEvent con mercados y selecciones; bets usa Bet; transactions usa Transaction; notifications usa NotificationItem. Los IDs de mercados, selecciones e ítems se conservan además en tablas relacionadas para las claves foráneas. Las referencias de depósitos y retiros son únicas globalmente y evitan repetir una operación.

## Diccionario de objetos JSON
${objects}
## Diagrama entidad relación

\`\`\`mermaid
erDiagram
${relations}\`\`\`

## Diagrama de clases

\`\`\`mermaid
classDiagram
${classes}\`\`\`

## Diagrama de componentes

\`\`\`mermaid
flowchart LR
  UI[React - catálogo y paneles] --> REST[Next.js API REST]
  UI <--> WS[Node.js WebSocket /ws]
  REST --> AUTH[JWT cookie HttpOnly y roles actuales]
  REST --> DOMAIN[Apuestas - saldo - liquidación - reportes]
  AUTH --> SQL[(SQLite)]
  DOMAIN --> SQL
  WS --> SQL
  ADMIN[Administrador] --> UI
\`\`\`

## Diagrama de despliegue

\`\`\`mermaid
flowchart TB
  Browser[Navegador] -->|HTTPS y WSS| ALB[AWS ALB - certificado ACM]
  ALB -->|HTTP y WS en red VPC| EC2[EC2 - Docker Node.js 24]
  EC2 --> EBS[(EBS cifrado - SQLite persistente)]
  ECR[ECR imagen versionada] --> EC2
  GH[GitHub Actions - OIDC] --> TF[Terraform - estado S3 bloqueado]
  TF --> ALB
  TF --> EC2
  GH --> ECR
  GH --> SSM[SSM despliegue con healthcheck]
  SSM --> EC2
  SECRET[SSM SecureString JWT] --> EC2
  Local[Navegador local] --> Node[Node.js localhost:3000]
  Node --> File[(data/betsport.sqlite)]
\`\`\`

## Reglas de negocio

- Depósitos, retiros y apuestas: importe finito entre 1 y 10000 USD, máximo dos decimales. Saldo nunca negativo.
- Apuestas: de 1 a 20 eventos distintos, mercados activos, selección abierta, cuota explícitamente aceptada vigente. Pre-partidos con fecha futura. Retorno máximo de 1000000 USD.
- Liquidación: exactamente un ganador por mercado. La repetición no paga nuevamente. Una combinada ganadora espera todos los resultados; una selección perdedora la resuelve como perdida.
- Cancelación: devuelve el importe completo de los boletos pendientes que contienen el evento, una sola vez.
- Margen del reporte: importe de apuestas ganadas/perdidas menos premios. No incluye pendientes ni canceladas. Las combinadas se agrupan por el deporte del primer evento para no duplicar importes.
- Promociones: mensajes creados por el administrador y difundidos a los usuarios, sin bonos automáticos.

## API y seguridad

POST /api/auth/register, /api/auth/login y /api/auth/logout; GET /api/auth/me. JWT HS256 válido 8 horas, emisor y audiencia verificados. Cookie HttpOnly, SameSite Strict, Secure configurable en HTTPS. No hay secretos por defecto. Inicio de sesión limitado por correo (20 intentos por 15 minutos, por proceso).

GET /api/events, /api/events/{id}; POST /api/bets; GET /api/bets/{userId}; POST /api/balance/deposit y /api/balance/withdraw; GET /api/balance/{userId}; GET /api/notifications. Las rutas de cuenta comprueban identidad y propiedad; las mutaciones siempre usan al usuario autenticado.

POST /api/reports y GET /api/reports; POST, PUT y DELETE /api/admin/events; POST /api/admin/settle; GET y PUT /api/admin/users; GET /api/admin/stats; POST /api/admin/notifications. Requieren rol administrador vigente en base de datos. Las rutas REST solicitadas sin /api se conservan mediante rewrites. GET /api/events/live-feed solo consulta datos persistidos; /ws es el canal de cambios en tiempo real.

## Esquema SQL de origen

\`\`\`sql
${schema}\`\`\`
`;
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/DOCUMENTACION_SISTEMA.md", markdown);
database.close();
console.log("Documentación generada desde el esquema y los tipos.");
