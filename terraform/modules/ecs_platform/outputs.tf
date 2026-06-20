output "cluster_id" {
  value = aws_ecs_cluster.main.id
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "service_connect_namespace_arn" {
  value = aws_service_discovery_http_namespace.main.arn
}

output "execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "auth_task_role_arn" {
  value = aws_iam_role.task_auth.arn
}

output "media_task_role_arn" {
  value = aws_iam_role.task_media.arn
}

output "notification_task_role_arn" {
  value = aws_iam_role.task_notification.arn
}

output "basic_task_role_arn" {
  value = aws_iam_role.task_basic.arn
}
