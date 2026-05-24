variable "name_prefix" {
  type = string
}

variable "service_name" {
  type = string
}

variable "container_port" {
  type = number
}

variable "discovery_name" {
  type        = string
  description = "DNS name for Service Connect"
}

variable "image_uri" {
  type = string
}

variable "cpu" {
  type = string
}

variable "memory" {
  type = string
}

variable "cluster_id" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "environment" {
  type    = map(string)
  default = {}
}

variable "service_connect_namespace_arn" {
  type = string
}

variable "min_tasks" {
  type = number
}

variable "max_tasks" {
  type = number
}

variable "health_check_path" {
  type    = string
  default = "/health"
}

variable "attach_to_alb" {
  type    = bool
  default = false
}

variable "alb_target_group_arn" {
  type    = string
  default = ""
}

variable "aws_region" {
  type = string
}
