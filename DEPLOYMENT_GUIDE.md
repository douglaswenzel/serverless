# 🚀 Guia Completo de Deployment - Avaliação Final Computação em Nuvem

## Pré-requisitos

- AWS CLI v2 configurada com credenciais
- Node.js 20.x instalado
- Acesso a console AWS (DynamoDB, Lambda, SES, S3, EC2, API Gateway, EventBridge)
- Permissões IAM suficientes para criar recursos

---

## Passo 1: Preparar Credenciais AWS

Antes de começar, configure suas credenciais AWS:

```bash
aws configure
# Insira seu AWS Access Key ID
# Insira seu AWS Secret Access Key
# Defina a região como: us-east-1
# Formato de output: json
```

Ou crie um arquivo `.env` na raiz do projeto com:

```
AWS_ACCESS_KEY_ID=sua_access_key
AWS_SECRET_ACCESS_KEY=sua_secret_key
AWS_REGION=us-east-1
```

---

## Passo 2: Criar Tabela DynamoDB

### Via Console AWS:
1. Vá em **DynamoDB > Tables > Create table**
2. **Table name:** `pedidos`
3. **Partition key:** `idPedido` (String)
4. Deixe o resto padrão e clique **Create**

### Via AWS CLI:

```bash
aws dynamodb create-table \
  --table-name pedidos \
  --attribute-definitions \
    AttributeName=idPedido,AttributeType=S \
  --key-schema \
    AttributeName=idPedido,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Ativar DynamoDB Streams:

1. Abra a tabela `pedidos`
2. Aba **"Exports and streams"**
3. Em **"DynamoDB stream details"**, clique **"Turn on"**
4. Selecione **"New and old images"** e confirme
5. **Guarde o ARN da stream**, você vai precisar para a Lambda

Ou via AWS CLI:

```bash
aws dynamodb update-table \
  --table-name pedidos \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --region us-east-1
```

---

## Passo 3: Verificar e Validar Identidades no Amazon SES

### Via Console AWS:
1. Vá em **Amazon SES > Verified identities > Create identity**
2. Escolha **"Email address"**
3. Verifique o e-mail que vai **enviar** os e-mails (ex: `seuprojeto@gmail.com`)
4. Verifique também o e-mail que vai **receber** (em sandbox, ambos precisam ser verificados)
5. Confirme os e-mails acessando sua caixa de entrada e clicando no link da AWS

### Anotar:
- E-mail verificado (será usado como `EMAIL_REMETENTE`)
- Confirmação de ambos os e-mails

---

## Passo 4: Criar Bucket S3

### Via Console AWS:
1. Vá em **S3 > Create bucket**
2. **Bucket name:** `pedidos-nf-bucket-SEUNOME` (deve ser único globalmente)
3. **Region:** us-east-1
4. Clique **Create bucket**

### Via AWS CLI:

```bash
aws s3 mb s3://pedidos-nf-bucket-SEUNOME --region us-east-1
```

---

## Passo 5: Deploy das Lambdas

### 5.1 Lambda de Execução (`lambda-execucao`)

**Preparar o ZIP:**

```bash
cd lambdas/execucao
npm install @aws-sdk/client-ses
zip -r lambda-execucao.zip index.js node_modules/
cd ../..
```

**Deploy via AWS CLI:**

```bash
aws lambda create-function \
  --function-name lambda-execucao \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambdas/execucao/lambda-execucao.zip \
  --environment Variables={EMAIL_REMETENTE=seuemail@verificado.com,DYNAMODB_TABLE_NAME=pedidos} \
  --timeout 60 \
  --region us-east-1
