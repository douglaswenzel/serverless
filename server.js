require('dotenv').config();
const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, ListBucketsCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { gerarNotaFiscal } = require('./services/pdfService');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION 
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({ 
  region: process.env.AWS_REGION 
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

app.use(express.json());

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API Serverless de Pedidos',
    version: '2.0.0',
    description:
      'API de gerenciamento de pedidos utilizando DynamoDB, S3, geração automática de nota fiscal PDF e arquitetura Serverless AWS'
  },

  servers: [
    {
      url: `http://34.228.60.10:${process.env.PORT || 3000}`
    }
  ],

  paths: {

    '/health': {
      get: {
        summary: 'Health Check da aplicação',
        tags: ['Monitoramento'],
        responses: {
          200: {
            description: 'Serviços operacionais'
          }
        }
      }
    },

    '/dashboard': {
      get: {
        summary: 'Dashboard consolidado',
        tags: ['Dashboard'],
        responses: {
          200: {
            description: 'Indicadores dos pedidos'
          }
        }
      }
    },

    '/pedidos': {

      post: {
        summary: 'Criar novo pedido',
        tags: ['Pedidos'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'emailCliente',
                  'nomeCliente',
                  'valor'
                ],
                properties: {
                  emailCliente: {
                    type: 'string',
                    example: 'douglas@email.com'
                  },
                  nomeCliente: {
                    type: 'string',
                    example: 'Douglas Wenzel'
                  },
                  valor: {
                    type: 'number',
                    example: 150.00
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Pedido criado com sucesso'
          }
        }
      },

      get: {
        summary: 'Listar pedidos',
        tags: ['Pedidos'],
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: [
                'RECEBIMENTO',
                'PREPARACAO',
                'ENVIADO'
              ]
            }
          }
        ],
        responses: {
          200: {
            description: 'Lista de pedidos'
          }
        }
      }
    },

    '/pedidos/{id}': {
      get: {
        summary: 'Consultar pedido',
        tags: ['Pedidos'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Pedido encontrado'
          },
          404: {
            description: 'Pedido não encontrado'
          }
        }
      }
    },

    '/pedidos/{idPedido}/preparar': {
      post: {
        summary: 'Alterar pedido para PREPARACAO',
        tags: ['Fluxo Pedido'],
        parameters: [
          {
            name: 'idPedido',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Pedido em preparação'
          }
        }
      }
    },

    '/pedidos/{idPedido}/enviar': {
      post: {
        summary: 'Alterar pedido para ENVIADO',
        tags: ['Fluxo Pedido'],
        parameters: [
          {
            name: 'idPedido',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Pedido enviado'
          }
        }
      }
    },

    '/pedidos/{idPedido}/gerar-nota': {
      post: {
        summary: 'Gerar Nota Fiscal PDF automaticamente',
        tags: ['Nota Fiscal'],
        parameters: [
          {
            name: 'idPedido',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Nota fiscal gerada e salva no S3'
          },
          404: {
            description: 'Pedido não encontrado'
          }
        }
      }
    },

    '/pedidos/{idPedido}/download-nota': {
      get: {
        summary: 'Gerar URL temporária para download da nota',
        tags: ['Nota Fiscal'],
        parameters: [
          {
            name: 'idPedido',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'URL de download gerada'
          }
        }
      }
    },

    '/pedidos/{idPedido}/nota-fiscal': {

      post: {
        summary: 'Upload manual de Nota Fiscal PDF',
        tags: ['Nota Fiscal'],
        parameters: [
          {
            name: 'idPedido',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  arquivo: {
                    type: 'string',
                    format: 'binary'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Upload realizado'
          }
        }
      },

      get: {
        summary: 'Consultar arquivo PDF no S3',
        tags: ['Nota Fiscal'],
        parameters: [
          {
            name: 'idPedido',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          },
          {
            name: 'arquivo',
            in: 'query',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Arquivo encontrado'
          }
        }
      }
    },

    '/buckets': {
      get: {
        summary: 'Listar buckets S3',
        tags: ['S3'],
        responses: {
          200: {
            description: 'Buckets encontrados'
          }
        }
      }
    },

    '/s3/arquivos': {
      get: {
        summary: 'Listar todos os arquivos do bucket',
        tags: ['S3'],
        responses: {
          200: {
            description: 'Arquivos listados'
          }
        }
      }
    },

    '/pedidos/{idPedido}/arquivos': {
      get: {
        summary: 'Listar arquivos vinculados ao pedido',
        tags: ['S3'],
        parameters: [
          {
            name: 'idPedido',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Arquivos do pedido'
          },
          404: {
            description: 'Pedido não encontrado'
          }
        }
      }
    }
  }
};

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.post('/pedidos', async (req, res) => {
  try {
    const { emailCliente, nomeCliente, valor, status = 'RECEBIMENTO', referenciaNota = null, dataEnvio = null } = req.body;
    if (!emailCliente || !nomeCliente || typeof valor !== 'number') {
      return res.status(400).json({ error: 'emailCliente, nomeCliente e valor são obrigatórios e valor deve ser number' });
    }

    const pedido = { idPedido: randomUUID(), emailCliente, nomeCliente, valor, data: new Date().toISOString(), status, referenciaNota, dataEnvio };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: pedido }));
    return res.status(201).json({ message: 'Pedido criado com sucesso', pedido });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar pedido', details: error.message });
  }
});

