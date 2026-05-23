resource "aws_s3_bucket" "media" {
  bucket        = "${var.name_prefix}-media-${var.name_suffix}"
  force_destroy = true

  tags = {
    Name = "${var.name_prefix}-media"
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}
