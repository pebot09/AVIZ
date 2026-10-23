import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from './lib/firebase.js';
import { paths } from './lib/paths.js';
import { resolveTenant, resolveAccessCode, ultimoTenant, lembrarTenant, esquecerTenant, querEscolaNova } from './lib/tenant.js';
import { sendLoginLink, completeLoginIfPresent, linkPedeEmail, watchAuth, logout } from './lib/auth.js';
import { verConvite, aceitarConvite } from './lib/escolaApi.js';
import { VERSAO_TEXTOS } from './legal/operador.js';
import { entrarComEmailPin, definirMeuPin, minhasEscolas } from './lib/contaApi.js';
import { PIN_CONTA_TAMANHO, problemaDoPinConta } from './domain/conta.js';
import EscolaApp from './components/EscolaApp.jsx';
import AlunoRoot from './components/aluno/AlunoRoot.jsx';
import Onboarding from './onboarding/Onboarding.jsx';
import PaginaLegal from './legal/PaginaLegal.jsx';
import { paginaLegal, LINK_TERMOS, LINK_PRIVACIDADE } from './legal/rota.js';
import { mensagemDeErro } from './lib/erros.js';
import { ehAppIos } from './lib/instalavel.js';

export default function App() {
  const noEndereco = resolveTenant();
  const novo = querEscolaNova();
  // Sem escola no endereço, volta para a última acessada neste navegador.
  const tenant = noEndereco || (novo ? null : ultimoTenant());
  const accessCode = resolveAccessCode();

  const [user, setUser] = useState(undefined); // undefined = carregando; null = deslogado
  const [erro, setErro] = useState(null);
  const [pedeEmail, setPedeEmail] = useState(() => linkPedeEmail());

  useEffect(() => {
    // Fecha o login se caímos aqui vindos de um link mágico.
    completeLoginIfPresent().catch((e) => setErro(mensagemDeErro(e)));
    return watchAuth(setUser);
  }, []);

  // Termos e Privacidade abrem para qualquer um, logado ou não.
  const legal = paginaLegal();
  if (legal) return <PaginaLegal qual={legal} />;

  // Link do aluno: precisa de escola + código. O link é gerado com os dois.
  if (accessCode) {
    if (!tenant) return <Shell><LinkIncompleto /></Shell>;
    return <AlunoRoot tenant={tenant} codigo={accessCode} />;
  }
  // Convite de dono de escola nova: aceitar os Termos e escolher o PIN.
  const convite = new URLSearchParams(window.location.search).get('convite');
  if (convite) return <Shell><Convite convite={convite} /></Shell>;
  if (pedeEmail) return <Shell><ConfirmarEmail onPronto={() => setPedeEmail(false)} /></Shell>;
  if (user === undefined) return <Shell><p style={s.dim}>Carregando…</p></Shell>;
  // Criar escola é sempre um pedido explícito (?novo=1). Nunca o destino de
  // quem só abriu o app sem endereço — era assim que se criava uma escola
  // duplicada e vazia sem perceber.
  // Criar escola: só o administrador, logado (o Onboarding confere).
  if (novo && user) return <Onboarding user={user} />;
  if (!user) return <Shell><Login tenant={tenant} erro={erro} /></Shell>;
  // Voltou do link "Esqueci meu PIN" (ou do convite): escolhe o PIN primeiro.
  if (querNovoPin()) return <Shell><NovoPin tenant={tenant} /></Shell>;
  // Logado sem escola no endereço: o app descobre de quais escolas a conta é.
  if (!tenant) return <Shell><EscolherEscola user={user} /></Shell>;
  return <Dono tenant={tenant} user={user} />;
}

