const Tasks = (() => {
  let cache      = [];
  let _pollTimer = null;
  let _editingId    = null;   // null = modo criação, string = modo edição
  let _adminCache   = null;   // cache compartilhado com admin.js
  const POLL_MS  = 20_000;

  const getCache = () => cache;

  // ── Carrega tarefas ────────────────────────────────────────────
  async function carregar() {
    try {
      cache = await Api.getTasks();
      UI.renderTarefas();
      UI.montarSelectMaterias();
    } catch (e) { console.error('Erro ao carregar tarefas:', e.message); }
  }

  // ── Polling com detecção de mudança ───────────────────────────
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

  let _pendente = null;
  function _guardarPendente(novas) { _pendente = novas; }

  function aplicarAtualizacao() {
    if (_pendente) { cache = _pendente; _pendente = null; }
    UI.renderTarefas();
    UI.montarSelectMaterias();
    UI.ocultarToastAtualizacao();
  }

  function _houveMudanca(anterior, novo) {
    if (anterior.length !== novo.length) return true;
    const mapa = new Map(anterior.map(t => [t.id, t]));
    for (const t of novo) {
      const a = mapa.get(t.id);
      if (!a) return true;
      if (a.nome !== t.nome || a.data_entrega !== t.data_entrega) return true;
    }
    return false;
  }

  function removerDoCache(taskId) {
    cache = cache.filter(t => t.id !== taskId);
    UI.renderTarefas();
  }

  // ── Abre modal no modo CRIAR ───────────────────────────────────
  function abrirParaCriar() {
    _editingId = null;
    document.getElementById('m-titulo').textContent      = 'Nova tarefa';
    document.getElementById('btn-add-tarefa').textContent = 'Adicionar';
    document.getElementById('btn-excluir-tarefa').style.display = 'none';
    _limpar();
    const inputAtrib = document.getElementById('m-atribuicao');
    if (inputAtrib && !inputAtrib.value) inputAtrib.value = Dates.hojeISO();
    document.getElementById('ov-tarefa').classList.add('on');
  }

  // ── Abre modal no modo EDITAR ──────────────────────────────────
  function abrirParaEditar(taskId) {
    const task = cache.find(t => t.id === taskId)
               || _adminCache?.find(t => t.id === taskId);
    if (!task) return;

    _editingId = taskId;
    document.getElementById('m-titulo').textContent       = 'Editar tarefa';
    document.getElementById('btn-add-tarefa').textContent  = 'Salvar';
    document.getElementById('btn-excluir-tarefa').style.display = '';

    // Preenche os campos com os dados da tarefa
    document.getElementById('m-nome').value      = task.nome;
    document.getElementById('m-entrega').value   = task.data_entrega || '';
    document.getElementById('m-atribuicao').value = task.data_atribuicao || '';

    // Seleciona a matéria correta
    const selMat = document.getElementById('m-mat');
    // Garante que a opção existe antes de selecionar
    let found = false;
    for (const opt of selMat.options) {
      if (opt.value === task.materia) { opt.selected = true; found = true; break; }
    }
    if (!found) {
      const o = document.createElement('option');
      o.value = o.textContent = task.materia;
      o.selected = true;
      selMat.appendChild(o);
    }

    // Visibilidade
    document.querySelectorAll('input[name="vis"]').forEach(r => {
      r.checked = r.value === task.visibilidade;
    });

    document.getElementById('m-err').style.display = 'none';
    document.getElementById('ov-tarefa').classList.add('on');
  }

  // ── Salvar (criar ou editar) ───────────────────────────────────
  async function salvar() {
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
    btn.textContent = _editingId ? 'Salvando...' : 'Adicionando...';

    try {
      if (_editingId) {
        // EDITAR
        const atualizada = await Api.updateTask(_editingId,
          { nome, materia, data_entrega, data_atribuicao, visibilidade });
        const idx = cache.findIndex(t => t.id === _editingId);
        if (idx >= 0) cache[idx] = { ...cache[idx], ...atualizada };
        // Atualiza cache admin se existir
        if (_adminCache) {
          const ai = _adminCache.findIndex(t => t.id === _editingId);
          if (ai >= 0) _adminCache[ai] = { ..._adminCache[ai], ...atualizada };
        }
      } else {
        // CRIAR
        const nova = await Api.createTask({ nome, materia, data_entrega, data_atribuicao, visibilidade });
        cache.push({ ...nova, done_by: [] });
      }
      UI.fecharModalTarefa();
      _limpar();
      UI.renderTarefas();
      UI.montarSelectMaterias();
      // Re-renderiza aba admin se estiver aberta
      if (document.getElementById('sec-admin-tasks')?.classList.contains('on')) {
        Admin.renderTarefasAdmin();
      }
    } catch (e) {
      err.textContent   = e.message;
      err.style.display = 'block';
    } finally {
      btn.disabled    = false;
      btn.textContent = _editingId ? 'Salvar' : 'Adicionar';
    }
  }

  // ── Excluir pelo botão dentro do modal de edição ───────────────
  function excluirDoModal() {
    if (!_editingId) return;
    const task = cache.find(t => t.id === _editingId)
               || _adminCache?.find(t => t.id === _editingId);
    const nome = task?.nome || 'esta tarefa';
    UI.fecharModalTarefa();
    UI.abrirConfirma(
      'Excluir tarefa?',
      `"${nome}" será removida permanentemente.`,
      () => excluir(_editingId)
    );
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

  // ── Excluir ────────────────────────────────────────────────────
  async function excluir(taskId) {
    try {
      await Api.deleteTask(taskId);
      removerDoCache(taskId);
      if (_adminCache) {
        _adminCache = _adminCache.filter(t => t.id !== taskId);
        Admin.renderTarefasAdmin();
      }
    } catch (e) {
      UI.abrirConfirma('Erro ao excluir', e.message, null);
    }
  }

  function _limpar() {
    ['m-nome','m-entrega','m-atribuicao'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-mat').value = '';
    document.getElementById('m-err').style.display = 'none';
    document.querySelector('input[name="vis"][value="publica"]').checked = true;
    _editingId = null;
  }

  // Permite que admin.js injete o cache de tarefas admin
  function setAdminCache(c) { _adminCache = c; }

  return {
    getCache, carregar, iniciarPolling, pararPolling,
    aplicarAtualizacao, removerDoCache,
    abrirParaCriar, abrirParaEditar,
    salvar, excluirDoModal, toggleDone, excluir,
    setAdminCache,
  };
})();