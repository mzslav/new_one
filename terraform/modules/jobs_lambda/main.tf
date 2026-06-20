locals {
  function_names = {
    create  = "${var.name_prefix}-jobs-create"
    list    = "${var.name_prefix}-jobs-list"
    get     = "${var.name_prefix}-jobs-get"
    process = "${var.name_prefix}-jobs-process"
  }

  lambda_environment = merge(var.common_environment, {
    DATABASE_URL            = var.database_url
    FILES_TABLE             = var.files_table_name
    S3_BUCKET               = var.media_bucket_name
    JOBS_QUEUE_URL          = var.jobs_queue_url
    NOTIFICATIONS_QUEUE_URL = var.notifications_queue_url
  })

  lambda_environment_without_reserved = {
    for key, value in local.lambda_environment : key => value
    if key != "AWS_REGION"
  }
}

resource "terraform_data" "deps" {
  input = filesha256("${var.lambda_source_dir}/package-lock.json")

  provisioner "local-exec" {
    command     = "npm ci --omit=dev"
    working_dir = var.lambda_source_dir
  }
}

data "archive_file" "package" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.root}/.terraform/jobs-lambda.zip"

  depends_on = [terraform_data.deps]
}

resource "aws_iam_role" "main" {
  name = "${var.name_prefix}-lambda-jobs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.main.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.main.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "main" {
  role = aws_iam_role.main.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ]
        Resource = [
          var.jobs_queue_arn,
          var.notifications_queue_arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
        ]
        Resource = var.jobs_queue_arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
        ]
        Resource = var.files_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ]
        Resource = "${var.media_bucket_arn}/*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "main" {
  for_each = local.function_names

  name              = "/aws/lambda/${each.value}"
  retention_in_days = 3
}

resource "aws_lambda_function" "create" {
  function_name    = local.function_names.create
  role             = aws_iam_role.main.arn
  handler          = "index.createJob"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = local.lambda_environment_without_reserved
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  depends_on = [aws_cloudwatch_log_group.main]
}

resource "aws_lambda_function" "list" {
  function_name    = local.function_names.list
  role             = aws_iam_role.main.arn
  handler          = "index.listJobs"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = local.lambda_environment_without_reserved
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  depends_on = [aws_cloudwatch_log_group.main]
}

resource "aws_lambda_function" "get" {
  function_name    = local.function_names.get
  role             = aws_iam_role.main.arn
  handler          = "index.getJob"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = local.lambda_environment_without_reserved
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  depends_on = [aws_cloudwatch_log_group.main]
}

resource "aws_lambda_function" "process" {
  function_name    = local.function_names.process
  role             = aws_iam_role.main.arn
  handler          = "index.processJob"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256
  timeout          = 90
  memory_size      = 512

  environment {
    variables = local.lambda_environment_without_reserved
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  depends_on = [aws_cloudwatch_log_group.main]
}

resource "aws_lambda_event_source_mapping" "jobs_processing" {
  event_source_arn = var.jobs_queue_arn
  function_name    = aws_lambda_function.process.arn
  batch_size       = 1
  enabled          = true
}

resource "aws_lb_target_group" "jobs_options" {
  name        = "${var.name_prefix}-jobs-opt-tg"
  target_type = "lambda"
}

resource "aws_lb_target_group" "jobs_create" {
  name        = "${var.name_prefix}-jobs-create-tg"
  target_type = "lambda"
}

resource "aws_lb_target_group" "jobs_list" {
  name        = "${var.name_prefix}-jobs-list-tg"
  target_type = "lambda"
}

resource "aws_lb_target_group" "jobs_get" {
  name        = "${var.name_prefix}-jobs-get-tg"
  target_type = "lambda"
}

resource "aws_lambda_permission" "allow_alb_jobs_options" {
  statement_id  = "AllowExecutionFromALBJobsOptions"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create.function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.jobs_options.arn
}

resource "aws_lambda_permission" "allow_alb_jobs_create" {
  statement_id  = "AllowExecutionFromALBJobsCreate"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create.function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.jobs_create.arn
}

resource "aws_lambda_permission" "allow_alb_jobs_list" {
  statement_id  = "AllowExecutionFromALBJobsList"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list.function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.jobs_list.arn
}

resource "aws_lambda_permission" "allow_alb_jobs_get" {
  statement_id  = "AllowExecutionFromALBJobsGet"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get.function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.jobs_get.arn
}

resource "aws_lb_target_group_attachment" "jobs_options" {
  target_group_arn = aws_lb_target_group.jobs_options.arn
  target_id        = aws_lambda_function.create.arn

  depends_on = [aws_lambda_permission.allow_alb_jobs_options]
}

resource "aws_lb_target_group_attachment" "jobs_create" {
  target_group_arn = aws_lb_target_group.jobs_create.arn
  target_id        = aws_lambda_function.create.arn

  depends_on = [aws_lambda_permission.allow_alb_jobs_create]
}

resource "aws_lb_target_group_attachment" "jobs_list" {
  target_group_arn = aws_lb_target_group.jobs_list.arn
  target_id        = aws_lambda_function.list.arn

  depends_on = [aws_lambda_permission.allow_alb_jobs_list]
}

resource "aws_lb_target_group_attachment" "jobs_get" {
  target_group_arn = aws_lb_target_group.jobs_get.arn
  target_id        = aws_lambda_function.get.arn

  depends_on = [aws_lambda_permission.allow_alb_jobs_get]
}

resource "aws_lb_listener_rule" "jobs_options" {
  listener_arn = var.listener_arn
  priority     = 5

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.jobs_options.arn
  }

  condition {
    path_pattern {
      values = ["/api/jobs", "/api/jobs/*"]
    }
  }

  condition {
    http_request_method {
      values = ["OPTIONS"]
    }
  }
}

resource "aws_lb_listener_rule" "jobs_create" {
  listener_arn = var.listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.jobs_create.arn
  }

  condition {
    path_pattern {
      values = ["/api/jobs"]
    }
  }

  condition {
    http_request_method {
      values = ["POST"]
    }
  }
}

resource "aws_lb_listener_rule" "jobs_list" {
  listener_arn = var.listener_arn
  priority     = 11

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.jobs_list.arn
  }

  condition {
    path_pattern {
      values = ["/api/jobs"]
    }
  }

  condition {
    http_request_method {
      values = ["GET"]
    }
  }
}

resource "aws_lb_listener_rule" "jobs_get" {
  listener_arn = var.listener_arn
  priority     = 12

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.jobs_get.arn
  }

  condition {
    path_pattern {
      values = ["/api/jobs/*"]
    }
  }

  condition {
    http_request_method {
      values = ["GET"]
    }
  }
}
