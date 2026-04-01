const Tasks = (() => {
  let cache       = [];
  let _pollTimer  = null;
  const POLL_MS   = 30_000;   // sincroniza a cada 30 segundos

  const getCache = () => cache;

  // ── Carrega tarefas do servidor e re-renderiza ─────────────────
  async function carregar() {
    try {
      const novas = await Api.getTasks();
      cache = novas;
      UI.renderTarefas();
      UI.montarSelectMaterias();
    } catch (e) { console.error('Erro ao carregar tarefas:', e.message); }
  }

  // ── Polling silencioso ─────────────────────────────────────────
  // Recarrega as tarefas periodicamente sem travar a UI.
  // Preserva o estado de "concluído" local: se o servidor devolver
  // uma tarefa que o usuário já marcou, mantém o done_by correto.
  async function iniciarPolling() {
    pararPolling();
    _pollTimer = setInterval(async () => {
      try {
        const novas = await Api.getTasks();
        cache = novas;
        UI.renderTarefas();
      } catch (_) { /* silencioso — não interrompe o usuário */ }
    }, POLL_MS);
  }

  function pararPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ── Remove uma tarefa do cache local imediatamente ─────────────
  // Usado pelo admin.js para que a lista principal reflita
  // a exclusão sem esperar o próximo poll.
  function removerDoCache(taskId) {
    cache = cache.filter(t => t.id !== taskId);
    UI.renderTarefas();
  }

  // ── Adicionar tarefa ───────────────────────────────────────────
  async function add() {
    const nome         = document.getElementById('m-nome').value.trim();
    const materia      = document.getElementById('m-mat').value;
    const data_entrega = document.getElementById('m-entrega').value;
    const data_envio   = document.getElementById('m-envio').value || null;
    const visibilidade = document.querySelector('input[name="vis"]:checked').value;
    const err          = document.getElementById('m-err');
    const btn          = document.getElementById('btn-add-tarefa');

    if (!nome || !materia || !data_entrega) {
      err.textContent   = 'Preencha nome, matéria e data de entrega.';
      err.style.display = 'block';
      return;
    }
    err.style.display = 'none';

    btn.disabled    = true;
    btn.textContent = 'Adicionando...';

    try {
      const nova = await Api.createTask({ nome, materia, data_entrega, data_envio, visibilidade });
      cache.push({ ...nova, done_by: [] });
      UI.fecharModalTarefa();
      _limpar();
      UI.renderTarefas();
      UI.montarSelectMaterias();
    } catch (e) {
      err.textContent   = e.message;
      err.style.display = 'block';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Adicionar';
    }
  }

  // ── Marcar / desmarcar concluída ───────────────────────────────
  async function toggleDone(taskId) {
    const user = Auth.get();
    const task = cache.find(t => t.id === taskId);
    if (!task) return;
    const isDone = task.done_by.includes(user.id);
    try {
      isDone ? await Api.unmarkDone(taskId) : await Api.markDone(taskId);
      task.done_by = isDone
        ? task.done_by.filter(id => id !== user.id)
        : [...task.done_by, user.id];
      UI.renderTarefas();
    } catch (e) { console.error(e.message); }
  }

  // ── Excluir (pelo dono, via modal de confirmação) ──────────────
  async function excluir(taskId) {
    try {
      await Api.deleteTask(taskId);
      removerDoCache(taskId);
    } catch (e) {
      UI.abrirConfirma('Erro ao excluir', e.message, null);
    }
  }

  function _limpar() {
    ['m-nome','m-entrega','m-envio'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-mat').value = '';
    document.querySelector('input[name="vis"][value="publica"]').checked = true;
  }

  return { getCache, carregar, iniciarPolling, pararPolling, removerDoCache, add, toggleDone, excluir };
})();