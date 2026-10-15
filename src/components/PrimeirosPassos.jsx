import { cap } from '../domain/vocab.js';
import { primeirosPassos } from '../domain/primeirosPassos.js';

// Cartão de primeiros passos do dono. Cada passo tem um botão que leva ao
// lugar certo; o ✓ aparece quando o passo está feito.
export default function PrimeirosPassos({ state, vocab, marcados, onPasso, onEsconder }) {
  const passos = primeirosPassos(state, marcados);
  const textos = {
    regras: { titulo: 'Conferir as regras da escola', desc: 'Prazo de reposição, férias, feriados e recessos.', botao: 'Abrir regras' },
    turmas: { titulo: `Cadastrar ${vocab.turmas} e horários`, desc: `Crie cada ${vocab.turma} com os dias e horários.`, botao: `Nova ${vocab.turma}` },
    alunos: { titulo: `Cadastrar ${vocab.alunos}`, desc: `Abra uma ${vocab.turma} e toque em "+ Adicionar ${vocab.aluno}".`, botao: `Ir para ${vocab.turmas}` },
    link: { titulo: `Enviar o link aos ${vocab.alunos}`, desc: `Cada ${vocab.aluno} recebe um link pessoal para avisar faltas e marcar reposições.`, botao: 'Gerar links' },
    professores: { titulo: `Adicionar ${vocab.professores}`, desc: `Eles entram com PIN para lançar faltas no dia a dia.`, botao: `Adicionar ${vocab.professores}` },
  };
  const feitos = passos.filter((p) => !p.opcional && p.feito).length;
  const total = passos.filter((p) => !p.opcional).length;

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-800">Primeiros passos</p>
          <p className="text-xs text-gray-400">{feitos} de {total} feitos</p>
        </div>
        <button onClick={onEsconder} className="text-xs text-gray-400 hover:text-gray-600 underline">Esconder guia</button>
      </div>
      <ol className="space-y-2">
        {passos.map((p, i) => {
          const t = textos[p.key];
          return (
            <li key={p.key} className="flex items-start gap-3">
              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${p.feito ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {p.feito ? '✓' : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${p.feito ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {cap(t.titulo)}{p.opcional && <span className="font-normal text-gray-400"> (opcional)</span>}
                </p>
                {!p.feito && <p className="text-xs text-gray-500">{t.desc}</p>}
              </div>
              {!p.feito && (
                <button onClick={() => onPasso(p.key)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
                  {t.botao}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
