variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "app_name" {
  type    = string
  default = "betsport-pro"
}
variable "certificate_arn" {
  type        = string
  description = "Certificado ACM válido para el dominio en esta región"
}
variable "jwt_parameter_name" {
  type        = string
  default     = "/betsport/jwt-secret"
  description = "SSM SecureString creado fuera de Terraform, mínimo 32 caracteres"
}
variable "instance_type" {
  type    = string
  default = "t3.small"
}
