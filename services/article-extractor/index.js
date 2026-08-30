import express from 'express';
import { chromium } from 'playwright';
import {
  createApiKeyGuard,
  isAllowedBrowserRequest,
  parseAllowedHosts,
  validateTargetUrl
} from './lib/security.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 10420);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';
const ALLOWED_HOSTS = parseAllowedHosts(process.env.ALLOWED_HOSTS);

if (!INTERNAL_API_KEY) {
  console.error('Missing required environment variable: INTERNAL_API_KEY');
  process.exit(1);
}

let browser;
const requireApiKey = createApiKeyGuard(INTERNAL_API_KEY);

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

  const validation = validateTargetUrl(url, ALLOWED_HOSTS);
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.error });
  }
  const parsed = validation.url;

  let context;
  try {
    const b = await getBrowser();
    context = await b.newContext({
      userAgent: 'Mozilla/5.0 (compatible; StreszCzarka/1.0; +portfolio)',
      javaScriptEnabled: true
    });

    // Enforce the allowlist for every browser network request, not only the
    // initial URL. This also blocks redirects or subrequests to unexpected hosts.
    await context.route('**/*', async route => {
      const requestUrl = route.request().url();
      if (isAllowedBrowserRequest(requestUrl, ALLOWED_HOSTS)) {
        return route.continue();
      }
      return route.abort('blockedbyclient');
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
