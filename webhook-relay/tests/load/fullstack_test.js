import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const SECRET = 'UX2mIQWtej46BIE4EYv/Z2ymoQbcO9hCu85sBh8/y7Y='; 

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // http_req_duration: ['p(95)<400'], 
    http_req_failed: ['rate<0.01'], 
  },
};

export default function () {
  // 1. Deterministic payload generation
  const payloadObj = {
    event_type: 'fullstack.load',
    transaction_id: uuidv4(),
    amount: Math.floor(Math.random() * 10000),
    timestamp: new Date().toISOString(),
  };
  
  // Explicitly stringify without extra spaces/newlines
  const payloadStr = JSON.stringify(payloadObj);

  // 2. Generate HMAC exactly as Go does: sha256(secret, input) -> hex
  const hash = crypto.hmac("sha256", SECRET, payloadStr, "hex");
  const signature = `sha256=${hash}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Target-URL': 'https://httpbin.org/post',
    },
  };

  const res = http.post('http://localhost:3000/api/v1/webhooks/ingest', payloadStr, params);
  
  // 3. Add a debug check to see what status we are actually getting
  check(res, {
    'status is 202 (Accepted)': (r) => r.status === 202,
    'response time is < 150ms': (r) => r.timings.duration < 150,
  });

  sleep(0.05); 
}