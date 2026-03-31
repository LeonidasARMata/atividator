const Admin = (() => {

  async function carregarUsuarios() {
    try {
      const users = await Api.adminGetUsers();
      const turmas = await Api.adminGetTurmas();
      const list  = document.getElementById('admin-users-list');
      list.innerHTML = '';

      const porTurma = {};
      users.forEach(u => { if (!porTurma[u.turma_id]) porTurma[u.turma_id] = []; porTurma[u.turma_id].push(u); });

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
              <button class="btn-sm btn-danger" onclick="Admin.removerUsuario('${u.id}')">Remover</button>
            </div>`;
          list.appendChild(row);
        });
      });
    } catch (e) { alert(e.message); }
  }

  async function alterarTurma(userId) {
    const sel = document.querySelector(`.admin-turma-sel[data-uid="${userId}"]`);
    try { await Api.adminPatchUser(userId, { turma_id: sel.value }); await carregarUsuarios(); }
    catch (e) { alert(e.message); }
  }

  async function removerUsuario(userId) {
    if (!confirm('Remover este usuário permanentemente?')) return;
    try { await Api.adminDeleteUser(userId); await carregarUsuarios(); }
    catch (e) { alert(e.message); }
  }

  async function carregarTarefasAdmin() {
    try {
      const tasks = await Api.adminGetTasks();
      const list  = document.getElementById('admin-tasks-list');
      list.innerHTML = '';
      tasks.forEach(t => {
        const row = document.createElement('div');
        row.className = 'admin-task-row';
        row.innerHTML = `
          <div class="admin-task-info">
            <span class="admin-task-nome">${t.nome}</span>
            <span class="admin-task-meta">${t.turma_id} · ${t.materia} · ${Dates.fmt(t.data_entrega)}</span>
          </div>
          <button class="btn-sm btn-danger" onclick="Admin.excluirTarefa('${t.id}')">Excluir</button>`;
        list.appendChild(row);
      });
    } catch (e) { alert(e.message); }
  }

  async function excluirTarefa(id) {
    if (!confirm('Excluir esta tarefa?')) return;
    try { await Api.adminDeleteTask(id); await carregarTarefasAdmin(); }
    catch (e) { alert(e.message); }
  }

  async function carregarTurmas() {
    try {
      const turmas = await Api.adminGetTurmas();
      const list   = document.getElementById('admin-turmas-list');
      list.innerHTML = '';
      turmas.forEach(t => {
        const row = document.createElement('div');
        row.className = 'admin-user-row';
        row.innerHTML = `
          <span style="font-size:14px;font-weight:500;color:var(--color-text-primary)">${t.ano}º Ano — Turma ${t.letra}</span>
          <button class="btn-sm btn-danger" onclick="Admin.excluirTurma('${t.id}')">Remover</button>`;
        list.appendChild(row);
      });
    } catch (e) { alert(e.message); }
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
    } catch (e) { alert(e.message); }
  }

  async function excluirTurma(id) {
    if (!confirm(`Remover a turma ${id}? Ela não pode ter usuários.`)) return;
    try { await Api.adminDeleteTurma(id); await carregarTurmas(); }
    catch (e) { alert(e.message); }
  }

  async function toggleFixar(registroId) {
    try {
      const updated = await Api.adminFixarRegistro(registroId);
      const cache   = Registros.getCache();
      const idx     = cache.findIndex(r => r.id === registroId);
      if (idx >= 0) cache[idx].fixado = updated.fixado;
      UI.renderRegistros();
    } catch (e) { alert(e.message); }
  }

  return {
    carregarUsuarios, alterarTurma, removerUsuario,
    carregarTarefasAdmin, excluirTarefa,
    carregarTurmas, criarTurma, excluirTurma,
    toggleFixar,
  };
})();