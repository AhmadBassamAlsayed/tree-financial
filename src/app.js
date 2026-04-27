const express = require('express');
const helmet  = require('helmet');
const morgan  = require('morgan');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('../config/swagger');
const { sequelize } = require('../config/database');
const authenticate  = require('../middlewares/authMiddleware');

require('dotenv').config({ path: './.env' });

// Register all models and associations
require('../models/Index');

const app = express();

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Swagger docs (public)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Internal routes use X-Internal-Secret — no Bearer token needed
app.use('/api/internal', require('../routes/internalRoutes'));

// All routes below require a valid SSO token
app.use(authenticate);

app.use('/api/wallets',  require('../routes/walletRoutes'));
app.use('/api/payments', require('../routes/paymentRoutes'));

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Financial service is running' });
});

const PORT = process.env.PORT || 3004;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database synced.');

    app.listen(PORT, () => {
      console.log(`Financial service running on port ${PORT}`);
      console.log(`API docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start financial service:', error);
    process.exit(1);
  }
};

startServer();
