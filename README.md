# BetSport Pro — Milton H Flores Chino

Aplicación personal de apuestas deportivas con Next.js 16, React, TypeScript, PostgreSQL en Supabase, JWT y Supabase Realtime. Sin eventos, cuotas, apuestas, saldos ni promociones precargados. Los registros de saldo no ejecutan cobros o transferencias externas.

## Ejecución

Requiere Node.js 24. Configura las variables descritas en .env.example dentro de .env.local (excluido de Git), ejecuta npm ci, npm run db:migrate, npm run build y npm start. Abre http://localhost:3000.

La primera cuenta registrada será administradora y comenzará con saldo cero. Los demás registros serán apostadores. El administrador puede gestionar eventos, cuotas, usuarios, resultados y reportes. La cuenta de acceso solicitada se crea en Supabase mediante configuración privada, sin credenciales en el código.

## Verificación

npm run typecheck; npm test; npm audit --audit-level=low; npm run build.

Las pruebas crean sus datos en bases temporales SQLite aisladas. La aplicación local y Vercel utilizan exclusivamente Supabase, sin fallback a datos de prueba. PostgreSQL serializa cambios de saldo y liquidación mediante transacciones y un bloqueo compartido. Los datos de usuario están en un esquema privado; Realtime publica únicamente un contador de cambios y la interfaz vuelve a consultar la API autenticada.

## Despliegue

Proyecto Vercel: betsport-pro-milton-flores. Variables necesarias: JWT_SECRET, SUPABASE_DB_PASSWORD (o DATABASE_URL), NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y COOKIE_SECURE=true. La contraseña PostgreSQL permanece en variables privadas de Vercel. El certificado CA de Supabase se incluye para validar TLS.

Repositorio: https://github.com/UPT-FAING-EPIS/si784-2026-ii-si784-2026-ii-examen-u1-miltom123

La documentación técnica y los diagramas Mermaid están en docs/DOCUMENTACION_SISTEMA.md. Los escaneos externos y la evidencia Sonar se completan después de la publicación, según la última instrucción del usuario.
