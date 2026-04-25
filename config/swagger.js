const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Financial Service API',
      version: '1.0.0',
      description: 'Financial service for the Tree platform. Manages wallets, ledger entries, and payments.',
    },
    servers: [
      { url: 'http://localhost:3004', description: 'Development' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from the SSO service'
        },
        internalSecret: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Internal-Secret',
          description: 'Shared secret for microservice-to-microservice calls'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: {}
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: { type: 'string', nullable: true }
          }
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        Account: {
          type: 'object',
          properties: {
            id:        { type: 'integer' },
            type:      { type: 'string', enum: ['user', 'shop'] },
            sn:        { type: 'string', example: '12345678901234567890', description: '20-digit unique wallet serial number' },
            userId:    { type: 'integer', nullable: true },
            shopId:    { type: 'integer', nullable: true },
            currency:  { type: 'string', example: 'SYP' },
            status:    { type: 'string', enum: ['active', 'inactive', 'frozen'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        LedgerEntry: {
          type: 'object',
          properties: {
            id:            { type: 'integer' },
            transactionId: { type: 'integer' },
            accountId:     { type: 'integer' },
            amount:        { type: 'number', format: 'double' },
            direction:     { type: 'string', enum: ['CREDIT', 'DEBIT'] },
            status:        { type: 'string', enum: ['pending', 'completed', 'failed'] },
            createdAt:     { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);
