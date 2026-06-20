output "repository_urls" {
  value = {
    auth         = aws_ecr_repository.auth.repository_url
    media        = aws_ecr_repository.media.repository_url
    notification = aws_ecr_repository.notification.repository_url
    gateway      = aws_ecr_repository.gateway.repository_url
  }
}

output "repository_names" {
  value = {
    auth         = aws_ecr_repository.auth.name
    media        = aws_ecr_repository.media.name
    notification = aws_ecr_repository.notification.name
    gateway      = aws_ecr_repository.gateway.name
  }
}
