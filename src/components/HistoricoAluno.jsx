import { arr, getTurmaLabel, todayStr, fmtBRFull, nomeExatoMatch, corDoAutor } from '../domain/helpers.js';

// Histórico do aluno — portado do Passarinho (HistoricoAlunoContent).
// Junta entradas do log + faltas passadas + reposições realizadas, em ordem.
export default function HistoricoAluno({ alunoNome, turmaId, state }) {
  const td = todayStr();
  const turmaLabel = turmaId ? getTurmaLabel(state.turmas, turmaId) : null;

  const logEntries = arr(state.log)
    .filter((e) => {
      const atuouComoAluno = e.origem === 'aluno' && e.professor === alunoNome;
      if (!atuouComoAluno && !nomeExatoMatch(e.descricao, alunoNome)) return false;
      if (turmaLabel) return e.descricao.includes(turmaLabel);
      return true;
    })
    .map((e) => ({ ts: e.ts, texto: e.descricao, tipo: 'log', autor: e.professor, origem: e.origem }));

  const faltaEvents = arr(state.faltas)
    .filter((f) => f.alunoNome === alunoNome && (!turmaId || f.turmaId === turmaId))
    .flatMap((f) => arr(f.datas).filter((d) => d < td).map((d) => ({
      ts: d + 'T23:59:00',
      texto: `Faltou — ${getTurmaLabel(state.turmas, f.turmaId)} em ${fmtBRFull(d)}`,
      tipo: 'falta', autor: f.criadoPor || null,
    })));

  const repoEvents = arr(state.reposicoes)
    .filter((r) => r.alunoNome === alunoNome && r.realizada && (!turmaId || r.turmaOrigemId === turmaId))
    .map((r) => ({
      ts: r.dataReposicao + 'T23:58:00',
      texto: `Repôs — ${getTurmaLabel(state.turmas, r.turmaReposicaoId)} em ${fmtBRFull(r.dataReposicao)}`,
      tipo: 'repo', autor: r.criadoPor || null,
    }));

  const all = [...logEntries, ...faltaEvents, ...repoEvents].sort((a, b) => b.ts.localeCompare(a.ts));

  if (all.length === 0) return <p className="text-xs text-gray-400 py-2 italic">Sem histórico registrado.</p>;

  return (
    <div className="space-y-1">
      {all.map((e, i) => {
        const dt = new Date(e.ts);
        const dataHora = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
          (e.tipo === 'log' ? ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
        const cores = e.autor ? corDoAutor(e.autor) : null;
        return (
          <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
            <span className={`shrink-0 mt-0.5 ${e.tipo === 'falta' ? 'text-red-400' : e.tipo === 'repo' ? 'text-blue-400' : 'text-gray-400'}`}>
              {e.tipo === 'falta' ? '✗' : e.tipo === 'repo' ? '↩' : '•'}
            </span>
            <span className="text-gray-700 flex-1">{e.texto}</span>
            {e.autor && (
              <span className={`inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${cores.bg} ${cores.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cores.dot}`}></span>
                {e.autor}
              </span>
            )}
            <span className="text-gray-300 shrink-0">{dataHora}</span>
          </div>
        );
      })}
    </div>
  );
}
