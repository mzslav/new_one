output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.jobs.address}:5432/jobs_db"
  sensitive = true
}

output "files_table_name" {
  value = aws_dynamodb_table.files.name
}

output "files_table_arn" {
  value = aws_dynamodb_table.files.arn
}

output "notifications_table_name" {
  value = aws_dynamodb_table.notifications.name
}

output "notifications_table_arn" {
  value = aws_dynamodb_table.notifications.arn
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.main.id
}

output "sns_topic_arn" {
  value = aws_sns_topic.notifications.arn
}
