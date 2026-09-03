// Peças reutilizáveis do onboarding — todas com título acima do campo.

export function Campo({ label, children }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>}
      {children}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, autoFocus }) {
  return (
    <input
      value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
    />
  );
}

// Seletor de artigo (O/A) + campo de texto, na mesma linha.
export function ArtigoNome({ artigo, nome, onArtigo, onNome, placeholder, autoFocus }) {
  return (
    <div className="flex gap-2">
      <select value={artigo} onChange={(e) => onArtigo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white" aria-label="Artigo">
        <option value="">–</option>
        <option value="o">O</option>
        <option value="a">A</option>
      </select>
      <input
        value={nome} onChange={(e) => onNome(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
      />
    </div>
  );
}

export function NumberSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Igual ao NumberSelect, mas mantém o valor como texto (não força número).
export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Escolha de uma opção em cartões (com opção "outro" digitável).
export function OptionCards({ value, onChange, options, permiteOutro }) {
  const ehOutro = permiteOutro && value != null && !options.some((o) => o.value === value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value} onClick={() => onChange(o.value)}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              value === o.value ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >{o.label}</button>
        ))}
        {permiteOutro && (
          <button
            onClick={() => onChange('')}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${ehOutro ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >Outro…</button>
        )}
      </div>
      {ehOutro && (
        <input
          value={value} onChange={(e) => onChange(e.target.value)} placeholder="Digite o termo (singular)…" autoFocus
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}

export function SimNao({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[['sim', true], ['não', false]].map(([lbl, v]) => (
        <button
          key={lbl} onClick={() => onChange(v)}
          className={`px-5 py-2 rounded-lg border text-sm transition-colors ${
            value === v ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >{lbl}</button>
      ))}
    </div>
  );
}
