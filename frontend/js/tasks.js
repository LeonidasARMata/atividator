const Tasks = (() => {
  let cache      = [];
  let _pollTimer = null;
  const POLL_MS  = 20_000;  // verifica a cada 20s

  const getCache = () => cache;

  // ── Carrega tarefas e re-renderiza ─────────────────────────────
  async function carregar() {
    try {
      cache = await Api.getTasks();
      UI.renderTarefas();
      UI.montarSelectMaterias();
    } catch (e) { console.error('Erro ao carregar tarefas:', e.message); }
  }

  // ── Polling — detecta mudanças no banco ────────────────────────
  // A cada POLL_MS busca as tarefas e compara com o cache.
  // Se algo mudou (nova tarefa, exclusão, edição), exibe o toast.
  // Não re-renderiza automaticamente — deixa o usuário decidir.
  async function iniciarPolling() {
    pararPolling();
    _pollTimer = setInterval(async () => {
      try {
        const novas = await Api.getTasks();
        if (_houveMudanca(cache, novas)) {
          _guardarPendente(novas);
          UI.mostrarToastAtualizacao();
        }
      } catch (_) {}
    }, POLL_MS);
  }

  function pararPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // Cache temporário com as tarefas novas, aguardando o usuário confirmar
  let _pendente = null;
  function _guardarPendente(novas) { _pendente = novas; }

  // Chamado pelo botão "Atualizar" do toast
  function aplicarAtualizacao() {
    if (_pendente) {
      cache    = _pendente;
      _pendente = null;
    }
    UI.renderTarefas();
    UI.montarSelectMaterias();
    UI.ocultarToastAtualizacao();
  }

  // Compara dois arrays de tarefas pelo id e pelo conteúdo relevante
  function _houveMudanca(anterior, novo) {
    if (anterior.length !== novo.length) return true;
    const mapaAnterior = new Map(anterior.map(t => [t.id, t]));
    for (const t of novo) {
      const a = mapaAnterior.get(t.id);
      if (!a) return true;  // tarefa nova
      if (a.nome !== t.nome || a.data_entrega !== t.data_entrega) return true;
    }
    return false;
  }

  // Remove do cache local imediatamente (admin delete)
  function removerDoCache(taskId) {
    cache = cache.filter(t => t.id !== taskId);
    UI.renderTarefas();
  }

  // ── Adicionar tarefa ───────────────────────────────────────────
  async function add() {
    const nome            = document.getElementById('m-nome').value.trim();
    const materia         = document.getElementById('m-mat').value;
    const data_entrega    = document.getElementById('m-entrega').value;
    const data_atribuicao = document.getElementById('m-atribuicao').value || Dates.hojeISO();
    const visibilidade    = document.querySelector('input[name="vis"]:checked').value;
    const err             = document.getElementById('m-err');
    const btn             = document.getElementById('btn-add-tarefa');

    if (!nome || !materia || !data_entrega) {
      err.textContent   = 'Preencha nome, matéria e data de entrega.';
      err.style.display = 'block';
      return;
    }
    err.style.display = 'none';
    btn.disabled    = true;
    btn.textContent = 'Adicionando...';

    try {
      const nova = await Api.createTask({ nome, materia, data_entrega, data_atribuicao, visibilidade });
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

  // ── Excluir (dono, via modal de confirmação) ───────────────────
  async function excluir(taskId) {
    try {
      await Api.deleteTask(taskId);
      removerDoCache(taskId);
    } catch (e) {
      UI.abrirConfirma('Erro ao excluir', e.message, null);
    }
  }

  function _limpar() {
    ['m-nome','m-entrega','m-atribuicao'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-mat').value = '';
    document.querySelector('input[name="vis"][value="publica"]').checked = true;
  }

  return {
    getCache, carregar, iniciarPolling, pararPolling,
    aplicarAtualizacao, removerDoCache,
    add, toggleDone, excluir,
  };
})();