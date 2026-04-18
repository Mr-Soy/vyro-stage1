const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Grabpic API',
      version: '1.0.0',
      description:
        'Grabpic — Intelligent Identity & Retrieval Engine. High-performance image processing backend with facial recognition for large-scale events.',
      contact: {
        name: 'Vyrothon 2026',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Local development',
      },
    ],
    tags: [
      { name: 'Crawl', description: 'Image ingestion & face detection' },
      { name: 'Auth', description: 'Selfie-based authentication' },
      { name: 'Images', description: 'Image retrieval by grab_id' },
      { name: 'Stats', description: 'System statistics' },
    ],
  },
  apis: ['./server/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
