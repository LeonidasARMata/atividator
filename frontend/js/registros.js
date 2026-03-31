const Registros = (() => {
  let cache = [];
  const getCache = () => cache;

  async function carregar() {
    try { cache = await Api.getRegistros(); UI.renderRegistros(); }
    catch (e) { console.error(e.message); }
  }

  async function add() {
    const titulo    = document.getElementById('rg-titulo').value.trim();
    const materia   = document.getElementById('rg-mat').value;
    const descricao = document.getElementById('rg-desc').value.trim();
    const files     = document.getElementById('rg-imgs').files;
    const err       = document.getElementById('rg-err');

    if (!titulo || !materia || !descricao) { err.style.display = 'block'; return; }
    err.style.display = 'none';

    try {
      const novo = await Api.createRegistro(titulo, materia, descricao, [...files]);
      cache.unshift(novo);
      UI.fecharModalRegistro();
      _limpar();
      UI.renderRegistros();
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro e suas imagens?')) return;
    try {
      await Api.deleteRegistro(id);
      cache = cache.filter(r => r.id !== id);
      UI.renderRegistros();
    } catch (e) { alert(e.message); }
  }

  function _limpar() {
    ['rg-titulo','rg-desc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('rg-mat').value  = '';
    document.getElementById('rg-imgs').value = '';
  }

  return { getCache, carregar, add, excluir };
})();