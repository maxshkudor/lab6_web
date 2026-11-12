'use strict';

// ==========================================================================
//   Лабораторна робота №6. Використання Node.js
//   Фреймворк: hapi. Додаткове поле: phone (необов'язкове)
// ==========================================================================

const path = require('node:path');
const os = require('node:os');
const { mkdir, appendFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');

// --- Налаштування ----------------------------------------------------------
const HOST = '0.0.0.0'; // приймати з'єднання з усіх мережевих інтерфейсів
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public'); // абсолютний шлях до статики
const DATA_DIR = path.join(__dirname, 'data'); // поза public/ — недоступно ззовні
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.jsonl');
const MAX_BODY_BYTES = 10 * 1024; // ~10 КБ

const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  subject: 150,
  message: 2000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Варіант: дозволені лише +, цифри, пробіли, ( , ) і -
const PHONE_RE = /^[+\d\s()-]+$/;

// --- Валідація ---------------------------------------------------------------
function validateFeedback(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const { name, email, subject, message } = body;
  const phone = body.phone === undefined || body.phone === null ? '' : body.phone;

  for (const [field, value] of Object.entries({ name, email, subject, message, phone })) {
    if (typeof value !== 'string') {
      return { error: `Field "${field}" must be a string.` };
    }
  }

  const clean = {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    subject: subject.trim(),
    message: message.trim(),
  };

  for (const field of ['name', 'email', 'subject', 'message']) {
    if (clean[field] === '') {
      return { error: `Field "${field}" is required.` };
    }
  }

  for (const [field, max] of Object.entries(LIMITS)) {
    if (clean[field].length > max) {
      return { error: `Field "${field}" must be at most ${max} characters.` };
    }
  }

  if (!EMAIL_RE.test(clean.email)) {
    return { error: 'A valid email address is required.' };
  }

  if (clean.phone !== '' && (!PHONE_RE.test(clean.phone) || !/\d/.test(clean.phone))) {
    return {
      error: 'Phone may contain only digits, spaces, "+", "(", ")" and "-".',
    };
  }

  return { value: clean };
}

// --- Збереження у JSON Lines -------------------------------------------------
async function saveFeedback(record) {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(FEEDBACK_FILE, JSON.stringify(record) + '\n', 'utf8');
}

// --- Сервер ------------------------------------------------------------------
async function createServer() {
  const server = Hapi.server({
    host: HOST,
    port: PORT,
    routes: {
      files: { relativeTo: PUBLIC_DIR },
    },
  });

  await server.register(Inert);

  // Статичні файли: засоби inert, без власної обробки шляхів
  server.route({
    method: 'GET',
    path: '/{param*}',
    handler: {
      directory: {
        path: PUBLIC_DIR,
        index: ['index.html'],
        redirectToSlash: true,
        listing: false,
      },
    },
  });

  // API: прийом звернення з форми
  server.route({
    method: 'POST',
    path: '/api/contact',
    options: {
      payload: {
        parse: true,
        allow: 'application/json',
        maxBytes: MAX_BODY_BYTES,
      },
    },
    handler: async (request, h) => {
      const { error, value } = validateFeedback(request.payload);
      if (error) {
        return h.response({ ok: false, error }).code(400);
      }

      // id і createdAt створює сервер — значенням від клієнта не довіряємо
      const record = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        name: value.name,
        email: value.email,
        phone: value.phone,
        subject: value.subject,
        message: value.message,
      };

      try {
        await saveFeedback(record);
      } catch (err) {
        request.log(['error'], err);
        console.error('[feedback] Failed to save record:', err);
        return h
          .response({ ok: false, error: 'Internal server error. Please try again later.' })
          .code(500);
      }

      console.log(`[feedback] Saved ${record.id}`);
      return h
        .response({ ok: true, message: 'Feedback saved locally.', id: record.id })
        .code(201);
    },
  });

  // Помилки hapi (некоректний JSON, завеликий запит, 404 тощо) для /api/*
  // повертаємо у форматі {"ok":false,"error":"..."} без технічних деталей
  server.ext('onPreResponse', (request, h) => {
    const response = request.response;
    if (!response.isBoom || !request.path.startsWith('/api/')) {
      return h.continue;
    }

    const status = response.output.statusCode;
    const messages = {
      400: 'Request body must be valid JSON.',
      404: 'Not found.',
      405: 'Method not allowed.',
      413: `Request body must not exceed ${MAX_BODY_BYTES} bytes.`,
      415: 'Content-Type must be application/json.',
    };
    if (status >= 500) {
      console.error('[api] Unexpected error:', response);
    }
    const error = messages[status] || (status >= 500 ? 'Internal server error.' : 'Bad request.');
    return h.response({ ok: false, error }).code(status);
  });

  return server;
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

async function start() {
  const server = await createServer();
  await server.start();
  console.log(`Server running on http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`In local network:   http://${ip}:${PORT}`);
  }
  console.log('Press Ctrl+C to stop.');
}

process.on('unhandledRejection', (err) => {
  console.error(err);
  process.exit(1);
});

if (require.main === module) {
  start();
}

module.exports = { createServer, validateFeedback };
