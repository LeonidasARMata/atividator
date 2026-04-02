/**
 * dates.js — utilitários de data e lógica de status de tarefas
 *
 * Status de uma tarefa é sempre relativo ao usuário:
 *
 *   concluida  → usuário marcou como feita (nunca fica atrasada)
 *   atrasada   → hoje passou da data_entrega e não foi concluída
 *   urgente    → dias até a entrega <= dias_urgencia do usuário
 *   ok         → em tempo, sem urgência
 */
const Dates = (() => {

  const today = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = s.split('T')[0].split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function daysUntil(s) {
    const d = parseDate(s);
    if (!d) return Infinity;
    return Math.round((d - today()) / 86_400_000);
  }

  function fmt(s) {
    if (!s) return '–';
    const [y, m, d] = s.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Calcula o status de uma tarefa para um usuário específico.
   *
   * @param {Object} task      — tarefa do cache
   * @param {Object} user      — usuário logado (com dias_urgencia e id)
   * @returns {'ok'|'urgente'|'atrasada'|'concluida'}
   */
  function taskStatus(task, user) {
    const isDone = task.done_by?.includes(user.id);

    // Concluída pelo usuário → nunca muda de status
    if (isDone) return 'concluida';

    const days = daysUntil(task.data_entrega);

    // Passou do prazo → atrasada
    if (days < 0) return 'atrasada';

    // Dentro do prazo mas próximo → urgente
    if (days <= user.dias_urgencia) return 'urgente';

    return 'ok';
  }

  /**
   * Retorna a data de hoje formatada como "YYYY-MM-DD"
   * para preencher campos de input[type=date].
   */
  function hojeISO() {
    return today().toISOString().split('T')[0];
  }

  return { daysUntil, fmt, taskStatus, hojeISO };
})();