// Abre o convite: mostra a escola e o e-mail, pede o aceite dos Termos e o PIN
// (se a pessoa ainda não tem conta no AVIZ). Aceitou → já entra como dono.
export function Convite({ convite, inicial }) {
  const [info, setInfo] = useState(inicial); // undefined = carregando
  const [falha, setFalha] = useState(null);
  const [pin, setPin] = useState('');
  const [conf, setConf] = useState('');
  const [aceito, setAceito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (inicial) return;
    let vivo = true;
    verConvite(convite).then((d) => { if (vivo) setInfo(d); }).catch((e) => { if (vivo) { setInfo(null); setFalha(mensagemDeErro(e)); } });
    return () => { vivo = false; };
  }, [convite, inicial]);

  async function entrar(e) {
    e.preventDefault();
    setFalha(null);
    if (!info.temConta) {
      const problema = problemaDoPinConta(pin);
      if (problema) { setFalha(problema); return; }
      if (pin !== conf) { setFalha('Os dois PINs não são iguais.'); return; }
    }
    setSalvando(true);
    try {
      const slug = await aceitarConvite(convite, info.temConta ? undefined : pin, VERSAO_TEXTOS);
      irPara(slug);
    } catch (err) { setFalha(mensagemDeErro(err)); setSalvando(false); }
  }

  if (info === undefined) return <p style={s.dim}>Abrindo o convite…</p>;
  if (!info) {
    return (
      <div>
        <h2 style={s.h2}>Convite indisponível</h2>
        <p style={s.p}>{falha}</p>
        <p style={s.dim}>Se você já aceitou, entre com seu e-mail e PIN em <a href="/">{window.location.host}</a>.</p>
      </div>
    );
  }
  return (
    <form onSubmit={entrar}>
      <h2 style={s.h2}>Bem-vindo{info.donoNome ? `, ${info.donoNome}` : ''}!</h2>
      <p style={s.p}>O app de <b>{info.escola}</b> está pronto. Você vai entrar com o e-mail <b>{info.email}</b>.</p>
      {info.temConta ? (
        <p style={s.dim}>Você já tem conta no AVIZ: depois de aceitar, use o PIN que já usa.</p>
      ) : (
        <>
          <p style={s.p}>Escolha um PIN de {PIN_CONTA_TAMANHO} números. É com ele que você entra.</p>
          <CampoPin value={pin} onChange={setPin} placeholder="PIN" autoComplete="new-password" aria-label="PIN" />
          <CampoPin value={conf} onChange={setConf} placeholder="Repita o PIN" autoComplete="new-password" aria-label="Repita o PIN" style={{ ...s.input, marginTop: 0 }} />
        </>
      )}
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#4b5563', margin: '8px 0 14px' }}>
        <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          Li e aceito os <a href={LINK_TERMOS} target="_blank" rel="noreferrer">Termos de Uso</a> e a{' '}
          <a href={LINK_PRIVACIDADE} target="_blank" rel="noreferrer">Política de Privacidade</a>, e declaro que posso cadastrar os nomes que vou inserir.
        </span>
      </label>
      <button type="submit" disabled={salvando || !aceito || (!info.temConta && (pin.length !== PIN_CONTA_TAMANHO || conf.length !== PIN_CONTA_TAMANHO))} style={s.btn}>
        {salvando ? 'Entrando…' : 'Entrar no app'}
      </button>
      {falha && <p style={s.err}>{falha}</p>}
    </form>
  );
}

const querNovoPin = () => new URLSearchParams(window.location.search).has('novopin');

// Logado, sem escola no endereço: busca as escolas da conta. Uma só → entra
// direto; várias → a pessoa escolhe. Ninguém precisa digitar endereço.
function EscolherEscola({ user }) {
  const [escolas, setEscolas] = useState(undefined);
  const [falha, setFalha] = useState(null);
  useEffect(() => {
    let vivo = true;
    minhasEscolas()
      .then((lista) => {
        if (!vivo) return;
        if (lista.length === 1) { irPara(lista[0].e); return; }
        setEscolas(lista);
      })
      .catch((e) => { if (vivo) { setEscolas([]); setFalha(mensagemDeErro(e)); } });
    return () => { vivo = false; };
  }, [user.uid]);

  if (escolas === undefined) return <p style={s.dim}>Abrindo sua escola…</p>;
  return (
    <div>
      <div style={s.rowTop}>
        <h2 style={s.h2}>{escolas.length ? 'Suas escolas' : 'Nenhuma escola'}</h2>
        <button onClick={() => logout()} style={s.link}>sair</button>
      </div>
      {user.email && <p style={s.dim}>{user.email}</p>}
      {escolas.length === 0 && !falha && (
        <p style={s.p}>Esta conta ainda não está em nenhuma escola. Se você é professor, peça ao responsável para te cadastrar com este e-mail.</p>
      )}
      {escolas.map((x) => (
        <button key={x.e} onClick={() => irPara(x.e)} style={{ ...s.btnSec, marginTop: 10, textAlign: 'left' }}>{x.nome}</button>
      ))}
      {falha && <p style={s.err}>{falha}</p>}
    </div>
  );
}

function irPara(slug) {
  lembrarTenant(slug);
  window.location.replace(`/?e=${encodeURIComponent(slug)}`);
}

