output "instance_id" { value = aws_instance.app.id }
output "ecr_repository_url" { value = aws_ecr_repository.app.repository_url }
output "load_balancer_dns" { value = aws_lb.app.dns_name }
