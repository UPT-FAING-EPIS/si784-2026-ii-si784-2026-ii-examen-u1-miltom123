# Revisión contra el documento de requisitos

Fecha: 2 de octubre de 2026 (America/Lima).

La petición del usuario aclara que se trata de un proyecto personal sin datos precargados. El documento adjunto se usa como especificación funcional; su mención de servicios externos no se interpreta como autorización para publicar o aprovisionar nube ahora.

## Problemas corregidos

- Almacenamiento en memoria que perdía datos: sustituido por SQLite real en disco, tablas STRICT, claves foráneas, WAL y transacciones.
- Usuarios, contraseñas, partidos, marcadores, apuestas, saldos y notificaciones precargados: eliminados.
- Autologin, accesos de prueba, bono de registro y cuotas aleatorias: eliminados.
- Rutas de administración y saldo sin comprobación de JWT: ahora exigen autenticación, propiedad y rol vigente.
- Registro público que aceptaba rol administrador: únicamente el primer registro recibe ese rol; los demás son apostadores.
- Saldo informado con el valor anterior al débito: ahora se consulta el saldo actualizado.
- Apuestas vacías, cuotas desactualizadas, selecciones correlacionadas, números no finitos y doble uso de referencias: rechazados.
- Liquidación incompleta de mercados: requiere un ganador por cada mercado y es idempotente. Cancelación con devolución de boletos pendientes.
- Flujo en vivo que fabricaba cambios: sustituido por WebSockets que publican exclusivamente datos persistidos.
- Flujos de pagos que afirmaban transferir dinero sin proveedor: ahora se identifican como registros de saldo del proyecto personal.
- Docker copiaba una carpeta public inexistente, usaba secreto fijo y configuraba PostgreSQL sin utilizarlo: corregido para Node.js 24 con SQLite en volumen persistente.
- Despliegue Vercel incompatible con archivo persistente y servidor WebSocket: reemplazado por EC2, ECR, ALB y SSM coherentes con Terraform.
- Automatizaciones que ignoraban hallazgos mediante `|| true`: reemplazadas por escaneos que fallan y conservan reportes.
- Documentación que describía tablas no implementadas y afirmaba resultados de escáneres sin evidencia: ahora se genera desde el esquema SQL y los tipos reales.

## Correspondencia

| Requisito | Implementación / estado |
|---|---|
| Registro, login y roles | JWT y cookie HttpOnly; primer usuario administrador; resto apostadores |
| Catálogo y buscador | Filtros por deporte, estado, competidor y liga; estado vacío explícito |
| Mercados y cuotas | Creación de múltiples mercados por administrador; ganador, 1X2, totales, ambos anotan, hándicap, marcador |
| Apuestas pre-partido y en vivo | Boleto simple/combinado con validación de cuota y débito atómico |
| Depósitos, retiros y movimientos | Registros persistidos con referencia única; sin cobros ni transferencias externas |
| Historial, resultados y panel de usuario | Apuestas, selecciones, importes, estado y movimientos consultables por dueño |
| Administración | Usuarios/roles, creación y actualización de eventos y cuotas, liquidación, cancelación y reportes descargables |
| Notificaciones y promociones | Avisos por cambios de cuota, apuesta, saldo y resultado; mensajes globales creados por administrador |
| API REST solicitada | Implementada bajo /api, con rewrites para las rutas originales |
| WebSockets | /ws publica eventos y avisos de la cuenta autenticada; sin datos inventados |
| Base relacional | SQLite con relaciones, restricciones e índices físicos; persistente local y en contenedor |
| Pruebas unitarias e integración | 30 pruebas sin mocks y prueba adicional HTTP/WebSocket/reinicio en base temporal |
| GitHub | Git disponible y cuenta autenticada; esta carpeta no tiene remoto configurado. Pendiente elegir repositorio |
| Imagen de backend | Dockerfile y Compose corregidos; Docker no está instalado en esta máquina, construcción local pendiente |
| infra.yml / Terraform | Red, ALB HTTPS, EC2, IAM, ECR y almacenamiento cifrado; fmt e init/validate ejecutados con éxito; plan AWS pendiente |
| sonar.yml | Cobertura, quality gate y verificación global de cero bugs/vulnerabilidades/hotspots; ejecución externa pendiente de configuración |
| snyk-semgrep.yml | SAST, dependencias e imagen con fallos obligatorios y artefactos; ejecución externa pendiente de configuración |
| deploy.yml | Validación, construcción, publicación ECR y despliegue SSM; pendiente de configurar y ejecutar en AWS |
| generase-documentation.yml | Diccionario del esquema físico/JSON y diagramas ER, clases, componentes y despliegue Mermaid |

## Evidencia local

- TypeScript: verificación correcta.
- Pruebas: 30 aprobadas.
- Build Next.js de producción: correcto.
- Smoke test con HTTP y WebSocket reales: registro, permisos, depósito, apuesta, actualización de cuota, notificación, liquidación repetida y persistencia tras reinicio correctos.
- npm audit: cero vulnerabilidades reportadas en las dependencias instaladas.
- Terraform: proveedor AWS instalado, formato y configuración válidos. Esto no constituye un plan ni un despliegue en AWS.
- Interfaz local: catálogo vacío y conexión en tiempo real confirmados en navegador.

El proyecto queda funcionando localmente. Para acreditar el cumplimiento completo de los apartados de nube y seguridad del examen faltan el remoto de GitHub, servicios/credenciales, construcción de imagen y reportes externos exitosos. No se declaran verificaciones pendientes como aprobadas.
