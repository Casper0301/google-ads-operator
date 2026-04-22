// Interactive Google Ads OAuth helper.
//
// Usage:
//   npx tsx scripts/oauth-google.ts <client-slug> <customer-id> "<account-name>" [mcc-id]
//
// Example:
//   npx tsx scripts/oauth-google.ts stjordal-autosalg 1234567890 "Stjørdal Autosalg" 1122334455
//
// 1. Prints the Google authorization URL.
// 2. You open it in your browser, grant access, Google redirects to
//    http://localhost:5432/oauth/google/callback?code=...&state=...
// 3. Copy the `code` param from the redirect URL and paste it at the prompt.
// 4. Script exchanges the code for tokens and stores them encrypted in
//    platform_connections, linked to the given client.

import { randomBytes } from 'node:crypto';
import readline from 'node:readline/promises';
import { buildAuthUrl, exchangeCode, persistConnection } from '../src/oauth/google.js';
import { supabase } from '../src/shared/supabase.js';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const [clientSlug, customerId, accountName, mccId] = process.argv.slice(2);
  if (!clientSlug || !customerId || !accountName) {
    console.error('Usage: tsx scripts/oauth-google.ts <client-slug> <customer-id> "<account-name>" [mcc-id]');
    process.exit(1);
  }

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('slug', clientSlug)
    .single();
  if (error || !client) {
    console.error(`Client not found: ${clientSlug}`);
    console.error('Create the client first via Supabase or the seed SQL.');
    process.exit(1);
  }

  const state = randomBytes(16).toString('hex');
  const url = buildAuthUrl(state);

  console.log('\n=== Google Ads OAuth ===\n');
  console.log(`Client: ${client.name} (${clientSlug})`);
  console.log(`Customer ID: ${customerId}`);
  if (mccId) console.log(`Login (MCC) ID: ${mccId}`);
  console.log('\n1. Open this URL in your browser:\n');
  console.log(url);
  console.log('\n2. Grant access. You will be redirected to a URL like:');
  console.log('   http://localhost:5432/oauth/google/callback?state=...&code=4/0Ab...&scope=...');
  console.log('\n3. Copy the `code` parameter value and paste below.\n');

  const code = await prompt('code: ');
  if (!code) {
    console.error('no code provided');
    process.exit(1);
  }

  const tokens = await exchangeCode(code);
  const connectionId = await persistConnection({
    clientId: client.id,
    customerId,
    accountName,
    mccId,
    tokens,
  });

  console.log(`\nSuccess. Connection id: ${connectionId}`);
  console.log('Tokens encrypted and stored in platform_connections.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
