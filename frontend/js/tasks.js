const Tasks = (() => {
  let cache = [];
  const getCache = () => cache;

  async function carregar() {
    try { cache = await Api.getTasks(); UI.renderTarefas(); }
    catch (e) { console.error(e.message); }
  }

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

    // Bloqueia o botão durante a requisição — evita cliques duplos
    btn.disabled        = true;
    btn.textContent     = 'Adicionando...';

    try {
      const nova = await Api.createTask({ nome, materia, data_entrega, data_envio, visibilidade });
      cache.push({ ...nova, done_by: [] });
      UI.fecharModalTarefa();
      _limpar();
      UI.renderTarefas();
    } catch (e) {
      err.textContent   = e.message;
      err.style.display = 'block';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Adicionar';
    }
  }

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

  // Chamado pelo modal de confirmação — o confirm() já foi feito antes
  async function excluir(taskId) {
    try {
      await Api.deleteTask(taskId);
      cache = cache.filter(t => t.id !== taskId);
      UI.renderTarefas();
    } catch (e) {
      UI.abrirConfirma('Erro ao excluir', e.message, null);
    }
  }

  function _limpar() {
    ['m-nome','m-entrega','m-envio'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-mat').value = '';
    document.querySelector('input[name="vis"][value="publica"]').checked = true;
  }

  return { getCache, carregar, add, toggleDone, excluir };
})();