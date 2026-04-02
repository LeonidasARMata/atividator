/**
 * ui.js — renderização e controle da interface
 */

const MATERIAS = [
  'Matemática','Física','Química','Biologia','História','Geografia',
  'Sociologia','Filosofia','Língua Portuguesa','Produção Textual','Literatura',
  'Inglês','Arte','Interioridade',
  'Itinerário Humanas e Linguagens','Itinerário Exatas',
  'Itinerário Natureza I','Itinerário Natureza II',
  'Projeto Prepara Humanas','Projeto Prepara Linguagens',
  'Projeto Prepara Exatas','Projeto Prepara Naturezas',
];

const UI = (() => {
  let currentTab     = 'pendentes';
  let currentSection = 'tarefas';
  let _confirmaCallback = null;   // função a executar ao confirmar

  // ─── Páginas ──────────────────────────────────────────────────────────────

  function show(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
    document.getElementById(pageId).classList.add('on');
  }

  // ─── Seções da bottom nav ─────────────────────────────────────────────────

  function setSection(section) {
    currentSection = section;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'));
    document.querySelector(`.nav-btn[data-section="${section}"]`)?.classList.add('on');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('on'));
    document.getElementById(`sec-${section}`)?.classList.add('on');

    const fab = document.getElementById('fab');
    fab.style.display = (section === 'tarefas' || section === 'registros') ? 'flex' : 'none';

    if (section === 'admin-users')  Admin.carregarUsuarios();
    if (section === 'admin-tasks')  Admin.carregarTarefasAdmin();
    if (section === 'admin-turmas') Admin.carregarTurmas();
  }

  // ─── Abas Pendentes / Concluídas ─────────────────────────────────────────

  function setTab(tab, el) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    el.classList.add('on');
    renderTarefas();
  }

  // ─── Menu admin (topbar) ─────────────────────────────────────────────────

  function toggleAdminMenu() {
    const btn  = document.getElementById('btn-admin-top');
    const drop = document.getElementById('admin-dropdown');
    const open = drop.classList.toggle('open');
    btn.classList.toggle('open', open);
  }

  function _fecharAdminMenu() {
    document.getElementById('admin-dropdown')?.classList.remove('open');
    document.getElementById('btn-admin-top')?.classList.remove('open');
  }

  function abrirSecaoAdmin(section) {
    _fecharAdminMenu();
    setSection(section);
  }

  function voltarDaAdmin() {
    setSection('tarefas');
  }

  // ─── Modais: Tarefas ──────────────────────────────────────────────────────

  function abrirModalTarefa() {
    // Preenche data de atribuição com hoje se ainda estiver vazia
    const inputAtrib = document.getElementById('m-atribuicao');
    if (inputAtrib && !inputAtrib.value) inputAtrib.value = Dates.hojeISO();
    document.getElementById('ov-tarefa').classList.add('on');
  }
  function fecharModalTarefa() { document.getElementById('ov-tarefa').classList.remove('on'); }

  // ─── Modais: Registros ────────────────────────────────────────────────────

  function abrirModalRegistro()  { document.getElementById('ov-registro').classList.add('on'); }
  function fecharModalRegistro() { document.getElementById('ov-registro').classList.remove('on'); }

  // ─── Modal: Config ────────────────────────────────────────────────────────

  // ─── Modal: Confirmação ──────────────────────────────────────────────────

  function abrirConfirma(titulo, sub, callback) {
    document.getElementById('confirma-titulo').textContent = titulo;
    document.getElementById('confirma-sub').textContent   = sub || 'Essa ação não pode ser desfeita.';
    _confirmaCallback = callback;

    // Se não há callback (ex: exibir erro), esconde botão de confirmar
    const footer = document.getElementById('confirma-footer');
    const btnOk  = document.getElementById('btn-confirma-ok');
    if (callback) {
      footer.style.display = '';
      btnOk.textContent = titulo.toLowerCase().includes('remov') ? 'Remover'
                        : titulo.toLowerCase().includes('exclu') ? 'Excluir'
                        : 'Confirmar';
    } else {
      // Modo erro: só botão "Fechar"
      btnOk.style.display = 'none';
      footer.querySelector('.btn-ghost').textContent = 'Fechar';
    }

    document.getElementById('ov-confirma').classList.add('on');
  }

  function fecharConfirma() {
    _confirmaCallback = null;
    document.getElementById('ov-confirma').classList.remove('on');
    // Restaura estado padrão
    const btnOk = document.getElementById('btn-confirma-ok');
    btnOk.style.display = '';
    const cancelBtn = document.getElementById('confirma-footer')?.querySelector('.btn-ghost');
    if (cancelBtn) cancelBtn.textContent = 'Cancelar';
  }



  async function confirmarAcao() {
    if (_confirmaCallback) {
      const btn = document.getElementById('btn-confirma-ok');
      btn.disabled    = true;
      btn.textContent = 'Aguarde...';
      try   { await _confirmaCallback(); }
      catch (e) { console.error(e); }
      finally { btn.disabled = false; }
    }
    fecharConfirma();
  }

  // ─── Modal: Config ────────────────────────────────────────────────────────

  function abrirCfg() {
    const u = Auth.get();
    document.getElementById('cfg2-dias').value = u.dias_urgencia;
    _updateRange('cfg2-dias', 'cfg2-dias-val');
    montarMultiSelect('cfg2-materias', u.materias_atencao || []);
    document.getElementById('ov-cfg').classList.add('on');
  }
  function fecharCfg() { document.getElementById('ov-cfg').classList.remove('on'); }

  // ─── FAB dispatcher ───────────────────────────────────────────────────────

  function fabClick() {
    if (currentSection === 'tarefas')   abrirModalTarefa();
    if (currentSection === 'registros') abrirModalRegistro();
  }

  // ─── Helpers de formulário ────────────────────────────────────────────────

  function updateRangeLabel(inputId, labelId) { _updateRange(inputId, labelId); }

  function montarMultiSelect(containerId, selecionadas) {
    const c = document.getElementById(containerId);
    c.innerHTML = '';
    MATERIAS.forEach(m => {
      const label = document.createElement('label');
      label.className = 'ms-opt';
      const chk = document.createElement('input');
      chk.type    = 'checkbox';
      chk.value   = m;
      chk.checked = selecionadas.includes(m);
      label.appendChild(chk);
      label.appendChild(document.createTextNode(m));
      c.appendChild(label);
    });
  }

  function getChecked(containerId) {
    return [...document.querySelectorAll(`#${containerId} input:checked`)].map(i => i.value);
  }

  function montarSelectMaterias() {
    ['m-mat', 'rg-mat'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">Selecione...</option>';
      MATERIAS.forEach(m => _addOpt(sel, m));
    });

    const filSel = document.getElementById('fil-mat');
    if (!filSel) return;
    const mats = [...new Set(Tasks.getCache().map(t => t.materia))].sort();
    filSel.innerHTML = '<option value="">Todas as matérias</option>';
    mats.forEach(m => _addOpt(filSel, m));
  }

  function render() { renderTarefas(); }

  // ─── Renderização: Tarefas ────────────────────────────────────────────────

  function renderTarefas() {
    const user    = Auth.get();
    const matFil  = document.getElementById('fil-mat')?.value || '';
    const ord     = document.getElementById('fil-ord')?.value || 'entrega';
    const atencao = user.materias_atencao || [];

    let visible = Tasks.getCache().filter(task => {
      if (task.visibilidade === 'privada' && task.owner_id !== user.id) return false;
      if (matFil && task.materia !== matFil) return false;
      const isDone = task.done_by.includes(user.id);
      return currentTab === 'concluidas' ? isDone : !isDone;
    });

    visible.sort((a, b) => {
      const aAt = atencao.includes(a.materia);
      const bAt = atencao.includes(b.materia);
      if (aAt && !bAt) return -1;
      if (!aAt && bAt) return  1;
      if (ord === 'entrega') return (a.data_entrega || '').localeCompare(b.data_entrega || '');
      if (ord === 'envio')   return (a.data_atribuicao   || 'z').localeCompare(b.data_atribuicao || 'z');
      return a.materia.localeCompare(b.materia);
    });

    const list = document.getElementById('task-list');
    if (visible.length === 0) {
      list.innerHTML = '<div class="empty">Nenhuma tarefa aqui ainda.</div>';
      return;
    }
    list.innerHTML = '';
    visible.forEach(task => _renderTaskCard(task, user, atencao, list));
  }

  function _renderTaskCard(task, user, atencao, container) {
    const isDone    = task.done_by.includes(user.id);
    const status    = isDone ? 'concluida' : Dates.taskStatus(task, user);
    const isAtencao = atencao.includes(task.materia);
    const isOwner   = task.owner_id === user.id;

    let sideClass = 'ok';
    if (status === 'atrasada')     sideClass = 'atrasada';
    else if (status === 'urgente') sideClass = 'urgente';
    else if (isAtencao && !isDone) sideClass = 'atencao';

    let statusBadge = '';
    if (status === 'concluida') {
      statusBadge = '<span class="badge b-ok">Concluída</span>';
    } else if (status === 'atrasada') {
      const d = Math.abs(Dates.daysUntil(task.data_entrega));
      statusBadge = `<span class="badge b-atrasada">Atrasada · ${d}d</span>`;
    } else if (status === 'urgente') {
      const d = Dates.daysUntil(task.data_entrega);
      statusBadge = `<span class="badge b-urgente">Urgente · ${d}d</span>`;
    } else {
      statusBadge = '<span class="badge b-ok">Em tempo</span>';
    }
    if (!isDone && isAtencao) statusBadge += '<span class="badge b-atencao">Atenção</span>';

    // Só o dono pode excluir pelo card. Admin usa a aba "Adm. Tarefas".
    const card = document.createElement('div');
    card.className = `tc ${sideClass}${isDone ? ' concluida' : ''}${isOwner ? ' owner-card' : ''}`;
    card.innerHTML = `
      <div class="chk${isDone ? ' on' : ''}" onclick="event.stopPropagation();Tasks.toggleDone('${task.id}')">${isDone ? '✓' : ''}</div>
      <div class="tb">
        <div class="tn${isDone ? ' riscado' : ''}">${task.nome}</div>
        <div class="meta">
          <span class="badge b-materia">${task.materia}</span>
          <span class="badge b-entrega">entrega: ${Dates.fmt(task.data_entrega)}</span>
          ${task.data_atribuicao ? `<span class="badge b-atribuicao">atribuída: ${Dates.fmt(task.data_atribuicao)}</span>` : ''}
          ${task.visibilidade === 'privada' ? '<span class="badge b-privada">privada</span>' : ''}
          ${statusBadge}
          <span class="badge b-user">@${task.owner_username || '?'}</span>
          ${isOwner ? '<span class="badge b-delete-hint">toque para excluir</span>' : ''}
        </div>
      </div>`;

    if (isOwner) {
      card.addEventListener('click', () => {
        UI.abrirConfirma(
          'Excluir tarefa?',
          `"${task.nome}" será removida permanentemente.`,
          () => Tasks.excluir(task.id)
        );
      });
    }

    container.appendChild(card);
  }

  // ─── Renderização: Registros ──────────────────────────────────────────────

  function renderRegistros() {
    const user  = Auth.get();
    const list  = document.getElementById('reg-list');
    const cache = Registros.getCache();

    if (cache.length === 0) {
      list.innerHTML = '<div class="empty">Nenhum registro ainda.</div>';
      return;
    }

    // Fixados primeiro, depois por data
    const sorted = [...cache].sort((a, b) => {
      if (a.fixado && !b.fixado) return -1;
      if (!a.fixado && b.fixado) return  1;
      return new Date(b.criado_em) - new Date(a.criado_em);
    });

    list.innerHTML = '';
    sorted.forEach(r => {
      const isOwner   = r.owner_id === user.id;
      const canDelete = isOwner || Auth.isAdmin();

      const card = document.createElement('div');
      card.className = `reg-card${r.fixado ? ' fixado' : ''}`;
      card.innerHTML = `
        <div class="reg-header">
          <div class="reg-title-row">
            ${r.fixado ? '<span class="pin-icon" title="Fixado">📌</span>' : ''}
            <span class="reg-titulo">${r.titulo}</span>
          </div>
          <div class="reg-actions">
            ${Auth.isAdmin() ? `<button class="btn-sm btn-pin" onclick="Admin.toggleFixar('${r.id}')">${r.fixado ? 'Desafixar' : 'Fixar'}</button>` : ''}
            ${canDelete ? `<button class="btn-icon-danger" onclick="Registros.excluir('${r.id}')">✕</button>` : ''}
          </div>
        </div>
        <div class="meta" style="margin-bottom:8px">
          <span class="badge b-materia">${r.materia}</span>
          <span class="badge b-user">@${r.owner_username || '?'}</span>
        </div>
        <p class="reg-desc">${r.descricao}</p>
        ${r.imagens?.length ? `
          <div class="reg-imgs">
            ${r.imagens.map(img => `<img src="${img.url}" class="reg-img" alt="imagem" onclick="UI.abrirImagem('${img.url}')" />`).join('')}
          </div>` : ''}`;
      list.appendChild(card);
    });
  }

  function abrirImagem(url) {
    document.getElementById('img-overlay-src').src = url;
    document.getElementById('ov-imagem').classList.add('on');
  }
  function fecharImagem() { document.getElementById('ov-imagem').classList.remove('on'); }

  // ─── privado ──────────────────────────────────────────────────────────────

  function _updateRange(inputId, labelId) {
    const val = document.getElementById(inputId).value;
    document.getElementById(labelId).textContent = val + ' dia' + (val > 1 ? 's' : '');
  }

  function _addOpt(sel, val) {
    const o = document.createElement('option');
    o.value = o.textContent = val;
    sel.appendChild(o);
  }

  // Fecha o dropdown admin ao clicar em qualquer lugar fora dele
  document.addEventListener('click', e => {
    const wrap = document.getElementById('admin-menu-wrap');
    if (wrap && !wrap.contains(e.target)) _fecharAdminMenu();
  });

  return {
    show, setSection, setTab,
    toggleAdminMenu, abrirSecaoAdmin, voltarDaAdmin,
    abrirModalTarefa, fecharModalTarefa,
    abrirModalRegistro, fecharModalRegistro,
    abrirCfg, fecharCfg,
    abrirConfirma, fecharConfirma, confirmarAcao,
    fabClick,
    updateRangeLabel, montarMultiSelect, getChecked, montarSelectMaterias,
    render, renderTarefas, renderRegistros,
    abrirImagem, fecharImagem,
  };
})();