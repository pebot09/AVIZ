// Nenhum erro do Firebase em inglês chega à tela (src/lib/erros.js).
import { mensagemDeErro } from '../src/lib/erros.js';

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

const fb = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });
checar('e-mail inválido traduzido', /e-mail não parece válido/.test(mensagemDeErro(fb('auth/invalid-email'))));
checar('link expirado traduzido', /expirou/.test(mensagemDeErro(fb('auth/expired-action-code'))));
checar('código desconhecido vira genérico', mensagemDeErro(fb('auth/algo-novo')) === 'Algo deu errado. Tente de novo em instantes.');
checar('permissão negada traduzida', /permissão/.test(mensagemDeErro(new Error('PERMISSION_DENIED: Permission denied'))));
checar('mensagem nossa passa intacta', mensagemDeErro(new Error('Informe o nome.')) === 'Informe o nome.');
checar('nada em inglês sobra', !/Firebase|Error|denied/.test(mensagemDeErro(fb('auth/too-many-requests'))));

if (falhas) { console.log(`\n❌ ${falhas} falha(s)`); process.exit(1); }
console.log('\n✅ mensagens de erro ok');
