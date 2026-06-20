resource "aws_ecr_repository" "auth" {
  name         = "${var.name_prefix}-auth"
  force_delete = true
}

resource "aws_ecr_repository" "media" {
  name         = "${var.name_prefix}-media"
  force_delete = true
}

resource "aws_ecr_repository" "notification" {
  name         = "${var.name_prefix}-notification"
  force_delete = true
}

resource "aws_ecr_repository" "gateway" {
  name         = "${var.name_prefix}-gateway"
  force_delete = true
}
