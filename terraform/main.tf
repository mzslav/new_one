data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  name_prefix              = "${var.project_name}-${var.name_suffix}"
  files_table_name         = "${var.project_name}-files-${var.name_suffix}"
  notifications_table_name = "${var.project_name}-notifications-${var.name_suffix}"
  ecr_registry             = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  subnet_ids               = data.aws_subnets.default.ids
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "webhook" {
  length  = 32
  special = false
}

# --- Security groups ---
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "HTTP to ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "ECS tasks"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "PostgreSQL from ECS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Database, Cognito, SNS, DynamoDB ---
module "database" {
  source = "./modules/database"

  name_prefix              = local.name_prefix
  db_instance_class        = var.db_instance_class
  db_username              = "app"
  db_password              = random_password.db.result
  subnet_ids               = local.subnet_ids
  rds_security_group_id    = aws_security_group.rds.id
  files_table_name         = local.files_table_name
  notifications_table_name = local.notifications_table_name
}

module "storage" {
  source = "./modules/storage"

  name_prefix = var.project_name
  name_suffix = var.name_suffix
}

module "frontend" {
  source = "./modules/frontend"

  name_prefix = var.project_name
  name_suffix = var.name_suffix
}

# --- ECR ---
resource "aws_ecr_repository" "auth" {
  name         = "${local.name_prefix}-auth"
  force_delete = true
}

resource "aws_ecr_repository" "job" {
  name         = "${local.name_prefix}-job"
  force_delete = true
}

resource "aws_ecr_repository" "media" {
  name         = "${local.name_prefix}-media"
  force_delete = true
}

resource "aws_ecr_repository" "notification" {
  name         = "${local.name_prefix}-notification"
  force_delete = true
}

resource "aws_ecr_repository" "gateway" {
  name         = "${local.name_prefix}-gateway"
  force_delete = true
}

# --- ECS cluster + Service Connect ---
resource "aws_service_discovery_http_namespace" "main" {
  name = local.name_prefix
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  service_connect_defaults {
    namespace = aws_service_discovery_http_namespace.main.arn
  }
}

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"

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
  name = "${local.name_prefix}-task-auth"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "task_auth" {
  role = aws_iam_role.task_auth.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
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
  name = "${local.name_prefix}-task-media"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "task_media" {
  role = aws_iam_role.task_media.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:*"]
        Resource = [module.storage.media_bucket_arn, "${module.storage.media_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:*"]
        Resource = module.database.files_table_arn
      }
    ]
  })
}

resource "aws_iam_role" "task_notification" {
  name = "${local.name_prefix}-task-notification"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "task_notification" {
  role = aws_iam_role.task_notification.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:*"]
        Resource = module.database.notifications_table_arn
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = module.database.sns_topic_arn
      }
    ]
  })
}

resource "aws_iam_role" "task_basic" {
  name = "${local.name_prefix}-task-basic"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# --- ALB ---
resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = local.subnet_ids
}

resource "aws_lb_target_group" "gateway" {
  name        = "${local.name_prefix}-gw-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gateway.arn
  }
}

locals {
  common_env = {
    AWS_REGION              = var.aws_region
    COGNITO_USER_POOL_ID    = module.database.cognito_user_pool_id
    COGNITO_CLIENT_ID       = module.database.cognito_client_id
    INTERNAL_WEBHOOK_SECRET = random_password.webhook.result
  }

  auth_image         = "${local.ecr_registry}/${aws_ecr_repository.auth.name}:${var.container_image_tag}"
  job_image          = "${local.ecr_registry}/${aws_ecr_repository.job.name}:${var.container_image_tag}"
  media_image        = "${local.ecr_registry}/${aws_ecr_repository.media.name}:${var.container_image_tag}"
  notification_image = "${local.ecr_registry}/${aws_ecr_repository.notification.name}:${var.container_image_tag}"
  gateway_image      = "${local.ecr_registry}/${aws_ecr_repository.gateway.name}:${var.container_image_tag}"
}

