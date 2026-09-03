import { resolveTenant, resolveAccessCode } from './lib/tenant.js';

// Casca inicial do AVIZ. Ainda sem Firebase — só prova que a resolução de
// tenant e o roteamento básico (painel x aluno) funcionam. As telas reais
// entram quando a fundação multi-tenant + Auth estiver plugada (Fase 1).

export default function App() {
  const tenant = resolveTenant();
  const accessCode = resolveAccessCode();

  return (
    <main style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.logo}>AVIZ</h1>
        <p style={styles.sub}>Gestão de faltas e reposições</p>

        <div style={styles.status}>
          <Linha rotulo="Escola (tenant)" valor={tenant || '— nenhuma —'} />
          <Linha rotulo="Modo" valor={accessCode ? 'Painel do aluno' : 'Painel da escola'} />
          {accessCode && <Linha rotulo="Código de acesso" valor={accessCode} />}
        </div>

        {!tenant && (
          <p style={styles.dica}>
            Nenhuma escola no endereço. Em desenvolvimento, abra com{' '}
            <code style={styles.code}>?e=nome-da-escola</code>.
          </p>
        )}

        <p style={styles.rodape}>Esqueleto — fundação em construção (Fase 1).</p>
      </div>
    </main>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div style={styles.linha}>
      <span style={styles.rotulo}>{rotulo}</span>
      <span style={styles.valor}>{valor}</span>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#faf9f7', padding: 24,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '32px 28px',
    boxShadow: '0 1px 3px rgba(0,0,0,.08)', maxWidth: 420, width: '100%',
  },
  logo: { margin: 0, fontSize: 34, letterSpacing: 2, color: '#1f2937' },
  sub: { margin: '4px 0 24px', color: '#6b7280', fontSize: 14 },
  status: { display: 'flex', flexDirection: 'column', gap: 8 },
  linha: {
    display: 'flex', justifyContent: 'space-between', gap: 12,
    fontSize: 14, padding: '8px 0', borderBottom: '1px solid #f3f4f6',
  },
  rotulo: { color: '#6b7280' },
  valor: { color: '#111827', fontWeight: 600 },
  dica: { marginTop: 20, fontSize: 13, color: '#6b7280', lineHeight: 1.5 },
  code: { background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 },
  rodape: { marginTop: 24, fontSize: 12, color: '#9ca3af' },
};
