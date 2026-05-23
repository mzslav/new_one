output "aws_region" {
  value = var.aws_region
}

output "website_url" {
  description = "Frontend (S3 static website, HTTP)"
  value       = module.frontend.website_url
}

output "api_url" {
  description = "Backend API (ALB → gateway, HTTP)"
  value       = "http://${aws_lb.main.dns_name}"
}

output "vite_api_url_for_frontend_build" {
  description = "VITE_API_URL для збірки React"
  value       = "http://${aws_lb.main.dns_name}"
}

output "frontend_s3_bucket" {
  value = module.frontend.frontend_bucket_name
}

output "ecr_repositories" {
  value = {
    auth         = aws_ecr_repository.auth.repository_url
    job          = aws_ecr_repository.job.repository_url
    media        = aws_ecr_repository.media.repository_url
    notification = aws_ecr_repository.notification.repository_url
    gateway      = aws_ecr_repository.gateway.repository_url
  }
}

output "cognito_user_pool_id" {
  value = module.database.cognito_user_pool_id
}

output "cognito_client_id" {
  value = module.database.cognito_client_id
}
