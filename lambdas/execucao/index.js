const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const ses = new SESClient({ region: "us-east-1" });
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || "seuemail@verificado.com";

exports.handler = async (event) => {
  console.log("Evento DynamoDB Stream recebido:", JSON.stringify(event));

  for (const record of event.Records) {
    // Ignora eventos de exclusão
    if (record.eventName === "REMOVE") continue;

    const newImage = record.dynamodb.NewImage;
    if (!newImage) continue;

    const idPedido     = newImage.idPedido?.S;
    const nomeCliente  = newImage.NomeCliente?.S;
    const emailCliente = newImage.EmailCliente?.S;
    const valor        = newImage.Valor?.N;
    const data         = newImage.Data?.S;
    const status       = newImage.Status?.S;
    const dataEnvio    = newImage.DataEnvio?.S;
    const referenciaNota = newImage.ReferenciaNota?.S;

    if (!emailCliente || !status) {
      console.log("E-mail ou status não encontrados. Ignorando registro.");
      continue;
    }

    let assunto = "";
    let corpoHtml = "";

    if (status === "RECEBIMENTO") {
      assunto = `Pedido ${idPedido} - Recebido`;
      corpoHtml = `
        <html>
          <body>
            <p>Prezado(a) ${nomeCliente}, agradecemos pela sua compra!</p>
            <p>O seu pedido foi recebido e será enviado em breve!</p>
            <p><b>Dados do pedido:</b></p>
            <ul>
              <li>ID do Pedido: ${idPedido}</li>
              <li>Valor total: R$ ${valor}</li>
              <li>Data da compra: ${data}</li>
            </ul>
            <p>Acompanhe o status do seu pedido em nossa plataforma.</p>
          </body>
        </html>
      `;
    } else if (status === "PREPARACAO") {
      assunto = `Pedido ${idPedido} - Em Preparação`;
      corpoHtml = `
        <html>
          <body>
            <p>Prezado(a) ${nomeCliente}, agradecemos pela sua compra!</p>
            <p>O seu pedido está na etapa de preparação e será enviado em breve!</p>
            <p><b>Dados do pedido:</b></p>
            <ul>
              <li>ID do Pedido: ${idPedido}</li>
              <li>Valor total: R$ ${valor}</li>
              <li>Data da compra: ${data}</li>
            </ul>
            <p>Continue acompanhando o status na nossa plataforma.</p>
          </body>
        </html>
      `;
    } else if (status === "ENVIADO") {
      assunto = `Pedido ${idPedido} - Enviado`;
      corpoHtml = `
        <html>
          <body>
            <p>Prezado(a) ${nomeCliente}, agradecemos pela sua compra!</p>
            <p>Passando para avisar que o seu pedido já foi enviado e a data de recebimento é de 7 dias úteis.</p>
            <p><b>Dados do pedido:</b></p>
            <ul>
              <li>ID do Pedido: ${idPedido}</li>
              <li>Valor total: R$ ${valor}</li>
              <li>Data da compra: ${data}</li>
            </ul>
            <p><b>Dados do envio:</b></p>
            <ul>
              <li>Data do envio: ${dataEnvio}</li>
              <li>Referência da nota fiscal: ${referenciaNota}</li>
            </ul>
            <p>Acompanhe a entrega via rastreamento de transportadora.</p>
          </body>
        </html>
      `;
    } else {
      console.log("Status não mapeado:", status);
      continue;
    }

    try {
      await ses.send(new SendEmailCommand({
        Source: EMAIL_REMETENTE,
        Destination: { ToAddresses: [emailCliente] },
        Message: {
          Subject: { Data: assunto, Charset: "UTF-8" },
          Body: { 
            Html: { 
              Data: corpoHtml,
              Charset: "UTF-8"
            }
          }
        }
      }));

      console.log(`✓ E-mail enviado para ${emailCliente} - Status: ${status} - Pedido: ${idPedido}`);
    } catch (error) {
      console.error(`✗ Erro ao enviar e-mail para ${emailCliente}:`, error);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ message: "Processamento concluído" }) };
};
