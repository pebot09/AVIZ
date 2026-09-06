import { cap } from '../../domain/vocab.js';

// "Como funciona" — no Passarinho este texto era fixo (22h, 2h, 30 dias,
// julho/dezembro/janeiro). Aqui cada frase é montada a partir das regras que a
// escola configurou, então o aluno lê as regras da escola dele.
export default function RegrasModal({ config, vocab, onClose }) {
  const r = (config && config.regras) || {};
  const horas = Number(r.antecedenciaHoras) || 0;
  const janela = Number(r.semAntecedenciaJanela) || 0;
  const permiteSemAntec = !!r.semAntecedencia && horas > 0;
  const validade = Number(r.validadeFaltaDias) || 0;
  const temFerias = !!r.ferias;
  const feriasCredito = temFerias && !!r.feriasCredito;
  const nCreditos = Number(r.feriasCreditos) || 1;
  const validadeFerias = Number(r.feriasValidadeDias) || 30;
  const recessos = (config && config.calendario && config.calendario.recessos) || [];

  const secoes = [];

  // --- Avisar falta ---
  const avisar = [];
  if (horas > 0) {
    avisar.push({ icon: '✅', text: `Com mais de ${horas}h de antecedência: falta comum — você pode repor em qualquer ${vocab.turma} com vaga.` });
    if (permiteSemAntec) {
      avisar.push({ icon: '⏱️', text: `Entre ${janela}h e ${horas}h antes da ${vocab.aula}: falta sem antecedência — você tem direito a reposição, mas só pode marcá-la quando a ${vocab.aula} de reposição estiver a menos de ${janela}h de começar.` });
      avisar.push({ icon: '⛔', text: `Com menos de ${janela}h (ou depois que a ${vocab.aula} começa): não dá para registrar falta. A data aparece bloqueada.` });
    } else {
      avisar.push({ icon: '⛔', text: `Com menos de ${horas}h: não dá para registrar falta. A data aparece bloqueada.` });
    }
  } else {
    avisar.push({ icon: '✅', text: `Você pode avisar sua falta até a ${vocab.aula} começar.` });
  }
  avisar.push({ icon: '🎌', text: 'Feriado e recesso não geram falta nem vaga de reposição.' });
  secoes.push({ titulo: 'Avisar falta', itens: avisar });

  // --- Cancelar falta ---
  secoes.push({
    titulo: 'Cancelar falta',
    itens: [
      { icon: '✕', text: `Dá para cancelar enquanto o horário da ${vocab.aula} não chegou — desde que não haja reposição marcada para ela.` },
      { icon: '🔒', text: 'Não dá para cancelar se a sua vaga já foi ocupada por outra pessoa e não há outra para substituir.' },
      { icon: '🚫', text: `Falta que veio de uma ${vocab.aula} cancelada pela escola não é cancelada aqui — ela some se a ${vocab.aula} for reativada.` },
    ],
  });

  // --- Marcar reposição ---
  const repor = [];
  repor.push(validade > 0
    ? { icon: '📅', text: `Você tem ${validade} dias para repor, contados da data da falta. Depois disso o direito expira.` }
    : { icon: '📅', text: 'Seu direito de reposição não expira.' });
  repor.push({ icon: '🔄', text: `A reposição pode ser em qualquer ${vocab.turma} — escolha entre as vagas disponíveis.` });
  if (r.vagaExtra) {
    repor.push({
      icon: '🪑',
      text: r.vagaExtraAbertura === 'vespera'
        ? `Vagas extras abrem na véspera, quando sobra espaço numa ${vocab.turma}.`
        : `Vagas extras abrem quando sobra espaço numa ${vocab.turma}.`,
    });
  }
  secoes.push({ titulo: 'Marcar reposição', itens: repor });

  // --- Cancelar reposição ---
  const cancelarRepo = [];
  if (horas > 0) {
    cancelarRepo.push({ icon: '↩️', text: `Cancelando com mais de ${horas}h de antecedência: o direito volta e você pode remarcar.` });
    if (permiteSemAntec) {
      cancelarRepo.push({ icon: '⚠️', text: `Entre ${janela}h e ${horas}h: o direito volta, mas como falta sem antecedência.` });
    }
    cancelarRepo.push({ icon: '⛔', text: `Com menos de ${janela || horas}h: dá para cancelar, mas o direito não volta.` });
  } else {
    cancelarRepo.push({ icon: '↩️', text: 'Cancelando antes da aula, o direito volta e você pode remarcar.' });
  }
  secoes.push({ titulo: 'Cancelar reposição', itens: cancelarRepo });

  // --- Férias ---
  if (temFerias) {
    const ferias = [{ icon: '🌴', text: `Você pode registrar um período de férias aqui mesmo — as vagas das suas ${vocab.aulas} do mês ficam livres para outras pessoas.` }];
    if (feriasCredito) {
      ferias.push({ icon: '🎫', text: `Férias dão ${nCreditos} crédito${nCreditos > 1 ? 's' : ''} de reposição, válido${nCreditos > 1 ? 's' : ''} por ${validadeFerias} dias após o fim do mês.` });
      if (recessos.length) {
        ferias.push({ icon: '🏠', text: `Meses de recesso (${recessos.map((x) => x.nome || 'recesso').join(', ')}) não geram crédito.` });
      }
    } else {
      ferias.push({ icon: '🎫', text: 'Férias liberam as vagas do mês, mas não geram crédito de reposição.' });
    }
    if (r.feriasLimiteAno) {
      ferias.push({ icon: '📆', text: `Limite de ${r.feriasLimiteAno} período${Number(r.feriasLimiteAno) > 1 ? 's' : ''} de férias por ano.` });
    }
    secoes.push({ titulo: 'Férias', itens: ferias });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-md p-6 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Como funciona</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Fechar">✕</button>
        </div>
        <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
          {secoes.map((sec, si) => (
            <div key={si}>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">{cap(sec.titulo)}</div>
              <ul className="space-y-2">
                {sec.itens.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-sm mt-0.5 shrink-0">{item.icon}</span>
                    <span className="text-sm text-gray-700 leading-snug">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