// Escolher (ou trocar) o PIN da conta, depois de entrar pelo link do e-mail.
export function NovoPin({ tenant }) {
  const [pin, setPin] = useState('');
  const [conf, setConf] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState(null);
  async function salvar(e) {
    e.preventDefault();
    setFalha(null);
    const problema = problemaDoPinConta(pin);
    if (problema) { setFalha(problema); return; }
    if (pin !== conf) { setFalha('Os dois PINs não são iguais.'); return; }
    setSalvando(true);
    try {
      await definirMeuPin(pin);
      window.location.replace(tenant ? `/?e=${encodeURIComponent(tenant)}` : '/');
    } catch (err) { setFalha(mensagemDeErro(err)); setSalvando(false); }
  }
  return (
    <form onSubmit={salvar}>
      <h2 style={s.h2}>Escolha seu PIN</h2>
      <p style={s.p}>São {PIN_CONTA_TAMANHO} números. Você vai entrar no AVIZ com seu e-mail e este PIN.</p>
      <CampoPin value={pin} onChange={setPin} placeholder="PIN" autoFocus autoComplete="new-password" />
      <CampoPin value={conf} onChange={setConf} placeholder="Repita o PIN" autoComplete="new-password" />
      <button type="submit" disabled={salvando || pin.length !== PIN_CONTA_TAMANHO || conf.length !== PIN_CONTA_TAMANHO} style={s.btn}>
        {salvando ? 'Salvando…' : 'Salvar e entrar'}
      </button>
      {falha && <p style={s.err}>{falha}</p>}
    </form>
  );
}

// Campo de PIN: teclado numérico no celular, só dígitos, tamanho fixo.
function CampoPin({ value, onChange, tamanho = PIN_CONTA_TAMANHO, ...resto }) {
  return (
    <input
      type="password" inputMode="numeric" pattern="[0-9]*"
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, tamanho))}
      style={{ ...s.input, letterSpacing: value ? 8 : 0 }} {...resto}
    />
  );
}

// Entrada: e-mail + PIN de 4 números, igual para dono e professor.
export function Login({ tenant, erro }) {
  const [esqueci, setEsqueci] = useState(false);
  if (esqueci) return <EsqueciPin tenant={tenant} onVoltar={() => setEsqueci(false)} />;
  return (
    <div>
      <LoginConta erro={erro} />
      <button onClick={() => setEsqueci(true)} style={{ ...s.link, marginTop: 14 }}>Esqueci meu PIN</button>
    </div>
  );
}

function LoginConta({ erro }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [falha, setFalha] = useState(null);
  async function entrar(e) {
    e.preventDefault();
    setEntrando(true); setFalha(null);
    // Sucesso: o watchAuth do App percebe a sessão nova e segue sozinho.
    try { await entrarComEmailPin(email, pin); }
    catch (err) { setFalha(mensagemDeErro(err)); setPin(''); setEntrando(false); }
  }
  return (
    <form onSubmit={entrar}>
      <h2 style={s.h2}>Entrar</h2>
      <input type="email" required placeholder="seu@email.com" value={email} autoComplete="username"
        onChange={(e) => setEmail(e.target.value)} style={s.input} aria-label="E-mail" />
      <CampoPin value={pin} onChange={setPin} placeholder={`PIN (${PIN_CONTA_TAMANHO} números)`}
        autoComplete="current-password" aria-label="PIN" style={{ ...s.input, marginTop: 0 }} />
      <button type="submit" disabled={entrando || !email || pin.length !== PIN_CONTA_TAMANHO} style={s.btn}>
        {entrando ? 'Entrando…' : 'Entrar'}
      </button>
      {(falha || erro) && <p style={s.err}>{falha || erro}</p>}
    </form>
  );
}

