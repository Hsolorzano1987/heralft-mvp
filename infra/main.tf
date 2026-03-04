# main.tf - VERSIÓN COMPLETA CON CLOUDFRONT Y POLÍTICA DE BUCKET
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Random suffix para nombres únicos
resource "random_id" "suffix" {
  byte_length = 4
}

# Local values
locals {
  bucket_name = "heralft-mvp-${random_id.suffix.hex}"
  
  tags = {
    Name        = "heralft-mvp"
    Environment = "production"
    Project     = "heralft-mvp"
  }
}

# ===== S3 BUCKET =====
resource "aws_s3_bucket" "website" {
  bucket = local.bucket_name
  tags   = local.tags
}

# Configuración de hosting estático
resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.bucket
  index_document { suffix = "index.html" }
  error_document { key = "error.html" }
}

# PRIMERO: Desbloquear el bucket (PERMITIR políticas públicas)
resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.bucket

  block_public_acls       = false
  block_public_policy     = false  # ← ESTO DEBE SER false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# LUEGO: Aplicar la política (después del desbloqueo)
resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.bucket
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.website.arn}/*"
      },
      {
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.website.iam_arn
        }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.website.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.website]  # ← IMPORTANTE
}

# DESPUÉS: Subir archivos (depende de la política)
resource "aws_s3_object" "website_files" {
  depends_on = [aws_s3_bucket_policy.website]  # ← IMPORTANTE
  for_each = fileset("../src/", "**/*.{html,css,js}")

  bucket = aws_s3_bucket.website.bucket
  key    = each.value
  source = "../src/${each.value}"
  etag   = filemd5("../src/${each.value}")

  content_type = lookup({
    "html" = "text/html",
    "css"  = "text/css",
    "js"   = "application/javascript"
  }, reverse(split(".", each.value))[0], "application/octet-stream")
}

# ============================================
# 2. CLOUDFRONT - CDN para el sitio web
# ============================================
resource "aws_cloudfront_origin_access_identity" "website" {
  comment = "Acceso a S3 para heralft-mvp"
}

resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront para heralft-mvp"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"  # Más económico

  origin {
    domain_name = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.website.bucket}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.website.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.website.bucket}"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # Manejo de errores para SPA
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true  # Certificado SSL gratuito
  }

  tags = local.tags
}

# ============================================
# 3. DYNAMODB - Tabla para leads
# ============================================
resource "aws_dynamodb_table" "leads" {
  name         = "heralft-leads-mvp"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "telefono"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "fecha"
    type = "S"
  }

  global_secondary_index {
    name            = "TelefonoIndex"
    hash_key        = "telefono"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "FechaIndex"
    hash_key        = "fecha"
    projection_type = "ALL"
  }

  tags = local.tags
}

# ============================================
# 4. IAM ROLE Y POLÍTICAS para Lambda
# ============================================
resource "aws_iam_role" "lambda_role" {
  name = "heralft-mvp-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "heralft-mvp-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",        # ← NUEVO: necesario para listar casos
          "dynamodb:DeleteItem"    # ← OPCIONAL: por si quieres eliminar casos después
        ]
        Resource = aws_dynamodb_table.leads.arn

      }
    ]
  })
}

# ============================================
# 5. LAMBDA - Procesador de formularios
# ============================================
resource "aws_lambda_function" "form_processor" {
  filename         = "form-processor.zip"
  function_name    = "heralft-mvp-form-processor"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.leads.name
    }
  }

  tags = local.tags
}

# ============================================
# LAMBDA - Gestor de casos para abogados (NUEVA)
# ============================================
resource "aws_lambda_function" "case_manager" {
  filename         = "case-manager.zip"
  function_name    = "heralft-mvp-case-manager"
  role            = aws_iam_role.lambda_role.arn  # Reutiliza el mismo rol
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.leads.name
    }
  }

  tags = local.tags
}

# ============================================
# 6. API GATEWAY - REST API para el formulario
# ============================================
resource "aws_api_gateway_rest_api" "main" {
  name        = "heralft-mvp-api"
  description = "API MVP para HerAlf Legal"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.tags
}

# Recurso /formulario
resource "aws_api_gateway_resource" "formulario" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "formulario"
}

# Método POST
resource "aws_api_gateway_method" "post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.formulario.id
  http_method   = "POST"
  authorization = "NONE"
}

# Integración con Lambda
resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.formulario.id
  http_method = aws_api_gateway_method.post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.form_processor.invoke_arn
}

