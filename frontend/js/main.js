document.addEventListener('DOMContentLoaded', async () => {

  // Tenta restaurar sessão existente
  const restaurou = await Auth.tentarRestaurar();
  if (restaurou) {
    await Tasks.carregar();
    await Registros.carregar();
  }

  // Carrega turmas no form de cadastro
  await Auth.carregarTurmas();

  // Enter faz login/registro
  document.getElementById('l-senha')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') Auth.login();
  });

  // Fechar overlays clicando fora
  ['ov-tarefa','ov-registro','ov-cfg','ov-imagem'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target === e.currentTarget) {
        if (id === 'ov-tarefa')   UI.fecharModalTarefa();
        if (id === 'ov-registro') UI.fecharModalRegistro();
        if (id === 'ov-cfg')      UI.fecharCfg();
        if (id === 'ov-imagem')   UI.fecharImagem();
      }
    });
  });

  // Fechar com Esc
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    UI.fecharModalTarefa();
    UI.fecharModalRegistro();
    UI.fecharCfg();
    UI.fecharImagem();
  });
});