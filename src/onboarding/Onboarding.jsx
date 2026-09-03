import { useMemo, useState } from 'react';
import { Campo, TextInput, NumberSelect, Select, OptionCards, SimNao, ArtigoNome } from './widgets.jsx';
import { slugify, slugDisponivelAuto, provisionTenant } from '../lib/provision.js';
import { sendLoginLink } from '../lib/auth.js';

const VOC_ALUNO = [
  { value: 'aluno', label: 'aluno', plural: 'alunos' },
  { value: 'praticante', label: 'praticante', plural: 'praticantes' },
  { value: 'atleta', label: 'atleta', plural: 'atletas' },
  { value: 'paciente', label: 'paciente', plural: 'pacientes' },
];
const VOC_TURMA = [
  { value: 'turma', label: 'turma', plural: 'turmas' },
  { value: 'aula', label: 'aula', plural: 'aulas' },
  { value: 'sessão', label: 'sessão', plural: 'sessões' },
  { value: 'horário', label: 'horário', plural: 'horários' },
];
const VOC_PROF = [
  { value: 'professor', label: 'professor', plural: 'professores' },
  { value: 'instrutor', label: 'instrutor', plural: 'instrutores' },
  { value: 'treinador', label: 'treinador', plural: 'treinadores' },
  { value: 'terapeuta', label: 'terapeuta', plural: 'terapeutas' },
];

function plural(value, opts) {
  const found = opts.find((o) => o.value === value);
  return found ? found.plural : (value ? value + 's' : '');
}

const HORAS_ANTEC = [
  { value: 0, label: 'Sem exigência' },
  { value: 1, label: '1 hora' }, { value: 2, label: '2 horas' }, { value: 3, label: '3 horas' },
  { value: 6, label: '6 horas' }, { value: 12, label: '12 horas' }, { value: 24, label: '24 horas' }, { value: 48, label: '48 horas' },
];

// Contração de preposição + artigo (o/a): ao/à, do/da, no/na.
function contrair(prep, artigo) {
  const a = artigo === 'a' ? 'a' : 'o';
  if (prep === 'a') return a === 'a' ? 'à' : 'ao';
  if (prep === 'de') return a === 'a' ? 'da' : 'do';
  if (prep === 'em') return a === 'a' ? 'na' : 'no';
  return prep;
}

const INICIAL = {
  donoNome: '', donoArtigo: '', nomeEscola: '', espacoArtigo: '', slug: '', slugEditado: false,
  vAluno: 'aluno', vTurma: 'turma', vProfessor: 'professor',
  capNominal: 0, capFisica: 0,
  antecedencia: 24, semAntec: null, semAntecJanela: 2,
  vagaExtra: null, vagaExtraQuando: 'vespera',
  ferias: null, feriasCredito: null, feriasCreditos: 1, feriasValidade: 30, feriasLimiteAno: 1,
};