app.post('/pedidos/:idPedido/nota-fiscal', upload.single('arquivo'), async (req, res) => {
  try {
    const { idPedido } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo PDF não enviado' });
    }

    const getCommand = new GetCommand({ TableName: TABLE_NAME, Key: { idPedido } });
    const { Item } = await docClient.send(getCommand);
    if (!Item) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const nomeArquivo = `notas/${idPedido}-${Date.now()}.pdf`;
    await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: nomeArquivo, Body: req.file.buffer, ContentType: 'application/pdf', Metadata: { idPedido } }));

    return res.status(200).json({ message: 'Upload realizado com sucesso', arquivo: nomeArquivo, idPedido, bucket: BUCKET_NAME });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao fazer upload', details: error.message });
  }
});

app.get('/pedidos/:idPedido/nota-fiscal', async (req, res) => {
  try {
    const { idPedido } = req.params;
    const nomeArquivo = req.query.arquivo;
    if (!nomeArquivo) {
      return res.status(400).json({ error: 'Parâmetro arquivo é obrigatório' });
    }
    await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: nomeArquivo }));
    return res.status(200).json({ message: 'Arquivo encontrado', idPedido, arquivo: nomeArquivo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao consultar arquivo', details: error.message });
  }
});

app.get('/pedidos', async (req, res) => {
  try {
    const { Items } = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    return res.status(200).json({ total: Items.length, pedidos: Items });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar pedidos', details: error.message });
  }
});

app.get('/pedidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { idPedido: id } }));
    if (!Item) return res.status(404).json({ error: 'Pedido não encontrado' });
    return res.status(200).json(Item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao consultar pedido', details: error.message });
  }
});

app.get('/buckets', async (req, res) => {
  try {
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}));
    return res.status(200).json({ total: Buckets.length, buckets: Buckets.map(({ Name, CreationDate }) => ({ name: Name, creationDate: CreationDate })) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar buckets', details: error.message });
  }
});

app.get('/s3/arquivos', async (req, res) => {
  try {
    const { Contents = [] } = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
    const arquivos = Contents.map(item => ({ key: item.Key, size: item.Size, lastModified: item.LastModified, fileName: item.Key, idPedido: null }));
    return res.status(200).json({ total: arquivos.length, bucket: BUCKET_NAME, arquivos });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar arquivos', details: error.message });
  }
});

