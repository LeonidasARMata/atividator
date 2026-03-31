const Dates = (() => {
  const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

  function parseDate(s) {
    if (!s) return null;
    const [y,m,d] = s.split('T')[0].split('-').map(Number);
    const dt = new Date(y, m-1, d); dt.setHours(0,0,0,0); return dt;
  }

  function daysUntil(s) {
    const d = parseDate(s); if (!d) return Infinity;
    return Math.round((d - today()) / 86_400_000);
  }

  function fmt(s) {
    if (!s) return '–';
    const [y,m,d] = s.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  function taskStatus(task, user) {
    if (task.data_envio) return 'enviada';
    const days = daysUntil(task.data_entrega);
    if (days < 0)                   return 'atrasada';
    if (days <= user.dias_urgencia) return 'urgente';
    return 'ok';
  }

  return { daysUntil, fmt, taskStatus };
})();