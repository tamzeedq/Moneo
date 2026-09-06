const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { summarize } = require('./lib/budget');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const PUBLIC_DIR_REALPATH = fs.realpathSync(PUBLIC_DIR);

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { paychecks: [], allocations: [] };
  }
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(content);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };

  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
}

function resolvePublicFile(requestPathname) {
  const cleanPath = requestPathname.replace(/^\/+/, '') || 'index.html';
  const fullPath = path.resolve(PUBLIC_DIR, cleanPath);
  const relativePath = path.relative(PUBLIC_DIR_REALPATH, fullPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  return fullPath;
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Request too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function validateEntry(date, amount) {
  if (!date || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    return 'A valid date is required';
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
    return 'Amount must be a non-negative number';
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/data') {
    const data = readData();
    return sendJson(res, 200, data);
  }

  if (req.method === 'GET' && url.pathname === '/api/summary') {
    const data = readData();
    const granularity = url.searchParams.get('granularity') === 'biweekly' ? 'biweekly' : 'monthly';
    return sendJson(res, 200, { summary: summarize(data.paychecks, data.allocations, granularity) });
  }

  if (req.method === 'POST' && url.pathname === '/api/paychecks') {
    try {
      const payload = await collectRequestBody(req);
      const error = validateEntry(payload.date, payload.amount);
      if (error) {
        return sendJson(res, 400, { error });
      }

      const data = readData();
      const paycheck = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: payload.date,
        amount: Number(payload.amount),
        note: payload.note || ''
      };
      data.paychecks.push(paycheck);
      writeData(data);
      return sendJson(res, 201, { paycheck });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/allocations') {
    try {
      const payload = await collectRequestBody(req);
      const error = validateEntry(payload.date, payload.amount);
      if (error) {
        return sendJson(res, 400, { error });
      }
      const allowedTypes = new Set(['investment', 'savings', 'spending']);
      if (!allowedTypes.has(payload.type)) {
        return sendJson(res, 400, { error: 'Type must be one of investment, savings, or spending' });
      }

      const data = readData();
      const allocation = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        paycheckId: payload.paycheckId || null,
        date: payload.date,
        amount: Number(payload.amount),
        type: payload.type,
        account: payload.account || 'Unspecified',
        note: payload.note || ''
      };
      data.allocations.push(allocation);
      writeData(data);
      return sendJson(res, 201, { allocation });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }

  if (req.method === 'GET') {
    const filePath = resolvePublicFile(url.pathname);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    return sendFile(res, filePath);
  }

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Moneo running at http://localhost:${PORT}`);
  });
}

module.exports = { server };
