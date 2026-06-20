output "aws_region" {
  value = var.aws_region
}

output "website_url" {
  description = "Frontend"
  value       = module.frontend.website_url
}

output "api_url" {
  description = "Backend API"
  value       = "http://${module.alb.dns_name}"
}

output "vite_api_url_for_frontend_build" {
  description = "VITE_API_URL"
  value       = "http://${module.alb.dns_name}"
}

output "frontend_s3_bucket" {
  value = module.frontend.frontend_bucket_name
}

output "ecr_repositories" {
  value = module.ecr.repository_urls
}

output "notifications_queue_url" {
  value = module.queues.notifications_queue_url
}

output "notifications_dlq_url" {
  value = module.queues.notifications_dlq_url
}

output "jobs_queue_url" {
  value = module.queues.jobs_queue_url
}

output "jobs_dlq_url" {
  value = module.queues.jobs_dlq_url
}

output "cloudwatch_dashboard_name" {
  value = module.monitoring.dashboard_name
}

output "cognito_user_pool_id" {
  value = module.database.cognito_user_pool_id
}

output "cognito_client_id" {
  value = module.database.cognito_client_id
}
