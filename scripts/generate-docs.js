const fs = require("node:fs");
const ts = require("typescript");
const schema = fs.readFileSync("database/postgres.sql", "utf8");
function splitColumns(input) {
  const result = [];
  let depth = 0,
    quoted = false,
    start = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "'") quoted = !quoted;
    if (quoted) continue;
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) {
      result.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  result.push(input.slice(start).trim());
  return result;
}
const definitions = new Map();
for (const m of schema.matchAll(
  /CREATE TABLE IF NOT EXISTS ([a-z_.]+)\s*\(([\s\S]*?)\);/g,
)) {
  const name = m[1].split(".").pop();
  definitions.set(
    name,
    splitColumns(m[2]).map((column) => {
      const fields = column.split(/\s+/);
      const reference = /REFERENCES [a-z_]+\.(\w+)\((\w+)\)/.exec(column);
      return {
        name: fields[0],
        type: fields[1],
        pk: column.includes("PRIMARY KEY"),
        notnull: column.includes("NOT NULL"),
        reference,
      };
    }),
  );
}
const tables = [...definitions.keys()].sort();
let dictionary = "",
  relations = "";
for (const table of tables) {
  const columns = definitions.get(table);
  dictionary +=
    "\n### " +
    table +
    "\n\n| Columna | Tipo PostgreSQL | Obligatoria | Clave |\n|---|---|---|---|\n";
  relations += "  " + table + " {\n";
  for (const c of columns) {
    let key = "";
    if (c.pk) key = "PK";
    else if (c.reference) key = "FK";
    dictionary +=
      "| " +
      c.name +
      " | " +
      c.type +
      " | " +
      (c.notnull || c.pk ? "Sí" : "No") +
      " | " +
      key +
      " |\n";
    relations += "    " + c.type + " " + c.name + (key ? " " + key : "") + "\n";
  }
  relations += "  }\n";
}
for (const table of tables)
  for (const c of definitions.get(table))
    if (c.reference)
      relations +=
        "  " + c.reference[1] + " ||--o{ " + table + ' : "' + c.name + '"\n';
const types = fs.readFileSync("lib/types.ts", "utf8");
const tree = ts.createSourceFile(
  "lib/types.ts",
  types,
  ts.ScriptTarget.Latest,
  true,
);
const fence = String.fromCharCode(96).repeat(3);
function block(language, text) {
  return "\n" + fence + language + "\n" + text + "\n" + fence + "\n";
}
let objects = "",
  classes = "";
for (const statement of tree.statements) {
  if (!ts.isInterfaceDeclaration(statement)) continue;
  const name = statement.name.text;
  objects +=
    "\n### " + name + "\n" + block("typescript", statement.getText(tree));
  classes += "  class " + name + " {\n";
  for (const member of statement.members)
    if (ts.isPropertySignature(member))
      classes += "    " + member.name.getText(tree) + "\n";
  classes += "  }\n";
}
classes +=
  '  SportEvent "1" *-- "many" Market\n  Market "1" *-- "many" Outcome\n  User "1" --> "many" Bet\n  Bet "1" *-- "many" BetItem\n  User "1" --> "many" Transaction\n  User "1" --> "many" NotificationItem\n';
