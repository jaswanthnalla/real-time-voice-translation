#!/usr/bin/env node

const { program } = require('commander');
const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (process.env.API_KEY) {
      options.headers['x-api-key'] = process.env.API_KEY;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

program
  .name('voice-translate')
  .description('CLI for Real-Time Voice Translation System')
  .version('1.0.0');

// Session commands
const session = program.command('session');

session
  .command('create')
  .description('Create a new translation session')
  .requiredOption('--source <lang>', 'Source language code')
  .requiredOption('--target <lang>', 'Target language code')
  .action(async (opts) => {
    try {
      const result = await request('POST', '/api/sessions', {
        sourceLang: opts.source,
        targetLang: opts.target,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

session
  .command('list')
  .description('List all sessions')
  .action(async () => {
    try {
      const result = await request('GET', '/api/sessions');
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

session
  .command('get <id>')
  .description('Get session details')
  .action(async (id) => {
    try {
      const result = await request('GET', `/api/sessions/${id}`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

session
  .command('delete <id>')
  .description('Delete a session')
  .action(async (id) => {
    try {
      const result = await request('DELETE', `/api/sessions/${id}`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

// Translate command
program
  .command('translate <text>')
  .description('Translate text')
  .requiredOption('--source <lang>', 'Source language code')
  .requiredOption('--target <lang>', 'Target language code')
  .action(async (text, opts) => {
    try {
      const result = await request('POST', '/api/translate', {
        text,
        sourceLang: opts.source,
        targetLang: opts.target,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

// Health command
const health = program.command('health');

health
  .command('check')
  .description('Check system health')
  .action(async () => {
    try {
      const result = await request('GET', '/health');
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

// Metrics command
program
  .command('metrics')
  .description('View system metrics')
  .option('--format <format>', 'Output format', 'text')
  .action(async () => {
    try {
      const result = await request('GET', '/metrics');
      console.log(result);
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

program.parse();
