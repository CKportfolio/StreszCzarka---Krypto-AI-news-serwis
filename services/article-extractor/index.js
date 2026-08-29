import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 10420);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'coindesk.com,cointelegraph.com,tradingeconomics.com,google.com')
  .split(',')
  .map(v => v.trim().toLowerCase())
  .filter(Boolean);

let browser;

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
}

function requireApiKey(req, res, next) {
  if (!INTERNAL_API_KEY) return next();
  if (req.get('x-api-key') !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/extract', requireApiKey, async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' });
  }
  if (!isAllowedHost(parsed.hostname)) {
    return res.status(403).json({ error: `Host not allowed: ${parsed.hostname}` });
  }

  let context;
  try {
    const b = await getBrowser();
    context = await b.newContext({
      userAgent: 'Mozilla/5.0 (compatible; StreszCzarka/1.0; +portfolio)',
      javaScriptEnabled: true
    });
    const page = await context.newPage();
    await page.goto(parsed.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => ({
      title: document.querySelector('h1')?.innerText?.trim() || document.title?.trim() || '',
      content: document.body?.innerText?.trim() || ''
    }));

    if (!result.content) {
      return res.status(422).json({ error: 'No readable page content' });
    }

    res.json({
      title: result.title,
      content: result.content,
      url: parsed.toString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Extraction failed' });
  } finally {
    if (context) await context.close().catch(() => {});
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Article extractor listening on ${PORT}`);
});

async function shutdown() {
  server.close();
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
