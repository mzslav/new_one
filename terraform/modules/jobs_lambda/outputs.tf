output "function_names" {
  value = {
    create  = aws_lambda_function.create.function_name
    list    = aws_lambda_function.list.function_name
    get     = aws_lambda_function.get.function_name
    process = aws_lambda_function.process.function_name
  }
}
