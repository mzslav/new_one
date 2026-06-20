data "aws_caller_identity" "current" {}

locals {
  name_prefix              = "${var.project_name}-${var.name_suffix}"
  files_table_name         = "${var.project_name}-files-${var.name_suffix}"
  notifications_table_name = "${var.project_name}-notifications-${var.name_suffix}"
  ecr_registry             = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"

  common_env = {
    AWS_REGION              = var.aws_region
    COGNITO_USER_POOL_ID    = module.database.cognito_user_pool_id
    COGNITO_CLIENT_ID       = module.database.cognito_client_id
    INTERNAL_WEBHOOK_SECRET = random_password.webhook.result
  }

  auth_image         = "${local.ecr_registry}/${module.ecr.repository_names.auth}:${var.container_image_tag}"
  media_image        = "${local.ecr_registry}/${module.ecr.repository_names.media}:${var.container_image_tag}"
  notification_image = "${local.ecr_registry}/${module.ecr.repository_names.notification}:${var.container_image_tag}"
  gateway_image      = "${local.ecr_registry}/${module.ecr.repository_names.gateway}:${var.container_image_tag}"
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "webhook" {
  length  = 32
  special = false
}

module "networking" {
  source = "./modules/networking"

  name_prefix = local.name_prefix
  aws_region  = var.aws_region
}

module "database" {
  source = "./modules/database"

  name_prefix              = local.name_prefix
  db_instance_class        = var.db_instance_class
  db_username              = "app"
  db_password              = random_password.db.result
  subnet_ids               = module.networking.subnet_ids
  rds_security_group_id    = module.networking.rds_security_group_id
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

module "queues" {
  source = "./modules/queues"

  name_prefix = local.name_prefix
}

module "ecr" {
  source = "./modules/ecr"

  name_prefix = local.name_prefix
}

module "ecs_platform" {
  source = "./modules/ecs_platform"

  name_prefix             = local.name_prefix
  files_table_arn         = module.database.files_table_arn
  media_bucket_arn        = module.storage.media_bucket_arn
  notifications_table_arn = module.database.notifications_table_arn
  notifications_queue_arn = module.queues.notifications_queue_arn
}

module "alb" {
  source = "./modules/alb"

  name_prefix           = local.name_prefix
  vpc_id                = module.networking.vpc_id
  subnet_ids            = module.networking.subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
}

module "jobs_lambda" {
  source = "./modules/jobs_lambda"

  name_prefix             = local.name_prefix
  aws_region              = var.aws_region
  lambda_source_dir       = "${path.module}/../lambdas/jobs"
  subnet_ids              = module.networking.subnet_ids
  security_group_id       = module.networking.ecs_security_group_id
  listener_arn            = module.alb.http_listener_arn
  database_url            = nonsensitive(module.database.database_url)
  files_table_name        = module.database.files_table_name
  files_table_arn         = module.database.files_table_arn
  media_bucket_name       = module.storage.media_bucket_name
  media_bucket_arn        = module.storage.media_bucket_arn
  jobs_queue_url          = module.queues.jobs_queue_url
  jobs_queue_arn          = module.queues.jobs_queue_arn
  notifications_queue_url = module.queues.notifications_queue_url
  notifications_queue_arn = module.queues.notifications_queue_arn
  common_environment      = local.common_env
}

module "ecs_auth" {
  source                        = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "auth"
  discovery_name                = "auth-service"
  container_port                = 3001
  image_uri                     = local.auth_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = module.ecs_platform.cluster_id
  cluster_name                  = module.ecs_platform.cluster_name
  subnet_ids                    = module.networking.subnet_ids
  security_group_id             = module.networking.ecs_security_group_id
  execution_role_arn            = module.ecs_platform.execution_role_arn
  task_role_arn                 = module.ecs_platform.auth_task_role_arn
  service_connect_namespace_arn = module.ecs_platform.service_connect_namespace_arn
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
  source                        = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "notification"
  discovery_name                = "notification-service"
  container_port                = 3004
  image_uri                     = local.notification_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = module.ecs_platform.cluster_id
  cluster_name                  = module.ecs_platform.cluster_name
  subnet_ids                    = module.networking.subnet_ids
  security_group_id             = module.networking.ecs_security_group_id
  execution_role_arn            = module.ecs_platform.execution_role_arn
  task_role_arn                 = module.ecs_platform.notification_task_role_arn
  service_connect_namespace_arn = module.ecs_platform.service_connect_namespace_arn
  min_tasks                     = var.ecs_min_tasks
  max_tasks                     = var.ecs_max_tasks
  aws_region                    = var.aws_region
  environment = merge(local.common_env, {
    PORT                           = "3004"
    NOTIFICATIONS_TABLE            = module.database.notifications_table_name
    NOTIFICATIONS_QUEUE_URL        = module.queues.notifications_queue_url
    SQS_WAIT_TIME_SECONDS          = "20"
    SQS_VISIBILITY_TIMEOUT_SECONDS = "60"
  })
}

module "ecs_media" {
  source                        = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "media"
  discovery_name                = "media-service"
  container_port                = 3003
  image_uri                     = local.media_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = module.ecs_platform.cluster_id
  cluster_name                  = module.ecs_platform.cluster_name
  subnet_ids                    = module.networking.subnet_ids
  security_group_id             = module.networking.ecs_security_group_id
  execution_role_arn            = module.ecs_platform.execution_role_arn
  task_role_arn                 = module.ecs_platform.media_task_role_arn
  service_connect_namespace_arn = module.ecs_platform.service_connect_namespace_arn
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

module "ecs_gateway" {
  source                        = "./modules/ecs_microservice"
  name_prefix                   = local.name_prefix
  service_name                  = "gateway"
  discovery_name                = "api-gateway"
  container_port                = 80
  image_uri                     = local.gateway_image
  cpu                           = var.ecs_cpu
  memory                        = var.ecs_memory
  cluster_id                    = module.ecs_platform.cluster_id
  cluster_name                  = module.ecs_platform.cluster_name
  subnet_ids                    = module.networking.subnet_ids
  security_group_id             = module.networking.ecs_security_group_id
  execution_role_arn            = module.ecs_platform.execution_role_arn
  task_role_arn                 = module.ecs_platform.basic_task_role_arn
  service_connect_namespace_arn = module.ecs_platform.service_connect_namespace_arn
  min_tasks                     = var.ecs_min_tasks
  max_tasks                     = var.ecs_max_tasks
  aws_region                    = var.aws_region
  attach_to_alb                 = true
  alb_target_group_arn          = module.alb.gateway_target_group_arn
  environment                   = { PORT = "80" }

  depends_on = [module.ecs_auth, module.ecs_media, module.ecs_notification]
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix                         = local.name_prefix
  aws_region                          = var.aws_region
  jobs_lambda_function_names          = module.jobs_lambda.function_names
  jobs_queue_name                     = module.queues.jobs_queue_name
  jobs_dlq_name                       = module.queues.jobs_dlq_name
  notifications_queue_name            = module.queues.notifications_queue_name
  notifications_dlq_name              = module.queues.notifications_dlq_name
  ecs_cluster_name                    = module.ecs_platform.cluster_name
  notification_service_name           = "${local.name_prefix}-notification"
  notification_service_log_group_name = "/ecs/${local.name_prefix}-notification"

  depends_on = [module.ecs_notification]
}