module "ecs_auth" {
  source                      = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "auth"
  discovery_name                = "auth-service"
  container_port                = 3001
  image_uri                     = local.auth_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = aws_ecs_cluster.main.id
  cluster_name                  = aws_ecs_cluster.main.name
  subnet_ids                    = local.subnet_ids
  security_group_id             = aws_security_group.ecs.id
  execution_role_arn            = aws_iam_role.ecs_execution.arn
  task_role_arn                 = aws_iam_role.task_auth.arn
  service_connect_namespace_arn = aws_service_discovery_http_namespace.main.arn
  min_tasks                     = var.ecs_min_tasks
  max_tasks                     = var.ecs_max_tasks
  aws_region                    = var.aws_region
  environment = merge(local.common_env, {
    PORT                 = "3001"
    COGNITO_CLIENT_ID    = module.database.cognito_client_id
    COGNITO_USER_POOL_ID = module.database.cognito_user_pool_id
  })
}

module "ecs_notification" {
  source                      = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "notification"
  discovery_name                = "notification-service"
  container_port                = 3004
  image_uri                     = local.notification_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = aws_ecs_cluster.main.id
  cluster_name                  = aws_ecs_cluster.main.name
  subnet_ids                    = local.subnet_ids
  security_group_id             = aws_security_group.ecs.id
  execution_role_arn            = aws_iam_role.ecs_execution.arn
  task_role_arn                 = aws_iam_role.task_notification.arn
  service_connect_namespace_arn = aws_service_discovery_http_namespace.main.arn
  min_tasks                     = var.ecs_min_tasks
  max_tasks                     = var.ecs_max_tasks
  aws_region                    = var.aws_region
  environment = merge(local.common_env, {
    PORT                = "3004"
    NOTIFICATIONS_TABLE = module.database.notifications_table_name
    SNS_TOPIC_ARN       = module.database.sns_topic_arn
  })
}

module "ecs_media" {
  source                      = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "media"
  discovery_name                = "media-service"
  container_port                = 3003
  image_uri                     = local.media_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = aws_ecs_cluster.main.id
  cluster_name                  = aws_ecs_cluster.main.name
  subnet_ids                    = local.subnet_ids
  security_group_id             = aws_security_group.ecs.id
  execution_role_arn            = aws_iam_role.ecs_execution.arn
  task_role_arn                 = aws_iam_role.task_media.arn
  service_connect_namespace_arn = aws_service_discovery_http_namespace.main.arn
  min_tasks                     = var.ecs_min_tasks
  max_tasks                     = var.ecs_max_tasks
  aws_region                    = var.aws_region
  environment = merge(local.common_env, {
    PORT          = "3003"
    S3_BUCKET     = module.storage.media_bucket_name
    FILES_TABLE   = module.database.files_table_name
    MAX_UPLOAD_MB = "512"
  })
}

module "ecs_job" {
  source                      = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "job"
  discovery_name                = "job-service"
  container_port                = 3002
  image_uri                     = local.job_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = aws_ecs_cluster.main.id
  cluster_name                  = aws_ecs_cluster.main.name
  subnet_ids                    = local.subnet_ids
  security_group_id             = aws_security_group.ecs.id
  execution_role_arn            = aws_iam_role.ecs_execution.arn
  task_role_arn                 = aws_iam_role.task_basic.arn
  service_connect_namespace_arn = aws_service_discovery_http_namespace.main.arn
  min_tasks                     = var.ecs_min_tasks
  max_tasks                     = var.ecs_max_tasks
  aws_region                    = var.aws_region
  environment = merge(local.common_env, {
    PORT                     = "3002"
    DATABASE_URL             = nonsensitive(module.database.database_url)
    NOTIFICATION_SERVICE_URL = "http://notification-service:3004"
    MEDIA_SERVICE_URL        = "http://media-service:3003"
    JOB_DELAY_MS             = "10000"
  })
}

module "ecs_gateway" {
  source                      = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "gateway"
  discovery_name                = "api-gateway"
  container_port                = 80
  image_uri                     = local.gateway_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = aws_ecs_cluster.main.id
  cluster_name                  = aws_ecs_cluster.main.name
  subnet_ids                    = local.subnet_ids
  security_group_id             = aws_security_group.ecs.id
  execution_role_arn            = aws_iam_role.ecs_execution.arn
  task_role_arn                 = aws_iam_role.task_basic.arn
  service_connect_namespace_arn = aws_service_discovery_http_namespace.main.arn
  min_tasks                     = var.ecs_min_tasks
  max_tasks                     = var.ecs_max_tasks
  aws_region                    = var.aws_region
  attach_to_alb                 = true
  alb_target_group_arn          = aws_lb_target_group.gateway.arn
  environment                   = { PORT = "80" }

  depends_on = [module.ecs_auth, module.ecs_job, module.ecs_media, module.ecs_notification]
}
