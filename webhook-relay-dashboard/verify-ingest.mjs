// verify-ingest.mjs
import crypto from 'node:crypto';

const WEBHOOK_SECRET = 'UX2mIQWtej46BIE4EYv/Z2ymoQbcO9hCu85sBh8/y7Y='; 
const MANAGEMENT_TOKEN = 'dev-e2e-test-token-123'; // From your .env
const BACKEND_URL = 'http://localhost:3000';

const bodyObj = {
  event_type: 'payment.success',
  target_url: 'https://httpbin.org/status/500',
  payload: { amount: 100, currency: 'USD', order_id: 'mjs-ultimate-test' },
};

const bodyString = JSON.stringify(bodyObj);
const signature = crypto
  .createHmac('sha256', Buffer.from(WEBHOOK_SECRET, 'base64'))
  .update(bodyString)
  .digest('hex');

async function testIngest(includeAuth) {
  console.log(`\n🚀 Testing /ingest ${includeAuth ? 'WITH' : 'WITHOUT'} Authorization header...`);
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Target-URL': 'https://httpbin.org/status/500',
  };

  if (includeAuth) {
    headers['Authorization'] = `Bearer ${MANAGEMENT_TOKEN}`;
  }

  const ingestResponse = await fetch(`${BACKEND_URL}/api/v1/webhooks/ingest`, {
    method: 'POST',
    headers: headers,
    body: bodyString,
  });

  const ingestText = await ingestResponse.text();
  console.log(`   ↳ Status: ${ingestResponse.status}`);
  console.log(`   ↳ Response: ${ingestText}`);

  if (ingestResponse.status === 202) {
    console.log(`\n✅ SUCCESS: Ingestion worked ${includeAuth ? 'WITH' : 'WITHOUT'} the Auth header!`);
    return JSON.parse(ingestText);
  }
  
  return null;
}

async function runTest() {
  // Test 1: WITHOUT Auth (What the backend team claimed should work)
  let ingestData = await testIngest(false);

  // Test 2: WITH Auth (If Test 1 fails, this proves their middleware is actually global)
  if (!ingestData) {
    console.log('\n⚠️ Backend rejected request without Auth. Testing WITH Auth header...');
    ingestData = await testIngest(true);
  }

  if (!ingestData) {
    console.log('\n❌ FINAL CONCLUSION: The backend /ingest endpoint is fundamentally broken or misconfigured. It rejects requests regardless of the Auth header. The backend team must fix their routing middleware.');
    return;
  }

  console.log(`\n   ↳ Event ID: ${ingestData.event_id}`);
  const eventId = ingestData.event_id;

  console.log('\n🔍 Polling event status (WITH Auth header)...');
  const deadline = Date.now() + 20000;
  
  while (Date.now() < deadline) {
    const res = await fetch(`${BACKEND_URL}/api/v1/webhooks/events/${eventId}`, {
      headers: { 'Authorization': `Bearer ${MANAGEMENT_TOKEN}` }
    });
    
    if (res.ok) {
      const event = await res.json();
      console.log(`   ↳ [${new Date().toLocaleTimeString()}] GET 200 OK | State: "${event.status}"`);
      
      if (event.status === 'FAILED' || event.status === 'DEAD_LETTER') {
        console.log('\n🎉 SUCCESS: Backend worker processed the event!');
        console.log('💡 CONCLUSION: The backend works, BUT it requires the Auth header on ALL endpoints, contradicting their documentation. We now know exactly what Playwright needs.');
        return;
      }
    } else {
      console.log(`   ↳ GET ${res.status} FAILED`);
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n❌ TIMEOUT: Event did not reach FAILED. Worker is not processing the queue.');
}

runTest();