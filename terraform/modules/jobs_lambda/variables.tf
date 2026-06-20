variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "lambda_source_dir" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "listener_arn" {
  type = string
}

variable "database_url" {
  type = string
}

variable "files_table_name" {
  type = string
}

variable "files_table_arn" {
  type = string
}

variable "media_bucket_name" {
  type = string
}

variable "media_bucket_arn" {
  type = string
}

variable "jobs_queue_url" {
  type = string
}

variable "jobs_queue_arn" {
  type = string
}

variable "notifications_queue_url" {
  type = string
}

variable "notifications_queue_arn" {
  type = string
}

variable "common_environment" {
  type = map(string)
}
