# 📦 Sistema Distribuído de Orquestração de Pedidos e Faturamento (Serverless + EC2)

Este projeto implementa uma **arquitetura distribuída híbrida em AWS**, combinando uma API Express hospedada em EC2 com um ecossistema serverless orientado a eventos.

O sistema automatiza todo o ciclo de vida de um pedido: criação, processamento, geração de nota fiscal, armazenamento de documentos e envio de notificações ao cliente.

---

# 🧠 Visão Geral da Arquitetura

O sistema segue uma arquitetura **event-driven (orientada a eventos)** com separação clara entre:

- Camada síncrona (API Express na EC2)
- Camada assíncrona (AWS Lambda + EventBridge + Streams)
- Banco central (DynamoDB como source of truth)

---

# 🏗️ Arquitetura do Sistema
```
CLIENTE
   |
   v
POST /pedidos
   |
   v
API EXPRESS (EC2)
   |
   | cria pedido (RECEBIMENTO)
   v
DYNAMODB (Pedidos)
   |
   v
EVENTBRIDGE (Scheduler a cada 2 min)
   |
   v
LAMBDA ENVIO-FINAL
   |
   | consulta pedidos em PREPARACAO
   |
   +--> POST /pedidos/{id}/gerar-nota
           |
           v
     API EXPRESS (EC2)
           |
           | gera PDF da nota fiscal
           v
        S3 (Notas Fiscais)
           |
           v
LAMBDA CONFIRMACAO (S3 Trigger)
           |
           | atualiza status → ENVIADO
           v
DYNAMODB STREAMS
           |
           v
LAMBDA EXECUCAO
           |
           | envia e-mail ao cliente
           v
CLIENTE FINAL

```

# 🎯 Objetivo do Sistema

Este sistema automatiza completamente o fluxo de um pedido:

- Criação do pedido
- Persistência no DynamoDB
- Processamento assíncrono de faturamento
- Geração de nota fiscal em PDF
- Armazenamento no S3
- Atualização de status
- Notificação final por e-mail

---

# 🔁 Ciclo de Vida do Pedido


RECEBIMENTO → PREPARACAO → ENVIADO


| Status       | Descrição |
|--------------|----------|
| RECEBIMENTO  | Pedido criado na API |
| PREPARACAO   | Pedido elegível para faturamento |
| ENVIADO      | Nota fiscal gerada e cliente notificado |

---

# 🧩 Componentes do Sistema

## 🖥️ API Express (EC2)

Responsável pela camada síncrona do sistema:

### Funções:
- Criar pedidos
- Consultar pedidos
- Gerar nota fiscal (PDF)
- Fazer upload no S3
- Atualizar DynamoDB

### Tecnologias:
- Node.js (ESM)
- Express.js
- PM2
- Swagger UI

---

## 🧠 DynamoDB (Source of Truth)

- Armazena todos os pedidos
- Controla o estado do fluxo
- Base para orquestração

---

## ⏱️ EventBridge Scheduler

- Executa a cada 2 minutos
- Dispara Lambda `envio-final`
- Inicia pipeline de faturamento

---

## ⚙️ Lambda envio-final

- Consulta pedidos em `PREPARACAO`
- Chama API Express para gerar nota fiscal
- Coordena etapa de faturamento

---

## 🧾 S3 (Armazenamento)

- Armazena PDFs das notas fiscais
- Dispara eventos para confirmação

---

## 📦 Lambda confirmacao

- Detecta upload no S3
- Atualiza status para `ENVIADO`
- Garante consistência do fluxo

---

## 📡 DynamoDB Streams

- Detecta mudanças no banco em tempo real
- Dispara eventos automaticamente

---

## 📧 Lambda execucao

- Consome eventos do DynamoDB Streams
- Envia e-mail ao cliente final
- Finaliza o ciclo do pedido

---

# 📡 API REST

## Criar Pedido


POST /pedidos


Cria um pedido com status inicial `RECEBIMENTO`.

---

## Listar Pedidos


GET /pedidos


Retorna todos os pedidos.

---

## Buscar Pedido


GET /pedidos/{idPedido}


Retorna detalhes do pedido.

---

## Gerar Nota Fiscal (Interno)


POST /pedidos/{idPedido}/gerar-nota


Responsável por:
- gerar PDF
- enviar para S3
- atualizar status

---

# ⚙️ Variáveis de Ambiente


PORT=3000
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=pedidos
S3_BUCKET_NAME=amazon-dsm-vot-p2
API_BASE_URL=http://<EC2_PUBLIC_IP>:3000


---

# 🧱 Decisões de Arquitetura

- EC2 utilizado como camada síncrona de controle
- AWS Lambda para processamento assíncrono
- Event-driven architecture para desacoplamento
- DynamoDB como fonte de verdade
- EventBridge substituindo polling manual
- Streams para reatividade em tempo real

---

