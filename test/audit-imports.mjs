// Caça identificador usado sem import.
//
// Esse erro NÃO quebra o build: o bundler trata o nome como possível global e
// só estoura em runtime, como tela branca. Já aconteceu aqui.
import fs from 'fs';
import path from 'path';

const raizes = ['src'];
const arquivos = [];
(function andar(dir) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) andar(p);
    else if (/\.(js|jsx)$/.test(nome)) arquivos.push(p);
  }
})(raizes[0]);

const todosExports = new Set();
for (const p of arquivos) {
  const s = fs.readFileSync(p, 'utf8');
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    todosExports.add(m[1]);
  }
}

const HOOKS = ['useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'useReducer', 'Fragment'];
let problemas = 0;

for (const p of arquivos) {
  const s = fs.readFileSync(p, 'utf8');
  const importados = new Set();
  for (const m of s.matchAll(/import\s+([^;]+?)\s+from\s+['"][^'"]+['"]/g)) {
    for (const n of m[1].matchAll(/([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?/g)) {
      importados.add(n[2] || n[1]);
    }
  }
  const locais = new Set([...s.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]));
  // parâmetros desestruturados de componente contam como locais
  for (const m of s.matchAll(/\(\s*\{([^}]*)\}/g)) {
    for (const n of m[1].matchAll(/([A-Za-z0-9_$]+)\s*[,:}]?/g)) locais.add(n[1]);
  }

  const conferir = (nome, ehJsx) => {
    if (importados.has(nome) || locais.has(nome)) return;
    const usoChamada = new RegExp(`\\b${nome}\\s*\\(`);
    const usoJsx = new RegExp(`<${nome}[\\s/>]`);
    if (usoChamada.test(s) || (ehJsx && usoJsx.test(s))) {
      console.log(`  FALTA IMPORT: ${p} usa "${nome}"`);
      problemas++;
    }
  };
  for (const nome of todosExports) conferir(nome, true);
  for (const h of HOOKS) {
    if (new RegExp(`\\b${h}\\b`).test(s) && !importados.has(h) && !locais.has(h)) {
      console.log(`  FALTA IMPORT: ${p} usa "${h}" (React)`);
      problemas++;
    }
  }
}

console.log(problemas ? `\n❌ ${problemas} identificador(es) sem import` : `\n✅ imports ok (${arquivos.length} arquivos)`);
process.exit(problemas ? 1 : 0);