// "Esqueci meu PIN": manda um link para o e-mail; ao abrir, a pessoa escolhe
// um PIN novo (NovoPin). O e-mail vai no próprio link, para não precisar
// digitar de novo se ele abrir noutro navegador.
export function EsqueciPin({ tenant, onVoltar }) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState(null);
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setFalha(null);
    try {
      const limpo = email.trim().toLowerCase();
      const q = new URLSearchParams({ ...(tenant ? { e: tenant } : {}), novopin: '1', email: limpo });
      await sendLoginLink(limpo, `${window.location.origin}/?${q}`);
      setEnviado(true);
    } catch (err) { setFalha(mensagemDeErro(err)); }
    finally { setEnviando(false); }
  }
  if (enviado) {
    return (
      <div>
        <h2 style={s.h2}>Confira seu e-mail</h2>
        <p style={s.p}>Mandamos um link para <b>{email}</b>. Abra o link e escolha um PIN novo.</p>
        <p style={s.dim}>O e-mail vem do Firebase e fala em "fazer login": é esse mesmo. Ao tocar no link, o AVIZ abre a tela para escolher o PIN.</p>
        {ehAppIos() && <p style={s.dim}>No iPhone, o link abre no Safari. Crie o PIN por lá e depois volte aqui e entre com ele.</p>}
        <button onClick={onVoltar} style={{ ...s.link, marginTop: 14 }}>← Voltar para entrar</button>
      </div>
    );
  }
  return (
    <form onSubmit={enviar}>
      <h2 style={s.h2}>Esqueci meu PIN</h2>
      <p style={s.p}>Enviamos um link para o seu e-mail. Ao abrir, você escolhe um PIN novo.</p>
      <input type="email" required placeholder="seu@email.com" value={email}
        onChange={(e) => setEmail(e.target.value)} style={s.input} autoFocus aria-label="E-mail" />
      <button type="submit" disabled={enviando} style={s.btn}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
      {falha && <p style={s.err}>{falha}</p>}
      <button type="button" onClick={onVoltar} style={{ ...s.link, marginTop: 14 }}>← Voltar</button>
    </form>
  );
}

function Dono({ tenant, user }) {
  const [membro, setMembro] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    async function checar() {
      const lerMembro = async () => {
        const snap = await get(ref(db, paths.member(tenant, user.uid))).catch(() => null);
        return snap && snap.exists() ? snap.val() : null;
      };
      const m = await lerMembro();
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
        {user.email && <p style={s.p}>Logado como <b>{user.email}</b>.</p>}
        <div style={s.aviso}>
          <p style={s.p}>Esta conta não tem acesso à escola <b>{tenant}</b>.</p>
          <p style={s.dim}>{user.email
            ? 'Confira se este é o e-mail cadastrado nesta escola.'
            : 'Seu acesso de professor foi removido. Fale com o responsável pela escola.'}</p>
        </div>
        {user.email && (
          <button onClick={() => { esquecerTenant(tenant); window.location.replace('/'); }} style={{ ...s.btnSec, marginTop: 12 }}>
            Ver minhas escolas
          </button>
        )}
      </Shell>
    );
  }

  return <EscolaApp tenant={tenant} user={user} membro={membro} />;
}

// Link de login aberto noutro aparelho: o Firebase exige o mesmo e-mail para
// fechar o login. Antes era um window.prompt — que parece golpe e some fácil.
function ConfirmarEmail({ onPronto }) {
  const [email, setEmail] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [falha, setFalha] = useState(null);
  async function entrar(e) {
    e.preventDefault();
    setEntrando(true); setFalha(null);
    try { await completeLoginIfPresent(email); onPronto(); }
    catch { setFalha('Não deu para entrar com esse e-mail. Confira se é o mesmo para onde o link foi enviado, ou peça um link novo.'); setEntrando(false); }
  }
  return (
    <form onSubmit={entrar}>
      <h2 style={s.h2}>Confirme seu e-mail</h2>
      <p style={s.p}>Para terminar de entrar neste aparelho, digite o e-mail que recebeu o link.</p>
      <input type="email" required placeholder="seu@email.com" value={email}
        onChange={(e) => setEmail(e.target.value)} style={s.input} autoFocus />
      <button type="submit" disabled={entrando} style={s.btn}>{entrando ? 'Entrando…' : 'Entrar'}</button>
      {falha && <p style={s.err}>{falha}</p>}
    </form>
  );
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
      <p style={s.rodape}>
        <a href={LINK_TERMOS} style={s.rodapeLink}>Termos de Uso</a> · <a href={LINK_PRIVACIDADE} style={s.rodapeLink}>Privacidade</a>
      </p>
    </main>
  );
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
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
  abas: { display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 18 },
  aba: { flex: 1, padding: '7px 10px', fontSize: 13, fontWeight: 600, color: '#6b7280', background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer' },
  abaOn: { flex: 1, padding: '7px 10px', fontSize: 13, fontWeight: 600, color: '#111827', background: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.08)' },
  aviso: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginTop: 12 },
  ok: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginTop: 12 },
  rodape: { fontSize: 12, color: '#9ca3af', marginTop: 14 },
  rodapeLink: { color: '#9ca3af' },
  code: { background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 12, wordBreak: 'break-all' },
};
