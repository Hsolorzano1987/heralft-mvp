# variables.tf
variable "aws_region" {
  description = "Región de AWS donde desplegar los recursos"
  type        = string
  default     = "us-east-1"
}
