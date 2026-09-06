import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from './lib/firebase.js';
import { paths } from './lib/paths.js';
import { resolveTenant, resolveAccessCode, ultimoTenant, lembrarTenant, querEscolaNova } from './lib/tenant.js';
import { sendLoginLink, completeLoginIfPresent, watchAuth, logout } from './lib/auth.js';
import { provisionTenant } from './lib/provision.js';
import EscolaApp from './components/EscolaApp.jsx';
import AlunoRoot from './components/aluno/AlunoRoot.jsx';
import Onboarding from './onboarding/Onboarding.jsx';

export default function App() {
  const noEndereco = resolveTenant();
  const novo = querEscolaNova();
  // Sem escola no endereço, volta para a última acessada neste navegador.
  const tenant = noEndereco || (novo ? null : ultimoTenant());
  const accessCode = resolveAccessCode();

  const [user, setUser] = useState(undefined); // undefined = carregando; null = deslogado
  const [erro, setErro] = useState(null);

  useEffect(() => {
    // Fecha o login se caímos aqui vindos de um link mágico.
    completeLoginIfPresent().catch((e) => setErro(e.message));
    return watchAuth(setUser);
  }, []);

  // Link do aluno: precisa de escola + código. O link é gerado com os dois.
  if (accessCode) {
    if (!tenant) return <Shell><LinkIncompleto /></Shell>;
    return <AlunoRoot tenant={tenant} codigo={accessCode} />;
  }
  if (user === undefined) return <Shell><p style={s.dim}>Carregando…</p></Shell>;
  // Criar escola é sempre um pedido explícito (?novo=1). Nunca o destino de
  // quem só abriu o app sem endereço — era assim que se criava uma escola
  // duplicada e vazia sem perceber.
  if (novo) return <Onboarding user={user || null} />;
  if (!tenant) return <Shell><Entrada /></Shell>;
  if (!user) return <Shell><Login tenant={tenant} erro={erro} /></Shell>;
  return <Dono tenant={tenant} user={user} />;
}

// Tela de partida quando não dá para saber a escola: escolher é do usuário,
// não do app.
function Entrada() {
  const [slug, setSlug] = useState('');
  return (
    <div>
      <h2 style={s.h2}>Bem-vindo</h2>
      <p style={s.p}>Entre no seu espaço ou crie um novo.</p>
      <form
        onSubmit={(e) => { e.preventDefault(); const v = slug.trim(); if (v) window.location.href = `/?e=${encodeURIComponent(v)}`; }}
        style={{ marginTop: 18 }}
      >
        <label style={s.dim}>Endereço do seu espaço</label>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: meu-espaco" style={s.input} />
        <button type="submit" style={s.btn}>Entrar</button>
      </form>
      <p style={{ ...s.dim, textAlign: 'center', margin: '18px 0 8px' }}>ou</p>
      <button onClick={() => { window.location.href = '/?novo=1'; }} style={s.btnSec}>Criar um espaço novo</button>
    </div>
  );
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
            // Limpa ANTES de provisionar: se a criação falhar no meio, a chave
            // não pode ficar presa e reprovisionar a cada login daí em diante.
            localStorage.removeItem('aviz_pending_onboarding');
            await provisionTenant({ ...p, uid: user.uid });
          }
        }
      } catch { /* ignore */ }
      const snap = await get(ref(db, paths.member(tenant, user.uid))).catch(() => null);
      const m = snap && snap.exists() ? snap.val() : null;
      // Só lembra a escola em que o acesso foi confirmado.
      if (m) lembrarTenant(tenant);
      if (vivo) setMembro(m);
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

function LinkIncompleto() {
  return (
    <div>
      <h2 style={s.h2}>Link incompleto</h2>
      <p style={s.p}>Este link não diz de qual espaço ele é.</p>
      <p style={s.dim}>Peça o link completo para quem dá a aula — ele tem o
        endereço do espaço e o seu código.</p>
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
  btnSec: { width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' },
  link: { background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
  err: { color: '#dc2626', fontSize: 13, marginTop: 10 },
  aviso: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginTop: 12 },
  ok: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginTop: 12 },
  code: { background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 12, wordBreak: 'break-all' },
};
