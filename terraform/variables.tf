variable "aws_region" {
  type = string
}

variable "project_name" {
  type = string
}

variable "name_suffix" {
  type = string
}

variable "db_instance_class" {
  type = string
}

variable "ecs_cpu" {
  type = string
}

variable "ecs_memory" {
  type = string
}

variable "ecs_min_tasks" {
  type = number
}

variable "ecs_max_tasks" {
  type = number
}

variable "container_image_tag" {
  type = string
}
