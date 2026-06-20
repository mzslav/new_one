resource "aws_cloudwatch_metric_alarm" "jobs_lambda_errors" {
  for_each = var.jobs_lambda_function_names

  alarm_name          = "${var.name_prefix}-${each.key}-lambda-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }
}

resource "aws_cloudwatch_metric_alarm" "jobs_lambda_duration" {
  for_each = {
    create  = { name = var.jobs_lambda_function_names.create, threshold = 8000 }
    list    = { name = var.jobs_lambda_function_names.list, threshold = 5000 }
    get     = { name = var.jobs_lambda_function_names.get, threshold = 5000 }
    process = { name = var.jobs_lambda_function_names.process, threshold = 60000 }
  }

  alarm_name          = "${var.name_prefix}-${each.key}-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Average"
  threshold           = each.value.threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value.name
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_visible_messages" {
  for_each = {
    jobs          = var.jobs_queue_name
    notifications = var.notifications_queue_name
  }

  alarm_name          = "${var.name_prefix}-${each.key}-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  for_each = {
    jobs          = var.jobs_dlq_name
    notifications = var.notifications_dlq_name
  }

  alarm_name          = "${var.name_prefix}-${each.key}-dlq-messages"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }
}

resource "aws_cloudwatch_log_metric_filter" "notification_errors" {
  name           = "${var.name_prefix}-notification-errors"
  log_group_name = var.notification_service_log_group_name
  pattern        = "?error ?ERROR ?failed ?FAILED ?fatal ?FATAL"

  metric_transformation {
    name      = "NotificationServiceErrors"
    namespace = "Fluxon/${var.name_prefix}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "notification_service_errors" {
  alarm_name          = "${var.name_prefix}-notification-service-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "NotificationServiceErrors"
  namespace           = "Fluxon/${var.name_prefix}"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  depends_on = [aws_cloudwatch_log_metric_filter.notification_errors]
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-operations"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Jobs Lambda errors"
          region = var.aws_region
          view   = "timeSeries"
          period = 60
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", var.jobs_lambda_function_names.create, { stat = "Sum", label = "create errors" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.jobs_lambda_function_names.list, { stat = "Sum", label = "list errors" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.jobs_lambda_function_names.get, { stat = "Sum", label = "get errors" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.jobs_lambda_function_names.process, { stat = "Sum", label = "process errors" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Jobs Lambda duration"
          region = var.aws_region
          view   = "timeSeries"
          period = 60
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", var.jobs_lambda_function_names.create, { stat = "Average", label = "create avg" }],
            [".", ".", ".", var.jobs_lambda_function_names.list, { stat = "Average", label = "list avg" }],
            [".", ".", ".", var.jobs_lambda_function_names.get, { stat = "Average", label = "get avg" }],
            [".", ".", ".", var.jobs_lambda_function_names.process, { stat = "Average", label = "process avg" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "SQS queues and DLQs"
          region = var.aws_region
          view   = "timeSeries"
          period = 60
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.jobs_queue_name, { stat = "Average", label = "jobs queue" }],
            [".", ".", ".", var.notifications_queue_name, { stat = "Average", label = "notifications queue" }],
            [".", ".", ".", var.jobs_dlq_name, { stat = "Sum", label = "jobs DLQ" }],
            [".", ".", ".", var.notifications_dlq_name, { stat = "Sum", label = "notifications DLQ" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Notification service errors"
          region = var.aws_region
          view   = "timeSeries"
          period = 60
          metrics = [
            ["Fluxon/${var.name_prefix}", "NotificationServiceErrors", { stat = "Sum", label = "log errors" }],
          ]
        }
      },
    ]
  })
}
