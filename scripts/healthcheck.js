const http = require('http');

const port = process.env.PORT || 3001;

const req = http.request(
  { hostname: 'localhost', port, path: '/health', method: 'GET', timeout: 5000 },
  (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        if (res.statusCode === 200 && health.status === 'healthy') {
          process.exit(0);
        } else {
          console.error('Unhealthy:', health.status);
          process.exit(1);
        }
      } catch {
        console.error('Invalid health response');
        process.exit(1);
      }
    });
  }
);

req.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timed out');
  req.destroy();
  process.exit(1);
});

req.end();
