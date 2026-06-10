# Script de deployment automatizado para as Lambdas
# Uso: .\deploy-lambdas.ps1 -AccountId 123456789012 -EmailRemetente "seu@email.com" -ApiGatewayUrl "https://..."

param(
    [Parameter(Mandatory=$true)]
    [string]$AccountId,
    
    [Parameter(Mandatory=$true)]
    [string]$EmailRemetente,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiGatewayUrl = "https://XXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/preparacao",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1"
)

Write-Host "🚀 DEPLOYMENT DAS LAMBDAS" -ForegroundColor Cyan
Write-Host "=" * 60

# Validar AWS CLI
Write-Host "`n📋 Verificando AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version
    Write-Host "✓ AWS CLI disponível: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ AWS CLI não encontrada. Instale com: pip install awscli" -ForegroundColor Red
    exit 1
}

# Obter Role ARN
Write-Host "`n🔐 Obtendo Role de Execução..." -ForegroundColor Yellow
try {
    $roleArn = aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text --region $Region 2>/dev/null
    if (-not $roleArn) {
        Write-Host "⚠ Role 'lambda-execution-role' não encontrada." -ForegroundColor Yellow
        Write-Host "  Criando role padrão..." -ForegroundColor Yellow
        $roleArn = "arn:aws:iam::${AccountId}:role/service-role/lambda-basic-execution-role"
        Write-Host "  Use: $roleArn" -ForegroundColor Cyan
    } else {
        Write-Host "✓ Role encontrada: $roleArn" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Erro ao obter role: $_" -ForegroundColor Red
    exit 1
}

# Preparar e Deploy Lambda Execução
Write-Host "`n📦 Lambda Execução..." -ForegroundColor Cyan
Write-Host "  Preparando ZIP..." -ForegroundColor Gray
Push-Location .\lambdas\execucao
npm install @aws-sdk/client-ses 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "✗ Erro ao instalar dependências" -ForegroundColor Red; exit 1 }
Compress-Archive -Path "index.js", "node_modules" -DestinationPath "lambda-execucao.zip" -Force 2>&1 | Out-Null
Write-Host "  ✓ ZIP criado" -ForegroundColor Green

Write-Host "  Fazendo deploy..." -ForegroundColor Gray
$funcArn = aws lambda create-function `
  --function-name lambda-execucao `
  --runtime nodejs20.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file fileb://lambda-execucao.zip `
  --environment "Variables={EMAIL_REMETENTE=$EmailRemetente,DYNAMODB_TABLE_NAME=pedidos}" `
  --timeout 60 `
  --region $Region `
  --query 'FunctionArn' `
  --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Lambda criada: $funcArn" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Possível erro (função pode já existir): $funcArn" -ForegroundColor Yellow
}
Pop-Location

# Preparar e Deploy Lambda Envio
Write-Host "`n📦 Lambda Envio..." -ForegroundColor Cyan
Write-Host "  Preparando ZIP..." -ForegroundColor Gray
Push-Location .\lambdas\envio
npm install @aws-sdk/client-dynamodb 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "✗ Erro ao instalar dependências" -ForegroundColor Red; exit 1 }
Compress-Archive -Path "index.js", "node_modules" -DestinationPath "lambda-envio.zip" -Force 2>&1 | Out-Null
Write-Host "  ✓ ZIP criado" -ForegroundColor Green

Write-Host "  Fazendo deploy..." -ForegroundColor Gray
$funcArn = aws lambda create-function `
  --function-name lambda-envio `
  --runtime nodejs20.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file fileb://lambda-envio.zip `
  --environment "Variables={DYNAMODB_TABLE_NAME=pedidos,API_GATEWAY_URL=$ApiGatewayUrl}" `
  --timeout 60 `
  --region $Region `
  --query 'FunctionArn' `
  --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Lambda criada: $funcArn" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Possível erro: $funcArn" -ForegroundColor Yellow
}
Pop-Location

# Preparar e Deploy Lambda Preparação
Write-Host "`n📦 Lambda Preparação..." -ForegroundColor Cyan
Write-Host "  Preparando ZIP..." -ForegroundColor Gray
Push-Location .\lambdas\preparacao
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "✗ Erro ao instalar dependências" -ForegroundColor Red; exit 1 }
Compress-Archive -Path "index.js", "node_modules" -DestinationPath "lambda-preparacao.zip" -Force 2>&1 | Out-Null
Write-Host "  ✓ ZIP criado" -ForegroundColor Green

Write-Host "  Fazendo deploy..." -ForegroundColor Gray
$funcArn = aws lambda create-function `
  --function-name lambda-preparacao `
  --runtime nodejs20.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file fileb://lambda-preparacao.zip `
  --environment "Variables={DYNAMODB_TABLE_NAME=pedidos}" `
  --timeout 60 `
  --region $Region `
  --query 'FunctionArn' `
  --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Lambda criada: $funcArn" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Possível erro: $funcArn" -ForegroundColor Yellow
}
Pop-Location

# Preparar e Deploy Lambda Confirmação
Write-Host "`n📦 Lambda Confirmação..." -ForegroundColor Cyan
Write-Host "  Preparando ZIP..." -ForegroundColor Gray
Push-Location .\lambdas\confirmacao
npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "✗ Erro ao instalar dependências" -ForegroundColor Red; exit 1 }
Compress-Archive -Path "index.js", "node_modules" -DestinationPath "lambda-confirmacao.zip" -Force 2>&1 | Out-Null
Write-Host "  ✓ ZIP criado" -ForegroundColor Green

Write-Host "  Fazendo deploy..." -ForegroundColor Gray
$funcArn = aws lambda create-function `
  --function-name lambda-confirmacao `
  --runtime nodejs20.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file fileb://lambda-confirmacao.zip `
  --environment "Variables={DYNAMODB_TABLE_NAME=pedidos}" `
  --timeout 60 `
  --region $Region `
  --query 'FunctionArn' `
  --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Lambda criada: $funcArn" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Possível erro: $funcArn" -ForegroundColor Yellow
}
Pop-Location

Write-Host "`n" + "=" * 60
Write-Host "`n✅ DEPLOY CONCLUÍDO" -ForegroundColor Green
Write-Host "`n⚠ PRÓXIMAS ETAPAS MANUAIS:" -ForegroundColor Yellow
Write-Host "  1. Configure triggers das Lambdas no console AWS"
Write-Host "  2. DynamoDB Stream → lambda-execucao"
Write-Host "  3. EventBridge (5min) → lambda-envio"
Write-Host "  4. API Gateway POST /preparacao → lambda-preparacao"
Write-Host "  5. S3 ObjectCreated → lambda-confirmacao"
Write-Host "  6. Verifique DEPLOYMENT_GUIDE.md para instruções completas"
Write-Host "`n"
