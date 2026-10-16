# ⚖️ HerAlf Legal MVP — Infrastructure as Code

> MVP de plataforma legal con formulario de captación de leads, panel de administración para abogados y notificaciones vía WhatsApp. Infraestructura desplegada en **AWS** con **Terraform**.

[![Terraform](https://img.shields.io/badge/Terraform-~%3E%205.0-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![AWS](https://img.shields.io/badge/AWS-S3%20%7C%20Lambda%20%7C%20API%20Gateway%20%7C%20DynamoDB-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Private-red.svg)](#-licencia)

> 🚧 **Proyecto en desarrollo activo (MVP).** La infraestructura evoluciona rápidamente; los recursos pueden cambiar entre versiones.

---

## 📋 Tabla de contenidos

- [Descripción](#-descripción)
- [Arquitectura](#-arquitectura)
- [Stack tecnológico](#-stack-tecnológico)
- [Recursos de AWS creados](#-recursos-de-aws-creados)
- [Requisitos previos](#-requisitos-previos)
- [Configuración de credenciales AWS](#-configuración-de-credenciales-aws)
- [Variables de Terraform](#-variables-de-terraform)
- [Cómo desplegar](#-cómo-desplegar)
- [Ambientes](#-ambientes)
- [Endpoints de la API](#-endpoints-de-la-api)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [💰 Costos estimados](#-costos-estimados)
- [Cómo destruir la infraestructura](#-cómo-destruir-la-infraestructura)
- [Seguridad](#-seguridad)
- [Roadmap](#-roadmap)
- [Autor](#-autor)

---

## 📖 Descripción

**HerAlf Legal MVP** es una plataforma mínima viable para la captación y gestión de leads legales. El sistema consta de:

1. **Landing page pública** (`www.heralf-legal.com`) con formulario de contacto.
2. **Panel de administración** (`admin.heralf-legal.com`) para que los abogados gestionen los casos recibidos.
3. **Bot de WhatsApp** que notifica a los abogados cuando ingresa un nuevo lead.
4. **API REST** que conecta el frontend con las funciones Lambda y DynamoDB.

Toda la infraestructura se despliega con **Terraform**, permitiendo entornos reproducibles y versionados.

---

## 🏛 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USUARIO FINAL                               │
│                    (Navegador / WhatsApp)                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │ CloudFront│   │ CloudFront│   │ WhatsApp  │
            │  (www)    │   │  (admin)  │   │    Bot    │
            └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                  │               │               │
                  ▼               ▼               │
            ┌───────────┐   ┌───────────┐         │
            │  S3 Bucket│   │  S3 Bucket│         │
            │ (landing) │   │  (admin)  │         │
            └───────────┘   └───────────┘         │
                  │               │               │
                  └───────┬───────┘               │
                          ▼                       │
                  ┌───────────────┐               │
                  │  API Gateway  │◄──────────────┘
                  │   (REST)      │
                  └───────┬───────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
    ┌───────────┐ ┌───────────┐ ┌───────────┐
    │  Lambda   │ │  Lambda   │ │  Lambda   │
    │form-      │ │case-      │ │authorizer │
    │processor  │ │manager    │ │           │
    └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
          │             │             │
          ▼             ▼             ▼
    ┌───────────────────────────────────────┐
    │           DynamoDB                    │
    │  ┌─────────────┐  ┌─────────────┐    │
    │  │ heralf-     │  │ heralf-     │    │
    │  │ leads       │  │ abogados    │    │
    │  └─────────────┘  └─────────────┘    │
    └───────────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │   Cognito     │
                  │  (User Pool)  │
                  └───────────────┘
```

---

## 🛠 Stack tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| **IaC** | Terraform | `~> 5.0` (AWS Provider) |
| **Compute** | AWS Lambda | Node.js 18.x |
| **API** | AWS API Gateway | REST API |
| **Base de datos** | AWS DynamoDB | PAY_PER_REQUEST |
| **Almacenamiento** | AWS S3 | Website hosting |
| **CDN** | AWS CloudFront | PriceClass_100 |
| **Auth** | AWS Cognito | User Pool |
| **Certificado SSL** | AWS ACM | — |
| **Frontend** | HTML/CSS/JS | Estático |

---

## ☁️ Recursos de AWS creados

Terraform crea y gestiona los siguientes recursos:

| Recurso | Tipo | Descripción |
|---|---|---|
| `aws_s3_bucket.website` | S3 | Bucket para la landing page |
| `aws_s3_bucket_website_configuration` | S3 | Configuración de hosting estático |
| `aws_s3_bucket_policy` | S3 | Política de acceso público |
| `aws_s3_object.website_files` | S3 | Subida de archivos HTML/CSS/JS |
| `aws_cloudfront_distribution.website` | CloudFront | CDN para admin.heralf-legal.com |
| `aws_cloudfront_distribution.public_website` | CloudFront | CDN para www.heralf-legal.com |
| `aws_cloudfront_origin_access_identity` | CloudFront | OAI para acceso a S3 |
| `aws_lambda_function.form_processor` | Lambda | Procesa formularios de contacto |
| `aws_lambda_function.case_manager` | Lambda | Gestiona casos para abogados |
| `aws_lambda_function.authorizer` | Lambda | Autorización Cognito para admin |
| `aws_api_gateway_rest_api.main` | API Gateway | API REST principal |
| `aws_api_gateway_resource.formulario` | API Gateway | Recurso `/formulario` |
| `aws_api_gateway_resource.cases` | API Gateway | Recurso `/cases` |
| `aws_api_gateway_resource.cases_id` | API Gateway | Recurso `/cases/{id}` |
| `aws_api_gateway_resource.cases_id_assign` | API Gateway | Recurso `/cases/{id}/assign` |
| `aws_api_gateway_resource.cases_id_status` | API Gateway | Recurso `/cases/{id}/status` |
| `aws_api_gateway_method` (varios) | API Gateway | Métodos POST, GET, PUT, OPTIONS |
| `aws_api_gateway_integration` (varios) | API Gateway | Integraciones con Lambda |
| `aws_dynamodb_table.leads` | DynamoDB | Tabla de leads (formularios) |
| `aws_dynamodb_table.abogados` | DynamoDB | Tabla de abogados con GSI |
| `aws_cognito_user_pool.abogados` | Cognito | User Pool para autenticación |
| `aws_cognito_user_pool_client.abogados` | Cognito | Cliente de aplicación |
| `aws_iam_role.lambda_role` | IAM | Rol para las Lambdas |
| `aws_lambda_permission` (varios) | Lambda | Permisos de invocación desde API GW |

---

## ✅ Requisitos previos

| Herramienta | Verificar con |
|---|---|
| [Terraform](https://developer.hashicorp.com/terraform/downloads) `>= 1.5` | `terraform -version` |
| [AWS CLI](https://aws.amazon.com/cli/) `>= 2.x` | `aws --version` |
| Cuenta de AWS con permisos de administrador | — |

---

## 🔐 Configuración de credenciales AWS

### Opción A — AWS CLI (recomendada)

```bash
aws configure
```

Te va a pedir:
- **AWS Access Key ID**
- **AWS Secret Access Key**
- **Default region name**: `us-east-1`
- **Default output format**: `json`

### Opción B — Variables de entorno

```bash
# Linux/Mac
export AWS_ACCESS_KEY_ID="tu_access_key"
export AWS_SECRET_ACCESS_KEY="tu_secret_key"
export AWS_DEFAULT_REGION="us-east-1"

# Windows PowerShell
$env:AWS_ACCESS_KEY_ID="tu_access_key"
$env:AWS_SECRET_ACCESS_KEY="tu_secret_key"
$env:AWS_DEFAULT_REGION="us-east-1"
```

### Opción C — Perfil específico

```bash
export AWS_PROFILE="heralft"
```

> ⚠️ **NUNCA** commitees credenciales de AWS al repositorio. El `.gitignore` ya excluye `.aws/`, `.env` y `*.pem`.

---

## ⚙️ Variables de Terraform

Actualmente el proyecto usa una sola variable:

| Variable | Tipo | Default | Descripción |
|---|---|---|---|
| `aws_region` | `string` | `us-east-1` | Región de AWS donde se despliegan los recursos |

### Cómo sobrescribir variables

**Opción A** — Archivo `terraform.tfvars` (recomendado, **está en `.gitignore`**):

```hcl
aws_region = "us-east-1"
```

**Opción B** — Línea de comandos:

```bash
terraform apply -var="aws_region=us-east-1"
```

> 📌 **Nota:** El certificado ACM y los dominios están actualmente hardcodeados en `main.tf`. Se recomienda migrarlos a variables para mayor flexibilidad.

---

## 🚀 Cómo desplegar

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/Hsolorzano1987/heralft-mvp.git
cd heralft-mvp
```

### Paso 2 — Compilar las Lambdas

Antes de aplicar Terraform, empaquetá las funciones Lambda en archivos `.zip`:

```bash
# Form Processor
cd backend/form-processor
npm install
zip -r ../../infra/form-processor.zip index.js node_modules
cd ../..

# Case Manager
cd backend/case-manager
npm install
zip -r ../../infra/case-manager.zip index.js node_modules
cd ../..
```

> ⚠️ **Windows:** usá `Compress-Archive` en PowerShell o instalá `zip` vía Git Bash/WSL.

### Paso 3 — Inicializar Terraform

```bash
cd infra
terraform init
```

### Paso 4 — Revisar el plan

```bash
terraform plan
```

Revisá **cuidadosamente** qué recursos se van a crear, modificar o destruir.

### Paso 5 — Aplicar

```bash
terraform apply
```

Escribí `yes` cuando te lo pida. El proceso tarda ~2-5 minutos.

### Paso 6 — Verificar

```bash
terraform output
```

Si no hay outputs definidos, verificá manualmente:

```bash
# Listar buckets
aws s3 ls

# Listar funciones Lambda
aws lambda list-functions

# Listar APIs
aws apigateway get-rest-apis
```

---

## 🌍 Ambientes

El proyecto usa **Terraform Workspaces** para separar entornos:

| Workspace | Sufijo | CORS | Dominios |
|---|---|---|---|
| `default` | *(vacío)* | `https://admin.heralf-legal.com` | `www.heralf-legal.com`, `heralf-legal.com` |
| `qa` | `-qa` | `*` (abierto para pruebas) | — |

### Crear el workspace QA

```bash
terraform workspace new qa
terraform workspace select qa
terraform apply
```

### Listar workspaces

```bash
terraform workspace list
```

### Cambiar entre entornos

```bash
# Volver a producción
terraform workspace select default
```

> 💡 **Tip:** El nombre del bucket S3 incluye un sufijo aleatorio (`random_id`) y el sufijo del workspace, así que los recursos de QA y prod **no colisionan**.

---

## 🌐 Endpoints de la API

| Método | Endpoint | Descripción | Lambda |
|---|---|---|---|
| `POST` | `/formulario` | Recibe datos del formulario de contacto | `form-processor` |
| `OPTIONS` | `/formulario` | Preflight CORS | `form-processor` |
| `GET` | `/cases` | Lista todos los casos (con filtros) | `case-manager` |
| `GET` | `/cases/{id}` | Obtiene un caso específico | `case-manager` |
| `PUT` | `/cases/{id}/assign` | Asigna un caso a un abogado | `case-manager` |
| `PUT` | `/cases/{id}/status` | Actualiza el estado de un caso | `case-manager` |
| `OPTIONS` | `/cases` | Preflight CORS | `case-manager` |
| `OPTIONS` | `/cases/{id}/status` | Preflight CORS | `case-manager` |

### Filtros disponibles en `GET /cases`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `servicio` | `string` | Filtrar por tipo de servicio legal |
| `status` | `string` | Filtrar por estado del caso |

**Ejemplo:**

```
GET /cases?servicio=divorcio&status=nuevo
```

---

## 🗂 Estructura del proyecto

```
heralft-mvp/
├── backend/
│   ├── form-processor/          # Lambda: procesa formularios
│   │   ├── index.js
│   │   └── package.json
│   └── case-manager/            # Lambda: gestiona casos
│       ├── index.js
│       └── package.json
├── infra/
│   ├── main.tf                  # Recursos principales de Terraform
│   ├── variables.tf             # Variables de entrada
│   ├── template.json            # Plantilla de API Gateway
│   ├── admin-prod.html          # Panel admin (producción)
│   ├── admin-qa-s3.html         # Panel admin (QA)
│   └── admin-descargado.html    # Panel admin (descargado)
├── src/
│   ├── assets/                  # Recursos estáticos (CSS, JS, imágenes)
│   ├── index.html               # Landing page pública
│   ├── admin.html               # Panel de administración
│   └── error.html               # Página de error
├── .gitignore
├── index.html.check             # ⚠️ Archivo temporal
├── index.html.temp              # ⚠️ Archivo temporal
└── README.md
```

---

## 💰 Costos estimados

> ⚠️ **ADVERTENCIA:** Desplegar esta infraestructura en AWS **genera costos**. Asegurate de entender la [calculadora de precios de AWS](https://calculator.aws/) antes de aplicar.

| Servicio | Free Tier | Costo estimado (uso bajo) |
|---|---|---|
| **S3** | 5 GB almacenamiento | ~$0.10/mes |
| **CloudFront** | 1 TB transferencia | ~$0.00 - $1.00/mes |
| **Lambda** | 1M invocaciones/mes | $0.00 (dentro del Free Tier) |
| **API Gateway** | 1M llamadas/mes (12 meses) | ~$0.00 - $3.50/mes |
| **DynamoDB** | 25 GB + 25 WCU/RCU | $0.00 (dentro del Free Tier) |
| **Cognito** | 50K MAU | $0.00 (dentro del Free Tier) |
| **ACM** | Certificados públicos | $0.00 |

**Total estimado con uso bajo:** **~$0 - $5 USD/mes** (la mayoría de servicios entran en Free Tier).

> 💡 **Recomendación:** Si solo estás probando, usá `terraform destroy` al terminar para evitar cargos inesperados.

---

## 🧹 Cómo destruir la infraestructura

Para eliminar **todos** los recursos creados por Terraform:

```bash
cd infra
terraform destroy
```

Escribí `yes` cuando te lo pida. Esto elimina:

- ✅ Buckets S3 (si están vacíos)
- ✅ Distribuciones CloudFront
- ✅ Funciones Lambda
- ✅ API Gateway
- ✅ Tablas DynamoDB
- ✅ User Pool de Cognito
- ✅ Roles IAM

> ⚠️ **Importante:** CloudFront tarda ~15-20 minutos en destruirse por completo. Si un bucket S3 tiene objetos, Terraform puede fallar; en ese caso vacialo manualmente y volvé a intentar.

---

## 🔒 Seguridad

### ✅ Buenas prácticas implementadas

- `.gitignore` excluye `*.tfstate`, `*.tfvars`, `.terraform/` y credenciales.
- CORS configurado con orígenes específicos en producción.
- Autenticación con Cognito para el panel de abogados.
- Roles IAM con permisos mínimos (DynamoDB solo para las tablas necesarias).
- HTTPS forzado en CloudFront (`redirect-to-https`).
- TLS 1.2 mínimo en el certificado SSL.

### ⚠️ Pendientes / mejoras sugeridas

- [ ] Mover el **ARN del certificado ACM** a una variable de Terraform.
- [ ] Mover los **dominios** (`www.heralf-legal.com`, etc.) a variables.
- [ ] Configurar **backend remoto** para el state de Terraform (S3 + DynamoDB lock).
- [ ] Eliminar archivos temporales del repositorio (`*.check`, `*.temp`, `*.tmp`).
- [ ] Agregar **WAF** a CloudFront si el tráfico crece.
- [ ] Rotar credenciales de AWS periódicamente.

---

## 🗺 Roadmap

> 🚧 **Proyecto en desarrollo activo (MVP).**

- [x] Landing page con formulario de contacto.
- [x] API Gateway + Lambda para procesar formularios.
- [x] DynamoDB para almacenar leads.
- [x] Panel de administración para abogados.
- [x] Autenticación con Cognito.
- [x] CDN con CloudFront + SSL.
- [x] Entorno QA con Terraform Workspaces.
- [ ] Bot de WhatsApp para notificaciones.
- [ ] Backend remoto para Terraform State.
- [ ] CI/CD con GitHub Actions.
- [ ] Tests automatizados de la API.
- [ ] Monitoreo con CloudWatch Alarms.

---

## 👤 Autor

**Hernán Solórzano** — [@Hsolorzano1987](https://github.com/Hsolorzano1987)

---

<p align="center">
  Hecho con ❤️ usando <a href="https://www.terraform.io/">Terraform</a> + <a href="https://aws.amazon.com/">AWS</a>
</p>
