output "notifications_queue_url" {
  value = aws_sqs_queue.notifications.id
}

output "notifications_queue_arn" {
  value = aws_sqs_queue.notifications.arn
}

output "notifications_queue_name" {
  value = aws_sqs_queue.notifications.name
}

output "notifications_dlq_url" {
  value = aws_sqs_queue.notifications_dlq.id
}

output "notifications_dlq_name" {
  value = aws_sqs_queue.notifications_dlq.name
}

output "jobs_queue_url" {
  value = aws_sqs_queue.jobs_processing.id
}

output "jobs_queue_arn" {
  value = aws_sqs_queue.jobs_processing.arn
}

output "jobs_queue_name" {
  value = aws_sqs_queue.jobs_processing.name
}

output "jobs_dlq_url" {
  value = aws_sqs_queue.jobs_dlq.id
}

output "jobs_dlq_name" {
  value = aws_sqs_queue.jobs_dlq.name
}
