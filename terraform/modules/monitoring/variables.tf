variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "jobs_lambda_function_names" {
  type = object({
    create  = string
    list    = string
    get     = string
    process = string
  })
}

variable "jobs_queue_name" {
  type = string
}

variable "jobs_dlq_name" {
  type = string
}

variable "notifications_queue_name" {
  type = string
}

variable "notifications_dlq_name" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "notification_service_name" {
  type = string
}

variable "notification_service_log_group_name" {
  type = string
}
