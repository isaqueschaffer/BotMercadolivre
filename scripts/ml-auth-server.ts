import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const APP_ID = process.env.ML_APP_ID;
const SECRET = process.env.ML_SECRET;
const REDIRECT_URI = process.env.ML_REDIRECT_URI || 'https://www.google.com.br';

if (!APP_ID || !SECRET) {
  console.error('❌ Configure ML_APP_ID e ML_SECRET no .env');
  process.exit(1);
}

const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('🔐 Autenticação Mercado Livre\n');
console.log('1. Abra este link no navegador:\n');
console.log(authUrl);
console.log('\n2. Faça login e autorize o aplicativo.');
console.log('3. Você será redirecionado para o Google (a página pode dar erro, tudo certo!).');
console.log('4. Copie a URL COMPLETA da barra de endereços do navegador.');
console.log('   (Ela vai conter algo como: ?code=TG-xxxxxxxxxxxx)\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Cole a URL completa aqui: ', async (input) => {
  rl.close();

  let code: string | null = null;

  try {
    const url = new URL(input.trim());
    code = url.searchParams.get('code');
  } catch {
    const match = input.match(/[?&]code=([^&\s]+)/);
    if (match) code = match[1];
  }

  if (!code) {
    console.error('❌ Não foi possível extrair o código da URL. Verifique e tente novamente.');
    process.exit(1);
  }

  console.log(`\n✅ Código extraído: ${code.slice(0, 15)}...`);
  console.log('⏳ Trocando código por tokens...\n');

  try {
    const { initDatabase } = await import('../src/db/database');
    const { exchangeCodeForTokens } = await import('../src/marketplace/mercadolivre/ml-auth');

    await initDatabase();
    await exchangeCodeForTokens(code);

    console.log('✅ Autenticação concluída! Tokens salvos no banco de dados.');
    console.log('Execute: npm start\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao trocar código por tokens:', err);
    process.exit(1);
  }
});
