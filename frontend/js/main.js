document.addEventListener('DOMContentLoaded', async () => {
 
  // Acorda o servidor imediatamente ao abrir a página (warm-up).
  // O Render hiberna após 15min sem uso — essa chamada acontece em
  // segundo plano enquanto o usuário ainda está digitando login/senha,
  // então quando ele clicar em "Entrar" o servidor já está de pé.
  _warmup();
 
  // Tenta restaurar sessão existente
  const restaurou = await Auth.tentarRestaurar();
  if (restaurou) {
    await Tasks.carregar();
    await Registros.carregar();
  }
 
  // Carrega turmas no form de cadastro
  await Auth.carregarTurmas();
 
  // Enter faz login
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
 
// Chama /health silenciosamente para acordar o servidor.
// Não bloqueia nada — roda em paralelo com o resto da página.
// Se falhar, ignora (o erro vai aparecer só no login mesmo).
function _warmup() {
  fetch(CONFIG.API_URL + '/health', { method: 'GET' }).catch(() => {});
}
 