export default function Onboarding({ user }) {
  const [r, setR] = useState(INICIAL);
  const [i, setI] = useState(0);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [saibaMais, setSaibaMais] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const set = (patch) => setR((prev) => ({ ...prev, ...patch }));

  const A = r.vAluno || 'aluno', As = plural(r.vAluno, VOC_ALUNO);
  const T = r.vTurma || 'turma', Ts = plural(r.vTurma, VOC_TURMA);

  // Passos visíveis (condicionais).
  const steps = useMemo(() => {
    const s = [];
    s.push('dono'); s.push('espaco'); s.push('vocAluno'); s.push('vocTurma'); s.push('vocProf');
    s.push('capNominal'); s.push('capFisica');
    s.push('avisoRegras');
    s.push('antecedencia');
    if (r.antecedencia > 0) { s.push('semAntec'); if (r.semAntec) s.push('semAntecJanela'); }
    s.push('vagaExtra'); if (r.vagaExtra) s.push('vagaExtraQuando');
    s.push('ferias');
    if (r.ferias) { s.push('feriasCredito'); if (r.feriasCredito) { s.push('feriasCreditos'); s.push('feriasValidade'); s.push('feriasLimite'); } }
    s.push('revisao');
    return s;
  }, [r]);

  const step = steps[Math.min(i, steps.length - 1)];
  const ehUltimo = step === 'revisao';

  function podeAvancar() {
    switch (step) {
      case 'dono': return r.donoNome.trim().length > 0 && !!r.donoArtigo;
      case 'espaco': return r.nomeEscola.trim().length > 0 && !!r.espacoArtigo && slugify(r.nomeEscola).length > 0;
      case 'capNominal': return Number(r.capNominal) >= 1;
      case 'capFisica': return Number(r.capFisica) >= 1;
      case 'semAntec': return r.semAntec !== null;
      case 'vagaExtra': return r.vagaExtra !== null;
      case 'ferias': return r.ferias !== null;
      case 'feriasCredito': return r.feriasCredito !== null;
      default: return true;
    }
  }

  function avancar() {
    setErro(null);
    if (!podeAvancar()) { setErro('Responda para continuar.'); return; }
    if (i < steps.length - 1) setI(i + 1);
  }
  function voltar() { setErro(null); if (i > 0) setI(i - 1); }

  function montarConfig() {
    return {
      vocab: {
        aluno: A, alunos: As, turma: T, turmas: Ts,
        professor: r.vProfessor || 'professor', professores: plural(r.vProfessor, VOC_PROF),
        espacoArtigo: r.espacoArtigo || 'o',
      },
      regras: {
        capacidadeNominal: Number(r.capNominal) || 7,
        capacidadeFisica: Number(r.capFisica) || Number(r.capNominal) || 8,
        antecedenciaHoras: Number(r.antecedencia) || 0,
        semAntecedencia: r.antecedencia > 0 ? !!r.semAntec : false,
        semAntecedenciaJanela: r.semAntec ? Number(r.semAntecJanela) || 2 : 0,
        vagaExtra: !!r.vagaExtra,
        vagaExtraAbertura: r.vagaExtra ? r.vagaExtraQuando : null,
        ferias: !!r.ferias,
        feriasCredito: r.ferias ? !!r.feriasCredito : false,
        feriasCreditos: r.feriasCredito ? Number(r.feriasCreditos) || 1 : 0,
        feriasValidadeDias: r.feriasCredito ? Number(r.feriasValidade) || 30 : 0,
        feriasLimiteAno: r.feriasCredito ? r.feriasLimiteAno : null,
      },
      criadoEm: new Date().toISOString(),
    };
  }

  async function finalizar() {
    setErro(null); setSalvando(true);
    try {
      const base = slugify(r.nomeEscola);
      if (!base) throw new Error('Nome do espaço inválido.');
      const slug = await slugDisponivelAuto(base);
      const config = montarConfig();
      const payload = { slug, nomeEscola: r.nomeEscola.trim(), artigo: r.espacoArtigo || 'o', cor: '#2563eb', donoNome: r.donoNome.trim(), donoGenero: r.donoArtigo || 'o', config };

      if (user) {
        await provisionTenant({ ...payload, uid: user.uid });
        window.location.href = `/?e=${slug}`;
        return;
      }
      // Sem login: guarda e manda link mágico; o provisionamento roda no retorno.
      try { localStorage.setItem('aviz_pending_onboarding', JSON.stringify(payload)); } catch { /* ignore */ }
      await sendLoginLink(email, `${window.location.origin}/?e=${slug}`);
      setEnviado(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (enviado) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Quase lá!</h2>
        <p className="text-sm text-gray-600">Mandamos um link para <b>{email}</b>. Clique nele para entrar e o seu app será criado.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-[10px] tracking-[0.2em] text-gray-300 font-semibold mb-5">AVIZ</div>

      <div className="min-h-[160px]">
        {step === 'dono' && (
          <Passo titulo="Como podemos te chamar?" ajuda="O artigo (O / A) nos diz como te tratar — no masculino ou no feminino.">
            <Campo label="Seu nome">
              <ArtigoNome artigo={r.donoArtigo} nome={r.donoNome}
                onArtigo={(v) => set({ donoArtigo: v })} onNome={(v) => set({ donoNome: v })}
                placeholder="Seu nome" autoFocus />
            </Campo>
          </Passo>
        )}

        {step === 'espaco' && (
          <Passo titulo={`Prazer${r.donoNome ? ', ' + r.donoNome : ''}! Qual o nome do espaço?`} ajuda="Escolha o artigo (O / A) e digite o nome — é o que vai aparecer grande no app.">
            <Campo label="Nome do espaço">
              <ArtigoNome artigo={r.espacoArtigo} nome={r.nomeEscola}
                onArtigo={(v) => set({ espacoArtigo: v })}
                onNome={(v) => set({ nomeEscola: v })}
                placeholder="Nome do espaço" autoFocus />
            </Campo>
          </Passo>
        )}

        {step === 'vocAluno' && (
          <Passo titulo={`Como vocês chamam quem vem ${contrair('a', r.espacoArtigo)} ${r.nomeEscola || 'espaço'}?`}>
            <OptionCards value={r.vAluno} onChange={(v) => set({ vAluno: v })} options={VOC_ALUNO} permiteOutro />
          </Passo>
        )}
        {step === 'vocTurma' && (
          <Passo titulo={`E como chamam um encontro — a "${T}"?`} ajuda={`O grupo que se encontra num dia e horário fixos.`}>
            <OptionCards value={r.vTurma} onChange={(v) => set({ vTurma: v })} options={VOC_TURMA} permiteOutro />
          </Passo>
        )}
        {step === 'vocProf' && (
          <Passo titulo="E quem dá as aulas?">
            <OptionCards value={r.vProfessor} onChange={(v) => set({ vProfessor: v })} options={VOC_PROF} permiteOutro />
          </Passo>
        )}

        {step === 'capNominal' && (
          <Passo titulo={`Qual o máximo de ${As} por ${T}?`} ajuda="O tamanho ideal de uma turma cheia.">
            <Campo><input type="number" min="1" value={r.capNominal} onChange={(e) => set({ capNominal: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-28" /></Campo>
          </Passo>
        )}
        {step === 'capFisica' && (
          <Passo titulo={`E o máximo de ${As} no espaço ao mesmo tempo?`} ajuda="O limite real da sala — é o que permite abrir vagas de reposição além da turma cheia.">
            <Campo><input type="number" min="1" value={r.capFisica} onChange={(e) => set({ capFisica: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-28" /></Campo>
          </Passo>
        )}

        {step === 'avisoRegras' && (
          <Passo titulo="Agora, as regras" ajuda="As próximas perguntas definem como funcionam faltas e reposições no seu espaço.">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              Não se preocupe em acertar tudo agora: <b>todas essas regras podem ser alteradas a qualquer momento</b> no painel, depois que a escola estiver criada.
            </div>
          </Passo>
        )}

        {step === 'antecedencia' && (
          <Passo titulo={`Com quanto tempo o ${A} precisa avisar que vai faltar?`} ajuda="Abaixo desse prazo, o aviso conta como “em cima da hora”.">
            <Campo><NumberSelect value={r.antecedencia} onChange={(v) => set({ antecedencia: v })} options={HORAS_ANTEC} /></Campo>
          </Passo>
        )}
        {step === 'semAntec' && (
          <Passo titulo="Permitir falta sem antecedência?" ajuda={`Quando o aviso chega perto demais da ${T}: o ${A} ainda pode faltar, mas o direito de repor fica limitado.`}>
            <SimNao value={r.semAntec} onChange={(v) => set({ semAntec: v })} />
            <button onClick={() => setSaibaMais((x) => !x)} className="text-blue-600 text-sm underline mt-3">
              {saibaMais ? 'ocultar' : 'saiba mais'}
            </button>
            {saibaMais && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 mt-2 space-y-2 fade-in">
                <p>Você acabou de definir um prazo mínimo de aviso ({r.antecedencia}h). Quem avisa <b>dentro</b> desse prazo — em cima da hora — está faltando "sem antecedência".</p>
                <p>Se você <b>permitir</b>: essa pessoa ainda pode marcar sua falta em cima da hora, mas só consegue repor também em cima da hora — não com folga. É um mecanismo pra priorizar quem avisa com antecedência, mas também atender a quem sofre com imprevistos.</p>
                <p>Se você <b>não permitir</b>: faltar sem o aviso mínimo simplesmente não dá direito a reposição.</p>
              </div>
            )}
          </Passo>
        )}
        {step === 'semAntecJanela' && (
          <Passo titulo="Até quantas horas antes ainda vale avisar sem antecedência?" ajuda="Esse mesmo número define até quando o aluno pode marcar uma reposição sem antecedência.">
            <Campo><NumberSelect value={r.semAntecJanela} onChange={(v) => set({ semAntecJanela: v })} options={Array.from({ length: r.antecedencia }, (_, k) => ({ value: k + 1, label: `${k + 1}h` }))} /></Campo>
          </Passo>
        )}

        {step === 'vagaExtra' && (
          <Passo titulo={`Liberar vaga extra para os ${As}?`} ajuda={`Quando sobra espaço na sala num dia, a cadeira fica disponível para alguém repor ali.`}>
            <SimNao value={r.vagaExtra} onChange={(v) => set({ vagaExtra: v })} />
          </Passo>
        )}
        {step === 'vagaExtraQuando' && (
          <Passo titulo="Quando a vaga extra deve abrir?">
            <Campo>
              <Select
                value={r.vagaExtraQuando} onChange={(v) => set({ vagaExtraQuando: v })}
                options={[{ value: 'vespera', label: 'Na véspera' }, { value: '6h', label: '6 horas antes' }, { value: '12h', label: '12 horas antes' }, { value: '2d', label: '2 dias antes' }, { value: '3d', label: '3 dias antes' }]}
              />
            </Campo>
          </Passo>
        )}

        {step === 'ferias' && (
          <Passo titulo="Vocês oferecem marcação de férias?">
            <SimNao value={r.ferias} onChange={(v) => set({ ferias: v })} />
          </Passo>
        )}
        {step === 'feriasCredito' && (
          <Passo titulo="As férias dão direito a crédito de reposição?">
            <SimNao value={r.feriasCredito} onChange={(v) => set({ feriasCredito: v })} />
          </Passo>
        )}
        {step === 'feriasCreditos' && (
          <Passo titulo="Quantos créditos por período de férias?">
            <Campo><NumberSelect value={r.feriasCreditos} onChange={(v) => set({ feriasCreditos: v })} options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} /></Campo>
          </Passo>
        )}
        {step === 'feriasValidade' && (
          <Passo titulo="Quanto tempo o crédito dura?">
            <Campo><NumberSelect value={r.feriasValidade} onChange={(v) => set({ feriasValidade: v })} options={[30, 45, 60, 90].map((n) => ({ value: n, label: `${n} dias` }))} /></Campo>
          </Passo>
        )}
        {step === 'feriasLimite' && (
          <Passo titulo="Tem limite de férias por ano?">
            <Campo>
              <NumberSelect value={r.feriasLimiteAno} onChange={(v) => set({ feriasLimiteAno: v })}
                options={[{ value: 1, label: '1 vez por ano' }, { value: 2, label: '2 vezes por ano' }, { value: 0, label: 'Sem limite' }]} />
            </Campo>
          </Passo>
        )}

        {step === 'revisao' && (
          <Passo titulo="Tudo certo?" ajuda="Você pode mudar qualquer uma dessas regras depois, no painel.">
            <ul className="text-sm text-gray-600 space-y-1">
              <li><b>{r.nomeEscola}</b></li>
              <li>Vocabulário: {A} · {T} · {r.vProfessor}</li>
              <li>Capacidade: {r.capNominal} por {T}, {r.capFisica} no espaço</li>
              <li>Aviso de falta: {r.antecedencia === 0 ? 'sem exigência' : `${r.antecedencia}h`}{r.antecedencia > 0 && r.semAntec ? ` (sem antecedência até ${r.semAntecJanela}h antes)` : ''}</li>
              <li>Vaga extra: {r.vagaExtra ? `sim (${r.vagaExtraQuando})` : 'não'}</li>
              <li>Férias: {r.ferias ? (r.feriasCredito ? `sim, ${r.feriasCreditos} crédito(s), ${r.feriasValidade} dias` : 'sim, sem crédito') : 'não'}</li>
            </ul>
            {!user && (
              <Campo label="Seu e-mail (para entrar e receber o acesso)"><TextInput value={email} onChange={setEmail} placeholder="voce@email.com" /></Campo>
            )}
          </Passo>
        )}
      </div>

      {erro && <p className="text-red-600 text-sm mt-3">{erro}</p>}

      <div className="flex justify-between items-center mt-6">
        <button onClick={voltar} disabled={i === 0} className="text-sm text-gray-500 disabled:opacity-30">← Voltar</button>
        {ehUltimo ? (
          <button onClick={finalizar} disabled={salvando || (!user && !email.trim())} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40">
            {salvando ? 'Criando…' : 'Criar meu app'}
          </button>
        ) : (
          <button onClick={avancar} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">Avançar →</button>
        )}
      </div>
    </Card>
  );
}

function Passo({ titulo, ajuda, children }) {
  return (
    <div className="fade-in">
      <h2 className="text-lg font-bold text-gray-800 mb-1">{titulo}</h2>
      {ajuda && <p className="text-sm text-gray-500 mb-4">{ajuda}</p>}
      <div className={ajuda ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

function Card({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7 max-w-md w-full">{children}</div>
    </main>
  );
}
