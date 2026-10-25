import dotenv from 'dotenv';
dotenv.config();

import { initDatabase } from '../src/db/database';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthorizationUrl,
  exchangeCodeForTokens,
} from '../src/marketplace/mercadolivre/ml-auth';

const code = process.argv[2];
const codeVerifier = process.argv[3];

async function main() {
  await initDatabase();

  if (!code || !codeVerifier) {
    // Step 1: generate PKCE and show auth URL
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const url = getAuthorizationUrl(challenge);

    console.log('🔐 Autenticação Mercado Livre (com PKCE)\n');
    console.log('1. Abra este link no navegador:\n');
    console.log(url);
    console.log('\n2. Autorize o aplicativo.');
    console.log('3. Copie a URL completa da barra de endereços após o redirect.');
    console.log('\n4. Execute novamente com o código e o verifier:\n');
    console.log(`npx tsx scripts/exchange-token.ts "<CÓDIGO>" "${verifier}"`);
    console.log('\n⚠️  O code_verifier acima é único para esta sessão. Não perca!');
    return;
  }

  // Step 2: exchange code for tokens
  console.log('⏳ Trocando código por tokens...');
  await exchangeCodeForTokens(code, codeVerifier);
  console.log('✅ Tokens salvos com sucesso!');
  console.log('Execute: npm start');
}

main().catch(e => {
  console.error('❌ Erro:', e.response?.data || e.message);
  process.exit(1);
});
