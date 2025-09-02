#!/usr/bin/env node

/**
 * Simple Mock API Server (CommonJS version)
 */

const express = require('express');
const app = express();
const port = 3001;

// Enable CORS and JSON parsing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Valid API key for testing
const VALID_API_KEY = 'test_api_key_12345678901234567890123456';

// Mock job for testing
const mockJob = {
  id: 'job_001',
  token: 'token_001',
  type: 'listing_scrape',
  config: {
    url: 'https://www.sahibinden.com/satilik-daire',
    selectors: {
      listingContainer: '.searchResultsItem',
      title: '.classifiedTitle', 
      price: '.searchResultsPriceValue',
      location: '.searchResultsLocationValue'
    },
    maxItems: 10,
    timeout: 30000
  },
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString()
};

let jobs = [mockJob];
let results = [];

// Middleware to validate API key
function validateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  
  const apiKey = authHeader?.replace('Bearer ', '') || apiKeyHeader;
  
  if (!apiKey || apiKey !== VALID_API_KEY) {
    console.log('❌ Invalid API key:', apiKey?.substring(0, 10) + '...');
    return res.status(401).json({ 
      valid: false,
      error: 'Invalid API key' 
    });
  }
  
  console.log('✅ API key validated');
  next();
}

// Routes
app.get('/v1/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/v1/auth/validate', (req, res) => {
  console.log('🔑 API key validation requested');
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  
  const apiKey = authHeader?.replace('Bearer ', '') || apiKeyHeader;
  
  if (apiKey && apiKey === VALID_API_KEY) {
    console.log('✅ API key validation successful');
    res.json({ valid: true, message: 'API key is valid' });
  } else {
    console.log('❌ API key validation failed');
    res.status(401).json({ valid: false, message: 'Invalid API key' });
  }
});

app.get('/v1/jobs/pending', validateApiKey, (req, res) => {
  console.log('📋 Jobs polling request - returning', jobs.length, 'job(s)');
  res.json({ 
    jobs: jobs,
    count: jobs.length,
    timestamp: new Date().toISOString()
  });
});

app.post('/v1/jobs/results', validateApiKey, (req, res) => {
  const result = req.body;
  console.log('📥 Job result received:', result.jobId);
  console.log('   Items extracted:', result.data?.length || 0);
  
  results.push(result);
  
  // Remove completed job
  jobs = jobs.filter(job => job.id !== result.jobId);
  console.log('✅ Job completed and removed from queue');
  
  res.json({ success: true, message: 'Result received' });
});

// Start server
app.listen(port, () => {
  console.log('🚀 Simple Mock API Server running on http://localhost:3001');
  console.log('📝 Valid API Key:', VALID_API_KEY);
  console.log('📋 Mock job ready for polling');
  console.log('');
  console.log('Waiting for extension requests...');
});