app.get('/pedidos/:idPedido/arquivos', async (req, res) => {
  try {
    const { idPedido } = req.params;
    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { idPedido } }));
    if (!Item) return res.status(404).json({ error: 'Pedido não encontrado' });

    const { Contents = [] } = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));

    const arquivos = await Promise.all(Contents.map(async item => {
      try {
        const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: item.Key }));
        return head.Metadata && head.Metadata.idpedido === idPedido ? { key: item.Key, size: item.Size, lastModified: item.LastModified, fileName: item.Key, url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}` } : null;
      } catch (err) {
        console.error(err);
        return null;
      }
    }));

    return res.status(200).json({ idPedido, pedido: { nomeCliente: Item.nomeCliente, emailCliente: Item.emailCliente }, total: arquivos.filter(Boolean).length, arquivos: arquivos.filter(Boolean) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar arquivos do pedido', details: error.message });
  }
});

app.post("/pedidos/:idPedido/gerar-nota", async (req, res) => {
  try {
    const { idPedido } = req.params;

    const pedidoResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { idPedido }
      })
    );

    if (!pedidoResult.Item) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const pedidoComStatusAtualizado = {
      ...pedidoResult.Item,
      status: "ENVIADO"
    };

    const pdfBuffer = await gerarNotaFiscal(pedidoComStatusAtualizado);
    const fileKey = `notas/${idPedido}/nota-fiscal.pdf`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: pdfBuffer,
        ContentType: "application/pdf",
        Metadata: {
          idpedido: idPedido
        }
      })
    );

    return res.json({
      message: "Nota fiscal gerada",
      arquivo: fileKey
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/pedidos/:idPedido/preparar", async (req, res) => {
  try {
    const { idPedido } = req.params;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { idPedido },
        UpdateExpression: "SET #st = :novoStatus",
        ExpressionAttributeNames: {
          "#st": "status"
        },
        ExpressionAttributeValues: {
          ":novoStatus": "PREPARACAO"
        }
      })
    );

    console.log(`✓ Pedido ${idPedido} alterado para PREPARACAO.`);

    return res.json({
      message: "Pedido em preparação com sucesso",
      idPedido
    });

  } catch (error) {
    console.error("Erro ao preparar pedido:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post(
  '/pedidos/:idPedido/enviar',
  async (req, res) => {

    try {

      const { idPedido } = req.params;

      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { idPedido },
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

      res.json({
        message:
          'Pedido enviado'
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }

  }
);

app.get(
  '/pedidos/:idPedido/download-nota',
  async (req, res) => {

    try {

      const { idPedido } = req.params;

      const pedido =
        await docClient.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { idPedido }
          })
        );

      if (!pedido.Item) {

        return res.status(404).json({
          error:
            'Pedido não encontrado'
        });

      }

      if (
        !pedido.Item.referenciaNota
      ) {

        return res.status(404).json({
          error:
            'Pedido não possui nota fiscal'
        });

      }

      const command =
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key:
            pedido.Item.referenciaNota
        });

      const url =
        await getSignedUrl(
          s3Client,
          command,
          {
            expiresIn: 3600
          }
        );

      res.json({
        downloadUrl: url
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }

  }
);

app.get('/dashboard', async (req, res) => {

  try {

    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME
      })
    );

    const pedidos = result.Items || [];

    const recebimento =
      pedidos.filter(
        p => p.status === 'RECEBIMENTO'
      ).length;

    const preparacao =
      pedidos.filter(
        p => p.status === 'PREPARACAO'
      ).length;

    const enviado =
      pedidos.filter(
        p => p.status === 'ENVIADO'
      ).length;

    const faturamento =
      pedidos.reduce(
        (total, pedido) =>
          total + Number(pedido.valor || 0),
        0
      );

    res.json({
      total: pedidos.length,
      recebimento,
      preparacao,
      enviado,
      faturamento
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

app.get('/health', async (req, res) => {
  try {

    await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 1
      })
    );

    await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        MaxKeys: 1
      })
    );

    res.json({
      api: 'UP',
      dynamodb: 'UP',
      s3: 'UP',
      table: TABLE_NAME,
      bucket: BUCKET_NAME,
      timestamp: new Date().toISOString()
    });

  } catch (error) {

    res.status(500).json({
      api: 'DOWN',
      error: error.message
    });

  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Swagger disponível em http://localhost:${PORT}/swagger`);
});

module.exports = app;
