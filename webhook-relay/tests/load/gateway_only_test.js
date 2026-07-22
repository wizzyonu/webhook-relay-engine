import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '30s', target: 500 }, // Spike to test mutex contention
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // Realistic threshold for a single-node mutex-bound rate limiter under 500 VUs
    http_req_duration: ['p(95)<150'], 
    // We expect 429s, so we don't use the global http_req_failed threshold
  },
};

export default function () {
  const payload = JSON.stringify({ event: 'gateway.test', id: uuidv4() });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': 'sha256=mock_signature', // Intentionally invalid to fail fast at HMAC check
      'X-Target-URL': 'https://httpbin.org/post',
    },
  };

  const res = http.post('http://localhost:3000/api/v1/webhooks/ingest', payload, params);
  
  check(res, {
    // The gateway should securely reject with 401 (bad sig) or 429 (rate limited)
    'status is secure (401 or 429)': (r) => r.status === 401 || r.status === 429,
  });

  sleep(0.02);
}