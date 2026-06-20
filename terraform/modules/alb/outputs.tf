output "dns_name" {
  value = aws_lb.main.dns_name
}

output "http_listener_arn" {
  value = aws_lb_listener.http.arn
}

output "gateway_target_group_arn" {
  value = aws_lb_target_group.gateway.arn
}
