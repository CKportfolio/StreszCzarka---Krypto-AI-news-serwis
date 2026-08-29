const fs = require('fs');

for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
  if (!process.env[name]) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

let html = fs.readFileSync('index.template.html', 'utf8');
html = html
  .replaceAll('__SUPABASE_URL__', process.env.SUPABASE_URL)
  .replaceAll('__SUPABASE_ANON_KEY__', process.env.SUPABASE_ANON_KEY);

fs.writeFileSync('index.html', html);
console.log('Built index.html');