```

**Configurar Trigger (DynamoDB Stream):**

1. Abra a Lambda `lambda-execucao` no console
2. **Configuration > Triggers > Add trigger**
3. **Source:** DynamoDB
4. **Table:** `pedidos`
5. **Starting position:** Latest
6. **Batch size:** 1
7. Clique **Add**

**Adicionar Permissões IAM:**

A role de execução da Lambda deve ter:
- `AmazonSESFullAccess`
- `AmazonDynamoDBStreamReadAccess`

---

### 5.2 Lambda de Envio (`lambda-envio`)

**Preparar o ZIP:**

```bash
cd lambdas/envio
npm install @aws-sdk/client-dynamodb
zip -r lambda-envio.zip index.js node_modules/
cd ../..
```

**Deploy via AWS CLI:**

```bash
aws lambda create-function \
  --function-name lambda-envio \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambdas/envio/lambda-envio.zip \
  --environment Variables={DYNAMODB_TABLE_NAME=pedidos,API_GATEWAY_URL=https://XXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/preparacao} \
  --timeout 60 \
  --region us-east-1
```

**Configurar EventBridge Trigger:**

1. Vá em **EventBridge > Schedules > Create schedule**
2. **Schedule name:** `verificacao-pedidos`
3. **Schedule pattern:** Recurring schedule
4. **Rate-based:** `5 minutes`
5. **Target:** Lambda function > `lambda-envio`
6. Clique **Create**

Ou via AWS CLI:

```bash
aws events put-rule \
  --name verificacao-pedidos \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED \
  --region us-east-1

aws events put-targets \
  --rule verificacao-pedidos \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:ACCOUNT_ID:function:lambda-envio" \
  --region us-east-1
```

**Adicionar Permissão à Lambda:**

- `AmazonDynamoDBReadOnlyAccess`

---

### 5.3 Lambda de Preparação (`lambda-preparacao`)

**Preparar o ZIP:**

```bash
cd lambdas/preparacao
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
zip -r lambda-preparacao.zip index.js node_modules/
cd ../..
```

**Deploy via AWS CLI:**

```bash
aws lambda create-function \
  --function-name lambda-preparacao \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambdas/preparacao/lambda-preparacao.zip \
  --environment Variables={DYNAMODB_TABLE_NAME=pedidos} \
  --timeout 60 \
  --region us-east-1
```

**Adicionar Permissões IAM:**

- `AmazonDynamoDBFullAccess`

---

### 5.4 Lambda de Confirmação (`lambda-confirmacao`)

**Preparar o ZIP:**

```bash
cd lambdas/confirmacao
npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb
zip -r lambda-confirmacao.zip index.js node_modules/
cd ../..
```

**Deploy via AWS CLI:**

```bash
aws lambda create-function \
  --function-name lambda-confirmacao \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambdas/confirmacao/lambda-confirmacao.zip \
  --environment Variables={DYNAMODB_TABLE_NAME=pedidos} \
  --timeout 60 \
  --region us-east-1
```

**Configurar Trigger S3:**

1. Abra a Lambda `lambda-confirmacao`
2. **Configuration > Triggers > Add trigger**
3. **Source:** S3
4. **Bucket:** `pedidos-nf-bucket-SEUNOME`
5. **Event types:** `s3:ObjectCreated:*`
6. **Suffix:** `.pdf`
7. Clique **Add**

**Adicionar Permissões IAM:**

- `AmazonS3ReadOnlyAccess`
- `AmazonDynamoDBFullAccess`

---

## Passo 6: Criar API Gateway

1. Vá em **API Gateway > Create API > REST API > Build**
2. **API name:** `api-pedidos`
3. **Endpoint type:** Regional
4. Clique **Create API**

### Criar Recurso e Método:

1. **Actions > Create Resource**
2. **Resource name:** `preparacao`
3. Selecione `/preparacao` > **Actions > Create Method > POST**
4. **Integration type:** Lambda Function
5. **Lambda Function:** `lambda-preparacao`
6. Salve e confirme a permissão

### Deploy:

1. **Actions > Deploy API**
2. **Stage name:** `prod`
3. Clique **Deploy**

**Copiar a URL gerada:**
- Ex: `https://abc123.execute-api.us-east-1.amazonaws.com/prod`
- Rota completa: `https://abc123.execute-api.us-east-1.amazonaws.com/prod/preparacao`

**Atualize a variável `API_GATEWAY_URL` na lambda-envio com essa URL.**

---

## Passo 7: Configurar EC2 com a API

### Lançar Instância:

1. Vá em **EC2 > Launch Instance**
2. **Name:** `api-serverless`
3. **AMI:** Amazon Linux 2023
4. **Instance type:** t2.micro
5. **Key pair:** Crie ou selecione um existente
6. **Security group:** Crie com as regras abaixo:
   - SSH (22) — Seu IP
   - TCP 3000 — 0.0.0.0/0
   - HTTP (80) — 0.0.0.0/0
7. Clique **Launch**

### Conectar via SSH:

```bash
ssh -i suachave.pem ec2-user@IP_PUBLICO_DA_EC2
```

### Instalar Dependências:

```bash
sudo yum update -y
sudo yum install -y nodejs npm git
git clone https://github.com/festmedeiros/api-serverless
cd api-serverless
npm install
```

### Configurar `.env`:

```bash
nano .env
```

Preencha com:

```
AWS_ACCESS_KEY_ID=sua_access_key
AWS_SECRET_ACCESS_KEY=sua_secret_key
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=pedidos
S3_BUCKET_NAME=pedidos-nf-bucket-SEUNOME
PORT=3000
```

### Iniciar a API com PM2:

```bash
sudo npm install -g pm2
pm2 start server.js --name "api-pedidos"
pm2 startup
pm2 save
```

Acessar: `http://IP_PUBLICO_DA_EC2:3000/swagger`

---

## Passo 8: Roteiro de Apresentação

### Fluxo Completo (em ordem):

**1. POST - Criar Pedido**
```bash
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "nomeCliente": "João Silva",
    "emailCliente": "joao@example.com",
    "valor": 150.50
  }'
```

**2. Verificar Email Recebido (RECEBIMENTO)**
- Confira sua caixa de entrada

**3. Aguardar 5 minutos ou disparar lambda-envio manualmente**
- Eventbridge dispara a cada 5 minutos
- Ou execute manualmente via console Lambda > Test

**4. Verificar logs da lambda-envio e lambda-preparacao**
- CloudWatch > Log groups > /aws/lambda/lambda-envio
- CloudWatch > Log groups > /aws/lambda/lambda-preparacao

**5. Verificar Email Recebido (PREPARACAO)**
- Novo e-mail com status PREPARACAO

**6. Upload de Nota Fiscal**
```bash
curl -X POST http://localhost:3000/pedidos/IDPEDIDO/nota-fiscal \
  -F "arquivo=@nota-fiscal.pdf"
```

**7. Verificar Lambda Confirmação nos Logs**
- CloudWatch > Log groups > /aws/lambda/lambda-confirmacao

**8. Verificar Email Recebido (ENVIADO)**
- E-mail final com referência da nota fiscal

---

## 📋 Checklist de Deployment

- [ ] Tabela DynamoDB `pedidos` criada com Streams ativadas
- [ ] E-mails verificados no Amazon SES
- [ ] Bucket S3 criado
- [ ] Lambda `lambda-execucao` criada e acionada por DynamoDB Stream
- [ ] Lambda `lambda-envio` criada e acionada por EventBridge (5 minutos)
- [ ] Lambda `lambda-preparacao` criada
- [ ] Lambda `lambda-confirmacao` criada e acionada por S3
- [ ] API Gateway criado com rota POST `/preparacao`
- [ ] EC2 com API rodando em `http://IP:3000`
- [ ] Credenciais AWS configuradas no `.env` da EC2
- [ ] S3_BUCKET_NAME preenchido no `.env`
- [ ] EMAIL_REMETENTE preenchido nas variáveis de ambiente das Lambdas
- [ ] API_GATEWAY_URL atualizada na lambda-envio

---

## 🛠️ Troubleshooting

### Lambda não recebe eventos do DynamoDB Stream
- Verifique se o DynamoDB Stream está ativado na tabela
- Confira se o ARN da stream na configuração da Lambda está correto
- Verifique permissões: a role precisa de `AmazonDynamoDBStreamReadAccess`

### E-mails não chegam
- Confira se o endereço de e-mail no SES está verificado
- Verifique se está em "Sandbox Mode" (neste caso, ambos os e-mails precisam estar verificados)
- Veja os logs na CloudWatch da lambda-execucao

### Lambda-envio não dispara
- Confirme que a EventBridge Rule está ativa
- Verifique os logs da EventBridge na CloudWatch
- Teste manualmente a lambda via console AWS

---

## 📝 Notas Importantes

- Os templates de e-mail são HTML e podem ser customizados
- O filtro de 4 minutos na lambda-envio pode ser ajustado no código
- Considere aumentar o timeout das Lambdas se processar muitos pedidos
- Use tags no S3 para melhor rastreamento (opcional)

---

**Boa sorte com sua apresentação!** 🎓
