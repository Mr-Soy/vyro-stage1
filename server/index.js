require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { loadModels } = require('./utils/faceModels');

const app = express();

// --------------- Middleware ---------------

// CORS — allow frontend origin from .env
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Parse JSON bodies
app.use(express.json());

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
});
app.use(limiter);

// --------------- Health Check ---------------

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Grabpic API is running' });
});

// --------------- Swagger Docs ---------------

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Grabpic API Docs',
}));

// Serve raw OpenAPI JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// --------------- Routes ---------------

const crawlRoutes = require('./routes/crawl');
const authRoutes = require('./routes/auth');
const imageRoutes = require('./routes/images');
const statsRoutes = require('./routes/stats');
const uploadRoutes = require('./routes/upload');

app.use('/api', crawlRoutes);
app.use('/api', authRoutes);
app.use('/api', imageRoutes);
app.use('/api', statsRoutes);
app.use('/api', uploadRoutes);

// --------------- Global Error Handler ---------------

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// --------------- Start Server ---------------

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    console.log('Loading face recognition models...');
    await loadModels();
    console.log('Face recognition models loaded successfully.');

    app.listen(PORT, () => {
      console.log(`Grabpic server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
