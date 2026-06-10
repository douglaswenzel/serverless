const {
  DynamoDBClient
} = require('@aws-sdk/client-dynamodb');

const {
  DynamoDBDocumentClient,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');

const dynamoClient =
  new DynamoDBClient({
    region: process.env.AWS_REGION
  });

const docClient =
  DynamoDBDocumentClient.from(
    dynamoClient
  );

exports.handler = async (event) => {

  console.log(
    JSON.stringify(event, null, 2)
  );

  try {

    const record =
      event.Records[0];

    const key =
      decodeURIComponent(
        record.s3.object.key
      );

    console.log(
      'Arquivo:',
      key
    );

    const match =
      key.match(
        /notas\/(.+)\/nota-fiscal\.pdf/
      );

    if (!match) {

      throw new Error(
        'Não foi possível extrair idPedido'
      );

    }

    const idPedido =
      match[1];

    console.log(
      'Pedido:',
      idPedido
    );

    await docClient.send(
      new UpdateCommand({
        TableName:
          process.env.DYNAMODB_TABLE_NAME,

        Key: {
          idPedido
        },

        UpdateExpression:
          `
          SET
          #status = :status,
          dataEnvio = :dataEnvio
          `,

        ExpressionAttributeNames: {
          '#status': 'status'
        },

        ExpressionAttributeValues: {
          ':status': 'ENVIADO',
          ':dataEnvio':
            new Date().toISOString()
        }
      })
    );

    return {
      statusCode: 200
    };

  } catch (error) {

    console.error(error);

    throw error;

  }

};