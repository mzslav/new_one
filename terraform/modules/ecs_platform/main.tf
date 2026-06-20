resource "aws_service_discovery_http_namespace" "main" {
  name = var.name_prefix
}

resource "aws_ecs_cluster" "main" {
  name = "${var.name_prefix}-cluster"

  service_connect_defaults {
    namespace = aws_service_discovery_http_namespace.main.arn
  }
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task_auth" {
  name = "${var.name_prefix}-task-auth"

  assume_role_policy = local.ecs_task_assume_role_policy
}

resource "aws_iam_role_policy" "task_auth" {
  role = aws_iam_role.task_auth.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:SignUp",
        "cognito-idp:InitiateAuth",
        "cognito-idp:AdminConfirmSignUp",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "task_media" {
  name = "${var.name_prefix}-task-media"

  assume_role_policy = local.ecs_task_assume_role_policy
}

resource "aws_iam_role_policy" "task_media" {
  role = aws_iam_role.task_media.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:*"]
        Resource = [var.media_bucket_arn, "${var.media_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:*"]
        Resource = var.files_table_arn
      }
    ]
  })
}

resource "aws_iam_role" "task_notification" {
  name = "${var.name_prefix}-task-notification"

  assume_role_policy = local.ecs_task_assume_role_policy
}

resource "aws_iam_role_policy" "task_notification" {
  role = aws_iam_role.task_notification.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:*"]
        Resource = var.notifications_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility",
        ]
        Resource = var.notifications_queue_arn
      }
    ]
  })
}

resource "aws_iam_role" "task_basic" {
  name = "${var.name_prefix}-task-basic"

  assume_role_policy = local.ecs_task_assume_role_policy
}

locals {
  ecs_task_assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}
