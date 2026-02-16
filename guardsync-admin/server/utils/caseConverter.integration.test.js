/**
 * Integration Test for Case Converter Middleware
 * 
 * This test demonstrates how the middleware automatically converts
 * between camelCase (frontend) and snake_case (backend) in Express routes.
 */

import express from 'express';
import caseConverterMiddleware from '../middleware/caseConverter.js';

const app = express();

// Setup middleware
app.use(express.json());
app.use(caseConverterMiddleware);

// Mock route that receives camelCase and returns snake_case data
app.post('/api/test/guard', (req, res) => {
  console.log('\n📥 Request Body Received by Handler (should be snake_case):');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Simulate database response with snake_case (database best practice)
  const dbResponse = {
    id: 'guard-123',
    employee_id: req.body.employee_id, // Should be snake_case after middleware conversion
    site_id: req.body.site_id,
    clock_in_time: req.body.clock_in_time,
    full_name: 'John Doe',
    daily_rate: 750,
    is_active: true
  };
  
  console.log('\n📤 Response Sent by Handler (snake_case):');
  console.log(JSON.stringify(dbResponse, null, 2));
  
  // Return snake_case data - middleware will convert to camelCase
  res.json(dbResponse);
});

// Start test server
const PORT = 4001; // Different port to avoid conflicts
const server = app.listen(PORT, async () => {
  console.log('\n🧪 Starting Case Converter Middleware Integration Test\n');
  console.log('=' .repeat(60));
  
  try {
    // Simulate frontend request with camelCase
    const frontendPayload = {
      employeeId: 'EMP001',
      siteId: 'SITE001',
      clockInTime: '2024-01-01T08:00:00Z',
      fullName: 'Jane Smith',
      homeAddress: {
        streetNumber: 123,
        cityName: 'New York'
      }
    };
    
    console.log('📱 Frontend sends (camelCase):');
    console.log(JSON.stringify(frontendPayload, null, 2));
    
    // Make request to test server
    const response = await fetch(`http://localhost:${PORT}/api/test/guard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(frontendPayload)
    });
    
    const result = await response.json();
    
    console.log('\n✅ Frontend receives (should be camelCase):');
    console.log(JSON.stringify(result, null, 2));
    
    // Verify the conversion worked correctly
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Verification:');
    
    const checks = [
      { 
        name: 'Response has employeeId (camelCase)', 
        pass: result.employeeId !== undefined 
      },
      { 
        name: 'Response has siteId (camelCase)', 
        pass: result.siteId !== undefined 
      },
      { 
        name: 'Response has clockInTime (camelCase)', 
        pass: result.clockInTime !== undefined 
      },
      { 
        name: 'Response has fullName (camelCase)', 
        pass: result.fullName !== undefined 
      },
      { 
        name: 'Response has dailyRate (camelCase)', 
        pass: result.dailyRate !== undefined 
      },
      { 
        name: 'Response has isActive (camelCase)', 
        pass: result.isActive !== undefined 
      },
      { 
        name: 'Response does NOT have employee_id (snake_case)', 
        pass: result.employee_id === undefined 
      },
      { 
        name: 'Values preserved correctly', 
        pass: result.employeeId === 'EMP001' && result.siteId === 'SITE001'
      }
    ];
    
    let allPassed = true;
    for (const check of checks) {
      console.log(check.pass ? '  ✅' : '  ❌', check.name);
      if (!check.pass) allPassed = false;
    }
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✅ SUCCESS: Case Converter Middleware is working correctly!');
      console.log('   - Frontend sends camelCase');
      console.log('   - Backend receives snake_case');
      console.log('   - Backend returns snake_case');
      console.log('   - Frontend receives camelCase');
    } else {
      console.log('❌ FAILED: Some checks did not pass');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Close server
    server.close();
  }
});
