#!/usr/bin/env node

/**
 * Mock API Server for local development and testing
 * This mimics the Sentio API server for testing the Chrome extension
 */

import express from 'express';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Mock API key for testing
const VALID_API_KEY = 'test_api_key_12345678901234567890123456';

// Mock job queue
let mockJobs = [
  {
    id: 'job_001',
    token: 'token_001',
    type: 'listing_scrape',
    config: {
      url: 'https://www.sahibinden.com/satilik-daire',
      selectors: {
        listingContainer: '.searchResultsItem',
        title: '.classifiedTitle',
        price: '.searchResultsPriceValue',
        location: '.searchResultsLocationValue',
        date: '.searchResultsDateValue'
      },
      filters: {
        maxPrice: 1000000,
        minRooms: 2
      },
      maxItems: 10,
      timeout: 30000
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
  }
];

// Mock results storage
let jobResults = [];

// Middleware to check API key
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers.authorization || req.headers['x-api-key'];
  
  if (!apiKey || !apiKey.includes(VALID_API_KEY)) {
    return res.status(401).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
  
  next();
};

// Health check endpoint
app.get('/v1/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Validate API key
app.post('/v1/auth/validate', (req, res) => {
  const apiKey = req.headers.authorization || req.headers['x-api-key'];
  
  if (apiKey && apiKey.includes(VALID_API_KEY)) {
    res.json({ valid: true, message: 'API key is valid' });
  } else {
    res.status(401).json({ 
      valid: false, 
      message: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
});

// Get pending jobs
app.get('/v1/jobs/pending', validateApiKey, (req, res) => {
  // Return available jobs
  const pendingJobs = mockJobs.filter(job => 
    new Date(job.expiresAt) > new Date()
  );
  
  console.log(`📋 Returning ${pendingJobs.length} pending jobs`);
  res.json({ 
    jobs: pendingJobs,
    count: pendingJobs.length,
    timestamp: new Date().toISOString()
  });
});

// Submit job results
app.post('/v1/jobs/results', validateApiKey, (req, res) => {
  const result = req.body;
  
  console.log(`✅ Received job result for job ${result.jobId}`);
  console.log(`   Items extracted: ${result.data?.length || 0}`);
  console.log(`   Status: ${result.status}`);
  
  // Store result
  jobResults.push({
    ...result,
    receivedAt: new Date().toISOString()
  });
  
  // Remove completed job from queue
  mockJobs = mockJobs.filter(job => job.id !== result.jobId);
  
  res.json({ 
    success: true, 
    message: 'Result received successfully',
    resultId: `result_${Date.now()}`
  });
});

// Get job results (for debugging)
app.get('/v1/jobs/results', validateApiKey, (req, res) => {
  res.json({
    results: jobResults,
    count: jobResults.length
  });
});

// Add new job (for testing)
app.post('/v1/jobs', validateApiKey, (req, res) => {
  const newJob = {
    id: `job_${Date.now()}`,
    token: `token_${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  };
  
  mockJobs.push(newJob);
  
  console.log(`➕ Added new job: ${newJob.id}`);
  res.json({ success: true, job: newJob });
});

// Reset jobs (for testing)
app.post('/v1/reset', (req, res) => {
  mockJobs = [];
  jobResults = [];
  console.log('🔄 Reset all jobs and results');
  res.json({ success: true, message: 'All data reset' });
});

app.listen(port, () => {
  console.log(`🚀 Mock Sentio API Server running on http://localhost:${port}`);
  console.log(`📝 Valid API Key for testing: ${VALID_API_KEY}`);
  console.log(`\n🔗 Available endpoints:`);
  console.log(`   GET  /v1/health              - Health check`);
  console.log(`   POST /v1/auth/validate       - Validate API key`);
  console.log(`   GET  /v1/jobs/pending        - Get pending jobs`);
  console.log(`   POST /v1/jobs/results        - Submit job results`);
  console.log(`   GET  /v1/jobs/results        - View job results`);
  console.log(`   POST /v1/jobs                - Add new job`);
  console.log(`   POST /v1/reset               - Reset all data`);
  console.log(`\n⚡ Extension should be configured to use: http://localhost:${port}/v1`);
});
