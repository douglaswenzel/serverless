const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const https = require("https");
const http = require("http");

const dynamo = new DynamoDBClient({ region: "us-east-1" });
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "https://XXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/preparacao";
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "pedidos";

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === "https:" ? https : http;
    const data = JSON.stringify(body);

    const req = lib.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + (urlObj.search || ""),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    }, (res) => {
      let respBody = "";
      res.on("data", chunk => respBody += chunk);
      res.on("end", () => {
        resolve({ 
          statusCode: res.statusCode, 
          body: respBody,
          headers: res.headers
        });
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log("Lambda de envio acionada. Verificando pedidos com mais de 4 minutos...");

  const agora = new Date();
  const quatroMinutosAtras = new Date(agora.getTime() - 4 * 60 * 1000).toISOString();

  console.log(`Agora: ${agora.toISOString()}`);
  console.log(`Limite: ${quatroMinutosAtras}`);

  try {
    const result = await dynamo.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "#s = :status AND #d < :tempo",
      ExpressionAttributeNames: {
        "#s": "Status",
        "#d": "Data"
      },
      ExpressionAttributeValues: {
        ":status": { S: "RECEBIMENTO" },
        ":tempo":  { S: quatroMinutosAtras }
      }
    }));

    console.log(`✓ Pedidos encontrados com status RECEBIMENTO e Data < ${quatroMinutosAtras}: ${result.Items.length}`);

    for (const item of result.Items) {
      const idPedido = item.idPedido.S;
      const dataPedido = item.Data?.S;
      
      console.log(`\nProcessando pedido: ${idPedido} (Data: ${dataPedido})`);

      try {
        const response = await httpPost(API_GATEWAY_URL, { idPedido });
        console.log(`✓ Resposta para ${idPedido}: ${response.statusCode}`);
        console.log(`  Body: ${response.body}`);
      } catch (error) {
        console.error(`✗ Erro ao fazer POST para ${idPedido}:`, error.message);
      }
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: "Verificação concluída",
        pedidosProcessados: result.Items.length
      })
    };
  } catch (error) {
    console.error("✗ Erro ao escanear DynamoDB:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message })
    };
  }
};