# Método OPTIONS para CORS
resource "aws_api_gateway_method" "options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.formulario.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Integration para OPTIONS
resource "aws_api_gateway_integration" "options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.formulario.id
  http_method = aws_api_gateway_method.options.http_method

  type = "MOCK"
  
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# Method response para OPTIONS
resource "aws_api_gateway_method_response" "options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.formulario.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# Integration response para OPTIONS
resource "aws_api_gateway_integration_response" "options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.formulario.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = aws_api_gateway_method_response.options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options]
}

# Deployment
resource "aws_api_gateway_deployment" "production" {
  depends_on = [
    aws_api_gateway_integration.lambda,
    aws_api_gateway_integration.options,
    aws_api_gateway_integration.cases_get,           # ← NUEVO
    aws_api_gateway_integration.cases_id_get,        # ← NUEVO
    aws_api_gateway_integration.cases_id_assign_put, # ← NUEVO
    aws_api_gateway_integration.cases_id_status_put  # ← NUEVO
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = "production"

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.formulario,
      aws_api_gateway_method.post,
      aws_api_gateway_method.options,
      aws_api_gateway_integration.lambda,
      aws_api_gateway_integration.options,
      aws_api_gateway_resource.cases,                 # ← NUEVO
      aws_api_gateway_resource.cases_id,              # ← NUEVO
      aws_api_gateway_resource.cases_id_assign,       # ← NUEVO
      aws_api_gateway_resource.cases_id_status,       # ← NUEVO
      aws_api_gateway_method.cases_get,               # ← NUEVO
      aws_api_gateway_method.cases_id_get,            # ← NUEVO
      aws_api_gateway_method.cases_id_assign_put,     # ← NUEVO
      aws_api_gateway_method.cases_id_status_put      # ← NUEVO
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Permiso para que API Gateway invoque Lambda
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.form_processor.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.main.execution_arn}/*/POST/formulario"
}

# ============================================
# API GATEWAY - Recursos para gestión de casos (NUEVOS)
# ============================================

# Recurso /cases
resource "aws_api_gateway_resource" "cases" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "cases"
}

# GET /cases
resource "aws_api_gateway_method" "cases_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.cases.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cases_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.cases.id
  http_method = aws_api_gateway_method.cases_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.case_manager.invoke_arn
}

# Recurso /cases/{id}
resource "aws_api_gateway_resource" "cases_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.cases.id
  path_part   = "{id}"
}

# GET /cases/{id}
resource "aws_api_gateway_method" "cases_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.cases_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cases_id_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.cases_id.id
  http_method = aws_api_gateway_method.cases_id_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.case_manager.invoke_arn
}

# Recurso /cases/{id}/assign
resource "aws_api_gateway_resource" "cases_id_assign" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.cases_id.id
  path_part   = "assign"
}

# PUT /cases/{id}/assign
resource "aws_api_gateway_method" "cases_id_assign_put" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.cases_id_assign.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cases_id_assign_put" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.cases_id_assign.id
  http_method = aws_api_gateway_method.cases_id_assign_put.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.case_manager.invoke_arn
}

# Recurso /cases/{id}/status
resource "aws_api_gateway_resource" "cases_id_status" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.cases_id.id
  path_part   = "status"
}

# PUT /cases/{id}/status
resource "aws_api_gateway_method" "cases_id_status_put" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.cases_id_status.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cases_id_status_put" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.cases_id_status.id
  http_method = aws_api_gateway_method.cases_id_status_put.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.case_manager.invoke_arn
}

# ============================================
# PERMISOS para que API Gateway invoque la Lambda
# ============================================
resource "aws_lambda_permission" "case_manager_api_gw" {
  statement_id  = "AllowExecutionFromAPIGatewayCaseManager"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.case_manager.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.main.execution_arn}/*/*/cases*"
}

# ============================================
# OUTPUTS
# ============================================
output "website_url" {
  description = "URL directa del bucket S3"
  value       = "http://${aws_s3_bucket.website.bucket}.s3-website-${var.aws_region}.amazonaws.com"
}

output "cloudfront_url" {
  description = "URL de CloudFront (recomendada para producción)"
  value       = "https://${aws_cloudfront_distribution.website.domain_name}"
}

output "cloudfront_domain" {
  description = "Dominio de CloudFront"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "api_url" {
  description = "URL de la API para el formulario"
  value       = "${aws_api_gateway_deployment.production.invoke_url}/formulario"
}

output "dynamodb_table" {
  description = "Nombre de la tabla DynamoDB"
  value       = aws_dynamodb_table.leads.name
}
