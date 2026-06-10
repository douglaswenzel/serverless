const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const dynamo = new DynamoDBClient({ region: "us-east-1" });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "pedidos";

exports.handler = async (event) => {
  console.log("Evento recebido no API Gateway:", JSON.stringify(event));

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (e) {
    console.error("Erro ao fazer parse do body:", e);
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Body inválido", details: e.message })
    };
  }

  const { idPedido } = body;

  if (!idPedido) {
    console.warn("idPedido não fornecido no body");
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "idPedido é obrigatório" })
    };
  }

  try {
    console.log(`Atualizando pedido ${idPedido} para status PREPARACAO...`);

    await dynamo.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { idPedido: { S: idPedido } },
      UpdateExpression: "SET #s = :status",
      ExpressionAttributeNames: { "#s": "Status" },
      ExpressionAttributeValues: { ":status": { S: "PREPARACAO" } }
    }));

    console.log(`✓ Pedido ${idPedido} atualizado para PREPARACAO com sucesso`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Pedido atualizado para PREPARACAO",
        idPedido
      })
    };
  } catch (error) {
    console.error(`✗ Erro ao atualizar pedido ${idPedido}:`, error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Erro ao atualizar pedido",
        details: error.message
      })
    };
  }
};
