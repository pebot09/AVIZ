// Seletor de horário em 24h — hora e minuto separados, sem AM/PM.
// Evita a ambiguidade de campo de texto livre ("19", "7").

const HORAS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

export default function HoraPicker({ hora, minuto, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <select
        value={hora}
        onChange={(e) => onChange(Number(e.target.value), minuto)}
        className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white"
        aria-label="Hora"
      >
        {HORAS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
      </select>
      <span className="text-gray-400 font-medium">h</span>
      <select
        value={minuto}
        onChange={(e) => onChange(hora, Number(e.target.value))}
        className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white"
        aria-label="Minuto"
      >
        {MINUTOS.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
      </select>
    </div>
  );
}
