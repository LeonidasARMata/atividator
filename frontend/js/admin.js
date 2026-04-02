const Admin = (() => {

  async function carregarUsuarios() {
    try {
      const users  = await Api.adminGetUsers();
      const turmas = await Api.adminGetTurmas();
      const list   = document.getElementById('admin-users-list');
      list.innerHTML = '';

      const porTurma = {};
      users.forEach(u => {
        if (!porTurma[u.turma_id]) porTurma[u.turma_id] = [];
        porTurma[u.turma_id].push(u);
      });

      Object.entries(porTurma).sort().forEach(([turma, membros]) => {
        const header = document.createElement('p');
        header.className = 'admin-turma-header';
        header.textContent = `${turma[0]}º Ano — Turma ${turma[1]}`;
        list.appendChild(header);

        membros.forEach(u => {
          const row = document.createElement('div');
          row.className = 'admin-user-row';
          row.innerHTML = `
            <div class="admin-user-info">
              <span class="admin-username">@${u.username}</span>
              <span class="admin-email">${u.email}</span>
              ${u.is_admin ? '<span class="badge b-admin">admin</span>' : ''}
            </div>
            <div class="admin-user-actions">
              <select class="admin-turma-sel" data-uid="${u.id}">
                ${turmas.map(t => `<option value="${t.id}" ${t.id === u.turma_id ? 'selected' : ''}>${t.ano}º · Turma ${t.letra}</option>`).join('')}
              </select>
              <button class="btn-sm" onclick="Admin.alterarTurma('${u.id}')">Mover</button>
              <button class="btn-sm btn-danger" onclick="Admin.confirmarRemoverUsuario('${u.id}', '@${u.username}')">Remover</button>
            </div>`;
          list.appendChild(row);
        });
      });
    } catch (e) { _erro(e.message); }
  }

  async function alterarTurma(userId) {
    const sel = document.querySelector(`.admin-turma-sel[data-uid="${userId}"]`);
    try { await Api.adminPatchUser(userId, { turma_id: sel.value }); await carregarUsuarios(); }
    catch (e) { _erro(e.message); }
  }

  function confirmarRemoverUsuario(userId, username) {
    UI.abrirConfirma(
      'Remover usuário?',
      `${username} será removido permanentemente do sistema.`,
      () => _removerUsuario(userId)
    );
  }

  async function _removerUsuario(userId) {
    try { await Api.adminDeleteUser(userId); await carregarUsuarios(); }
    catch (e) { _erro(e.message); }
  }

  // Cache das tarefas admin — evita re-buscar ao filtrar
  let _cacheAdminTasks = [];

  async function carregarTarefasAdmin() {
    try {
      _cacheAdminTasks = await Api.adminGetTasks();
      _popularFiltrosAdmin(_cacheAdminTasks);
      renderTarefasAdmin();
    } catch (e) { _erro(e.message); }
  }

  // Popula os selects de turma e matéria com os valores existentes
  function _popularFiltrosAdmin(tasks) {
    const turmas  = [...new Set(tasks.map(t => t.turma_id))].sort();
    const mats    = [...new Set(tasks.map(t => t.materia))].sort();

    const selTurma = document.getElementById('adm-fil-turma');
    const selMat   = document.getElementById('adm-fil-mat');
    if (!selTurma || !selMat) return;

    const turmaAtual = selTurma.value;
    const matAtual   = selMat.value;

    selTurma.innerHTML = '<option value="">Todas as turmas</option>';
    turmas.forEach(t => {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = `${t[0]}º Ano · Turma ${t[1]}`;
      if (t === turmaAtual) o.selected = true;
      selTurma.appendChild(o);
    });

    selMat.innerHTML = '<option value="">Todas as matérias</option>';
    mats.forEach(m => {
      const o = document.createElement('option');
      o.value = o.textContent = m;
      if (m === matAtual) o.selected = true;
      selMat.appendChild(o);
    });
  }

  // Renderiza a lista com os filtros aplicados — chamada ao mudar qualquer select
  function renderTarefasAdmin() {
    const filTurma = document.getElementById('adm-fil-turma')?.value || '';
    const filMat   = document.getElementById('adm-fil-mat')?.value   || '';
    const filOrd   = document.getElementById('adm-fil-ord')?.value   || 'entrega';
    const list     = document.getElementById('admin-tasks-list');
    if (!list) return;

    let visible = _cacheAdminTasks.filter(t => {
      if (filTurma && t.turma_id !== filTurma) return false;
      if (filMat   && t.materia  !== filMat)   return false;
      return true;
    });

    visible.sort((a, b) => {
      if (filOrd === 'entrega')    return (a.data_entrega    || '').localeCompare(b.data_entrega    || '');
      if (filOrd === 'atribuicao') return (a.data_atribuicao || '').localeCompare(b.data_atribuicao || '');
      if (filOrd === 'turma')      return a.turma_id.localeCompare(b.turma_id);
      if (filOrd === 'materia')    return a.materia.localeCompare(b.materia);
      return 0;
    });

    list.innerHTML = '';

    if (visible.length === 0) {
      list.innerHTML = '<div class="empty">Nenhuma tarefa encontrada.</div>';
      return;
    }

    visible.forEach(t => {
      const row = document.createElement('div');
      row.className = 'admin-task-row';
      row.innerHTML = `
        <div class="admin-task-info">
          <span class="admin-task-nome">${t.nome}</span>
          <span class="admin-task-meta">
            <span class="badge b-materia" style="font-size:11px">${t.materia}</span>
            <span class="badge b-user"    style="font-size:11px">${t.turma_id[0]}º Ano · Turma ${t.turma_id[1]}</span>
            <span style="font-size:11px;color:var(--color-text-secondary)">entrega: ${Dates.fmt(t.data_entrega)}</span>
          </span>
        </div>
        <button class="btn-sm btn-danger" onclick="Admin.confirmarExcluirTarefa('${t.id}', \`${t.nome.replace(/`/g, "'")}\`)">Excluir</button>`;
      list.appendChild(row);
    });
  }

  function confirmarExcluirTarefa(id, nome) {
    UI.abrirConfirma(
      'Excluir tarefa?',
      `"${nome}" será removida permanentemente para todos os usuários.`,
      () => _excluirTarefa(id)
    );
  }

  async function _excluirTarefa(id) {
    try {
      await Api.adminDeleteTask(id);
      // Remove do cache admin local e atualiza as duas listas
      _cacheAdminTasks = _cacheAdminTasks.filter(t => t.id !== id);
      renderTarefasAdmin();
      Tasks.carregar();   // recarrega lista principal
    } catch (e) { _erro(e.message); }
  }

  async function carregarTurmas() {
    try {
      const turmas = await Api.adminGetTurmas();
      const list   = document.getElementById('admin-turmas-list');
      list.innerHTML = '';

      if (turmas.length === 0) {
        list.innerHTML = '<div class="empty">Nenhuma turma cadastrada.</div>';
        return;
      }

      turmas.forEach(t => {
        const row = document.createElement('div');
        row.className = 'admin-user-row';
        row.innerHTML = `
          <span style="font-size:14px;font-weight:500;color:var(--color-text-primary)">${t.ano}º Ano — Turma ${t.letra}</span>
          <button class="btn-sm btn-danger" onclick="Admin.confirmarExcluirTurma('${t.id}')">Remover</button>`;
        list.appendChild(row);
      });
    } catch (e) { _erro(e.message); }
  }

  async function criarTurma() {
    const ano   = document.getElementById('nova-turma-ano').value;
    const letra = document.getElementById('nova-turma-letra').value.trim().toUpperCase();
    if (!ano || !letra) return;
    try {
      await Api.adminCreateTurma(ano, letra);
      document.getElementById('nova-turma-ano').value   = '';
      document.getElementById('nova-turma-letra').value = '';
      await carregarTurmas();
    } catch (e) { _erro(e.message); }
  }

  function confirmarExcluirTurma(id) {
    UI.abrirConfirma(
      `Remover turma ${id}?`,
      'A turma só pode ser removida se não houver usuários nela.',
      () => _excluirTurma(id)
    );
  }

  async function _excluirTurma(id) {
    try { await Api.adminDeleteTurma(id); await carregarTurmas(); }
    catch (e) { _erro(e.message); }
  }

  async function toggleFixar(registroId) {
    try {
      const updated = await Api.adminFixarRegistro(registroId);
      const cache   = Registros.getCache();
      const idx     = cache.findIndex(r => r.id === registroId);
      if (idx >= 0) cache[idx].fixado = updated.fixado;
      UI.renderRegistros();
    } catch (e) { _erro(e.message); }
  }

  // Exibe erro via modal de confirmação (sem callback — só botão fechar)
  function _erro(msg) {
    UI.abrirConfirma('Erro', msg, null);
  }

  return {
    carregarUsuarios, alterarTurma, confirmarRemoverUsuario,
    carregarTarefasAdmin, renderTarefasAdmin, confirmarExcluirTarefa,
    carregarTurmas, criarTurma, confirmarExcluirTurma,
    toggleFixar,
  };
})();