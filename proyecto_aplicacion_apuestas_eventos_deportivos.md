**# Proyecto: Aplicación de Apuestas a Eventos Deportivos en Línea**

**## Objetivo**
**Desarrollar una plataforma web que permita a los usuarios apostar en eventos deportivos en tiempo real, gestionar su saldo y visualizar resultados y estadísticas de manera segura y transparente.**

**## Funcionalidades Principales**
**- Registro e inicio de sesión de usuarios (apostadores y administradores).**
**- Catálogo de eventos deportivos disponibles para apostar (fútbol, tenis, baloncesto, etc.).**
**- Visualización de cuotas y tipos de apuestas (ganador, marcador, etc.).**
**- Realización de apuestas en tiempo real y pre-partido.**
**- Gestión de saldo: depósitos, retiros y movimientos.**
**- Historial de apuestas y resultados.**
**- Panel de usuario para gestión de apuestas, saldo y movimientos.**
**- Panel de administración para gestión de usuarios, eventos, cuotas y reportes.**
**- Notificaciones automáticas sobre resultados, cambios de cuotas y promociones.**

**## Backend (API)**
**- Framework sugerido: .NET Core.**
**- Endpoints RESTful:**
**&#xA0; - \`POST /auth/register\` y \`/auth/login\` — Registro e inicio de sesión.**
**&#xA0; - \`GET /events\` — Listar eventos deportivos disponibles.**
**&#xA0; - \`GET /events/{id}\` — Detalle de evento.**
**&#xA0; - \`POST /bets\` — Realizar apuesta.**
**&#xA0; - \`GET /bets/{userId}\` — Listar apuestas del usuario.**
**&#xA0; - \`POST /balance/deposit\` — Depositar saldo.**
**&#xA0; - \`POST /balance/withdraw\` — Retirar saldo.**
**&#xA0; - \`GET /balance/{userId}\` — Consultar saldo del usuario.**
**&#xA0; - \`POST /reports\` — Generar reportes de apuestas y movimientos.**
**- Websockets para actualización en tiempo real de cuotas y resultados.**
**- Base de datos relacional (ej: SQL Server, PostgreSQL).**
**- Autenticación JWT y roles de usuario.**
**- Pruebas unitarias y de integración.**

**## Frontend**
**- Framework sugerido: Angular, React o Vue.**
**- Funcionalidades:**
**&#xA0; - Catálogo y buscador de eventos deportivos.**
**&#xA0; - Interfaz para realizar apuestas y ver cuotas en tiempo real.**
**&#xA0; - Panel de usuario para gestión de apuestas y saldo.**
**&#xA0; - Panel de administración para gestión global.**

**## Consideraciones**
**- Crear la aplicación con el framework sugerido, puede utilizar tambien otro, incluir validación de datos en frontend y backend. Subir la aplicación al repositorio Github (2)**
**- Utilizar una imagen de contenedor para el backend. (1)**
**- Crear una automatizacion infra,yml para el aprovisionamiento de la infraestructura en el servicio nube de su preferencia utilizándooslo Terraform. (2)**
**- Crear una automatizaciòn sonar.yml para realizar el escaneo del còdigo. El còdigo no debera contener bugs, vulnerabilidades o security hotspots (2)**
**- Crear una automatizacion snyk-semgrep.yml para escanear el còdigo y la imagen del contenedor, no deberan contener vulnerabilidades evidenciando el reporte correspondiente. (2)**
**- Crear automatizacion deploy.yml para desplegar la aplicacion a los servicios nube respectivos. (2)**
**- Crear una automatización generase-documentation.yml que genere el diccionario de datos de la base de datos, diagrama entidad relacion de la base de datos, diagrama de clases, diagrama de componentes, diagramas de despliegue (formato mermaid) de la aplicación. (3)**