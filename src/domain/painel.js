// Derivação da "lista atual" do painel: agrupa faltas, reposições e vagas, e
// monta as observações (o que está para vencer, o que precisa de atenção).
// Fica no domínio, e não no componente, porque o snapshot congela exatamente
// isto — e porque assim dá para testar sem montar React.

import { arr, fmtBR, fmtBRFull, turmaShortLabel, getFaltaExpiry, getMesNome } from './helpers.js';
import { ausenciaExpiry } from './reposicao.js';

export function construirDados(state, config, td, in7, doisDiasAtras) {
  const turmaLbl = (id) => turmaShortLabel(arr(state.turmas).find((t) => t.id === id));

  // Faltas pendentes agrupadas por aluno+turma
  const agrupar = (faltas) => {
    const map = {};
    faltas.forEach((f) => {
      const key = `${f.alunoNome}|${f.turmaId}`;
      if (!map[key]) map[key] = { alunoNome: f.alunoNome, turmaId: f.turmaId, datas: [], faltas: [] };
      map[key].datas.push(f.datas[0]);
      map[key].faltas.push(f);
    });
    return Object.values(map).map((g) => ({
      ...g,
      proxExpiry: g.faltas.map((f) => getFaltaExpiry(f, config)).sort()[0],
    })).sort((a, b) => [...a.datas].sort()[0].localeCompare([...b.datas].sort()[0]));
  };

  const pendentesGrupos = agrupar(arr(state.faltas).filter((f) => f.status === 'pendente'));
  const marcadasGrupos = agrupar(arr(state.faltas).filter((f) => f.status === 'marcada'));

  const ausencias = arr(state.ausencias).filter((a) => !a.creditoUsado)
    .sort((a, b) => a.mesAno.localeCompare(b.mesAno));

  const combined = [
    ...pendentesGrupos.map((g) => ({ tipo: 'falta', obj: g, sortKey: [...g.datas].sort()[0] })),
    ...ausencias.map((a) => ({ tipo: 'ausencia', obj: a, sortKey: ausenciaExpiry(a, config) })),
  ].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

  const reposAtivas = arr(state.reposicoes).filter((r) => !r.realizada)
    .sort((a, b) => a.dataReposicao.localeCompare(b.dataReposicao));

  const vagasGrupos = (() => {
    const map = {};
    arr(state.vagas).filter((v) => v.data >= td).forEach((v) => {
      const key = `${v.data}|${v.turmaId}`;
      if (!map[key]) map[key] = { data: v.data, turmaId: v.turmaId, count: 0, vagas: [] };
      map[key].count++;
      map[key].vagas.push(v);
    });
    return Object.values(map).sort((a, b) => a.data.localeCompare(b.data));
  })();

  // Observações
  const obs = [];
  arr(state.faltas).filter((f) => f.status === 'pendente').forEach((f) => {
    const exp = getFaltaExpiry(f, config);
    if (exp >= td && exp <= in7) obs.push({ level: 'amber', text: `Falta expirando em ${fmtBRFull(exp)}: ${f.alunoNome} (${turmaLbl(f.turmaId)})` });
  });
  arr((state.estatisticas || {}).faltasExpiradas)
    .filter((e) => e.expiradaEm >= doisDiasAtras && e.expiradaEm < td)
    .forEach((e) => obs.push({ level: 'red', text: `Falta expirada: ${e.alunoNome} (${turmaLbl(e.turmaId)}) — ${fmtBR(e.data)}` }));
  arr(state.ausencias).filter((a) => !a.creditoUsado && a.creditoReposicao > 0).forEach((a) => {
    const exp = ausenciaExpiry(a, config);
    if (exp < td) obs.push({ level: 'red', text: `Crédito de férias expirado: ${a.alunoNome} (${getMesNome(a.mesAno)})` });
    else if (exp <= in7) obs.push({ level: 'amber', text: `Férias de ${a.alunoNome} expirando em ${fmtBRFull(exp)}` });
  });
  const extrasAbertas = {};
  arr(state.vagas).filter((v) => v.vagaExtra && v.data >= td).forEach((v) => {
    const key = `${v.turmaId}|${v.data}`;
    if (!extrasAbertas[key]) extrasAbertas[key] = { turmaId: v.turmaId, data: v.data, count: 0 };
    extrasAbertas[key].count++;
  });
  Object.values(extrasAbertas).sort((a, b) => a.data.localeCompare(b.data)).forEach(({ turmaId, data, count }) => {
    obs.push({ level: 'teal', text: `${count} vaga${count > 1 ? 's' : ''} extra${count > 1 ? 's' : ''} disponíve${count > 1 ? 'is' : 'l'}: ${turmaLbl(turmaId)} — ${fmtBRFull(data)}` });
  });
  arr(state.faltas).filter((f) => f.status === 'pendente' && f.semAntecedencia).forEach((f) => {
    obs.push({ level: 'orange', text: `Falta sem antecedência: ${f.alunoNome} (${turmaLbl(f.turmaId)}) — ${fmtBR(f.datas[0])}` });
  });
  arr(state.reposicoes).filter((r) => !r.realizada && r.tipo === 'aula_extra').forEach((r) => {
    obs.push({ level: 'blue', text: `Aula extra sem falta vinculada: ${r.alunoNome} — ${fmtBRFull(r.dataReposicao)}` });
  });
  arr(state.reposicoes).filter((r) => !r.realizada && r.semFaltaVinculada).forEach((r) => {
    obs.push({ level: 'blue', text: `Reposição sem falta vinculada: ${r.alunoNome} — ${fmtBRFull(r.dataReposicao)}` });
  });

  return { combined, marcadasGrupos, reposAtivas, vagasGrupos, obs };
}
