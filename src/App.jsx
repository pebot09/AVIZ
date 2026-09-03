import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from './lib/firebase.js';
import { paths } from './lib/paths.js';
import { resolveTenant, resolveAccessCode } from './lib/tenant.js';
import { sendLoginLink, completeLoginIfPresent, watchAuth, logout } from './lib/auth.js';
import { provisionTenant } from './lib/provision.js';
import EscolaApp from './components/EscolaApp.jsx';
import Onboarding from './onboarding/Onboarding.jsx';

export default function App() {
  const tenant = resolveTenant();
  const accessCode = resolveAccessCode();

  const [user, setUser] = useState(undefined); // undefined = carregando; null = deslogado
  const [erro, setErro] = useState(null);

  useEffect(() => {
    // Fecha o login se caímos aqui vindos de um link mágico.
    completeLoginIfPresent().catch((e) => setErro(e.message));
    return watchAuth(setUser);
  }, []);

  if (accessCode) return <Shell><AlunoPlaceholder code={accessCode} /></Shell>;
  if (user === undefined) return <Shell><p style={s.dim}>Carregando…</p></Shell>;
  // Sem escola no endereço → criar uma (fluxo de onboarding).
  if (!tenant) return <Onboarding user={user || null} />;
  if (!user) return <Shell><Login tenant={tenant} erro={erro} /></Shell>;
  return <Dono tenant={tenant} user={user} />;
}

function Login({ tenant, erro }) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setFalha(null);
    try { await sendLoginLink(email); setEnviado(true); }
    catch (err) { setFalha(err.message); }
    finally { setEnviando(false); }
  }

  if (enviado) {
    return (
      <div>
        <h2 style={s.h2}>Confira seu e-mail</h2>
        <p style={s.p}>Mandamos um link de acesso para <b>{email}</b>. Abra o e-mail e clique para entrar.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar}>
      <h2 style={s.h2}>Entrar — {tenant}</h2>
      <p style={s.p}>Acesso do responsável pela escola. Enviamos um link, sem senha.</p>
      <input
        type="email" required placeholder="seu@email.com" value={email}
        onChange={(e) => setEmail(e.target.value)} style={s.input} autoFocus
      />
      <button type="submit" disabled={enviando} style={s.btn}>
        {enviando ? 'Enviando…' : 'Receber link de acesso'}
      </button>
      {(falha || erro) && <p style={s.err}>{falha || erro}</p>}
    </form>
  );
}

function Dono({ tenant, user }) {
  const [membro, setMembro] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    async function checar() {
      // Volta do link de onboarding? Provisiona a escola pendente antes de checar.
      try {
        const raw = localStorage.getItem('aviz_pending_onboarding');
        if (raw) {
          const p = JSON.parse(raw);
          if (p && p.slug === tenant) {
            await provisionTenant({ ...p, uid: user.uid });
            localStorage.removeItem('aviz_pending_onboarding');
          }
        }
      } catch { /* ignore */ }
      const snap = await get(ref(db, paths.member(tenant, user.uid))).catch(() => null);
      if (vivo) setMembro(snap && snap.exists() ? snap.val() : null);
    }
    checar();
    return () => { vivo = false; };
  }, [tenant, user.uid]);

  if (membro === undefined) return <Shell><p style={s.dim}>Verificando acesso…</p></Shell>;

  if (membro === null) {
    return (
      <Shell>
        <div style={s.rowTop}>
          <h2 style={s.h2}>{tenant}</h2>
          <button onClick={() => logout()} style={s.link}>sair</button>
        </div>
        <p style={s.p}>Logado como <b>{user.email}</b>.</p>
        <div style={s.aviso}>
          <p style={s.p}>Esta conta não tem acesso à escola <b>{tenant}</b>.</p>
          <p style={s.dim}>Se você é o responsável, use o link de acesso enviado ao e-mail cadastrado.</p>
        </div>
      </Shell>
    );
  }

  return <EscolaApp tenant={tenant} user={user} membro={membro} />;
}

function AlunoPlaceholder({ code }) {
  return (
    <div>
      <h2 style={s.h2}>Painel do aluno</h2>
      <p style={s.p}>Código: <code style={s.code}>{code}</code></p>
      <p style={s.dim}>Este painel vai ler os dados por uma função no servidor
        (fatia-no-servidor), em construção. Acesso direto ao banco fica bloqueado
        de propósito.</p>
    </div>
  );
}

function SemTenant() {
  return (
    <div>
      <h2 style={s.h2}>Nenhuma escola no endereço</h2>
      <p style={s.p}>Em desenvolvimento, abra com <code style={s.code}>?e=nome-da-escola</code>.</p>
    </div>
  );
}

function Shell({ children }) {
  return (
    <main style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>AVIZ</div>
        {children}
      </div>
    </main>
  );
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  card: { background: '#fff', borderRadius: 16, padding: '28px 26px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', maxWidth: 420, width: '100%' },
  logo: { fontSize: 22, letterSpacing: 2, color: '#1f2937', fontWeight: 700, marginBottom: 18 },
  h2: { margin: '0 0 6px', fontSize: 20, color: '#111827' },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  p: { margin: '6px 0', fontSize: 14, color: '#374151', lineHeight: 1.5 },
  dim: { margin: '6px 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.5 },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1px solid #d1d5db', borderRadius: 8, margin: '12px 0' },
  btn: { width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer' },
  link: { background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
  err: { color: '#dc2626', fontSize: 13, marginTop: 10 },
  aviso: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginTop: 12 },
  ok: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginTop: 12 },
  code: { background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 12, wordBreak: 'break-all' },
};
