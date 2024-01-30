# terraform init
# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_REGION=
# export TF_VAR_name=
# terraform apply

terraform {
  required_providers {
    aws = {
      version = "4.5.0"
    }
  }

  required_version = "~> 1.2.9"
}

provider "aws" {}

variable "name" {
  description = "The name to use for S3 bucket, DynamoDB table and IAM users."
  type        = string
}

resource "aws_s3_bucket" "this" {
  bucket = var.name

  tags = {
    Name = "GitHub Management"
    Url  = "https://github.com/pl-strflt/github-mgmt-template"
  }
}

resource "aws_s3_bucket_ownership_controls" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "this" {
  depends_on = [ aws_s3_bucket_ownership_controls.this ]

  bucket = aws_s3_bucket.this.id
  acl    = "private"
}

resource "aws_dynamodb_table" "this" {
  name         = var.name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = "GitHub Management"
    Url  = "https://github.com/pl-strflt/github-mgmt-template"
  }
}

resource "aws_iam_user" "ro" {
  name = "${var.name}-ro"

  tags = {
    Name = "GitHub Management"
    Url  = "https://github.com/pl-strflt/github-mgmt-template"
  }
}

resource "aws_iam_user" "rw" {
  name = "${var.name}-rw"

  tags = {
    Name = "GitHub Management"
    Url  = "https://github.com/pl-strflt/github-mgmt-template"
  }
}

data "aws_iam_policy_document" "ro" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = ["${aws_s3_bucket.this.arn}"]
    effect    = "Allow"
  }

  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.this.arn}/*"]
    effect    = "Allow"
  }

  statement {
    actions   = ["dynamodb:GetItem"]
    resources = ["${aws_dynamodb_table.this.arn}"]
    effect    = "Allow"
  }
}

data "aws_iam_policy_document" "rw" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = ["${aws_s3_bucket.this.arn}"]
    effect    = "Allow"
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = ["${aws_s3_bucket.this.arn}/*"]
    effect    = "Allow"
  }

  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]

    resources = ["${aws_dynamodb_table.this.arn}"]
    effect    = "Allow"
  }
}

resource "aws_iam_user_policy" "ro" {
  name = "${var.name}-ro"
  user = aws_iam_user.ro.name

  policy = data.aws_iam_policy_document.ro.json
}

resource "aws_iam_user_policy" "rw" {
  name = "${var.name}-rw"
  user = aws_iam_user.rw.name

  policy = data.aws_iam_policy_document.rw.json
}