const components = [
  "flowchart LR",
  "  UI[React catálogo y paneles] --> REST[Next.js API REST]",
  "  UI <-->|WSS| RT[Supabase Realtime contador de cambios]",
  "  REST --> AUTH[JWT cookie HttpOnly y roles actuales]",
  "  REST --> DOMAIN[Apuestas saldo liquidación reportes]",
  "  AUTH --> PG[(PostgreSQL esquema privado)]",
  "  DOMAIN --> PG",
  "  PG --> RT",
].join("\n");
const deployment = [
  "flowchart TB",
  "  Browser[Navegador] -->|HTTPS| VC[Vercel Next.js y API Node 24]",
  "  Browser <-->|WSS| RT[Supabase Realtime]",
  "  VC -->|TLS pooler| PG[(Supabase PostgreSQL esquema privado)]",
  "  PG -->|revisión pública sin datos personales| RT",
  "  GH[GitHub Actions] --> TF[Terraform proveedor Vercel]",
  "  TF --> VC",
  "  GH --> VC",
  "  GH --> IMG[Docker backend validado y escaneado]",
  "  Local[Navegador local] --> Node[Next.js localhost 3000]",
  "  Node -->|TLS| PG",
].join("\n");
const markdown = [
  "# Documentación del sistema BetSport Pro",
  "Generada determinísticamente desde database/postgres.sql y lib/types.ts. No requiere credenciales ni datos de negocio.",
  "## Arquitectura y persistencia",
  "Next.js y React sirven la interfaz y API REST en Vercel con Node.js 24. PostgreSQL en Supabase conserva los datos de negocio en el esquema privado betsport. El pooler comparte conexiones TLS con certificado CA verificado. Las claves foráneas protegen las relaciones. Transacciones y pg_advisory_xact_lock serializan cambios de saldo y liquidación entre instancias. Los montos de saldo se guardan como centavos enteros; JSONB conserva las instantáneas del dominio.",
  "La base comienza sin eventos, cuotas, apuestas, movimientos ni promociones. El primer registro es administrador y cada cuenta empieza con cero. La cuenta solicitada se crea explícitamente con scripts/create-user.cjs y variables privadas. Los movimientos pertenecen al proyecto personal y no ejecutan pagos externos.",
  "Supabase Realtime publica mediante WebSocket únicamente la revisión de cambios de public.betsport_updates, con RLS de solo lectura. La interfaz consulta nuevamente la API autorizada. Recuperación mediante consultas cada 15 segundos. No hay cambios aleatorios ni proveedores simulados.",
  "## Diccionario físico de datos",
  dictionary,
  "Las tablas users, events, markets, outcomes, bets, bet_items, transactions, balance_references y notifications viven en betsport. betsport_updates es la única tabla pública y contiene metadatos de revisión. Las referencias de movimientos son únicas; JSONB contiene los objetos definidos abajo.",
  "## Diccionario de objetos JSON",
  objects,
  "## Diagrama entidad relación",
  block("mermaid", "erDiagram\n" + relations),
  "## Diagrama de clases",
  block("mermaid", "classDiagram\n" + classes),
  "## Diagrama de componentes",
  block("mermaid", components),
  "## Diagrama de despliegue",
  block("mermaid", deployment),
  "## Reglas de negocio",
  "- Importes finitos entre 1 y 10000 USD, hasta dos decimales. Saldo nunca negativo.\n- Apuestas de 1 a 20 eventos distintos con mercados activos, selección abierta y cuota vigente aceptada. Pre-partidos futuros. Retorno máximo de 1000000 USD.\n- Liquidación con un ganador por mercado; las combinadas esperan todos los resultados ganadores y cualquier pérdida las resuelve como perdidas. Nunca se paga nuevamente una liquidación repetida.\n- Cancelar un evento devuelve una sola vez las apuestas pendientes relacionadas.\n- El margen de reportes incluye apuestas ganadas o perdidas menos premios, excluye pendientes y canceladas. Las combinadas se agrupan por el primer deporte.\n- Promociones creadas por el administrador, sin bonos automáticos.",
  "## API y seguridad",
  "POST /api/auth/register, /api/auth/login y /api/auth/logout; GET /api/auth/me. JWT HS256 por 8 horas, emisor y audiencia verificados. Cookie HttpOnly, SameSite Strict, Secure en HTTPS. Sin secretos predeterminados. Límite de login por correo: 20 intentos por 15 minutos por proceso; no es un límite distribuido.",
  "GET /api/events y /api/events/{id}; POST /api/bets; GET /api/bets/{userId}; POST /api/balance/deposit y /api/balance/withdraw; GET /api/balance/{userId}; GET /api/notifications. Las rutas de cuenta comprueban identidad y propiedad.",
  "POST y GET /api/reports; POST, PUT y DELETE /api/admin/events; POST /api/admin/settle; GET y PUT /api/admin/users; GET /api/admin/stats; POST /api/admin/notifications. Rol administrador vigente en la base. Las rutas sin /api solicitadas se conservan mediante rewrites.",
  "## Infraestructura y automatizaciones",
  "infra.yml valida y aplica Terraform al proyecto Vercel existente mediante import. El proyecto se protege con prevent_destroy. Solo administra configuración del proyecto; los secretos se configuran privadamente en Vercel y no están en Terraform. El estado sin secretos se conserva como artefacto y cada ejecución importa el recurso existente.",
  "deploy.yml valida tipos, pruebas, dependencias, build, HTTP y contenedor; despliega por ejecución manual a producción. sonar.yml analiza el código y exige además cero bugs, vulnerabilidades y hotspots globales. snyk-semgrep.yml genera reportes de código, dependencias y contenedor, y falla cuando hay hallazgos o faltan credenciales. generase-documentation.yml genera este documento y verifica que esté actualizado.",
  "## Esquema PostgreSQL de origen",
  block("sql", schema),
].join("\n\n");
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/DOCUMENTACION_SISTEMA.md", markdown);
console.log(
  "Diccionario PostgreSQL y cuatro diagramas Mermaid generados: " +
    tables.length +
    " tablas.",
);
