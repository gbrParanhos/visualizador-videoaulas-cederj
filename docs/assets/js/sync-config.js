/* ==========================================================================
   Client ID do OAuth do Google.

   Ele fica no repositório de propósito. Pelo desenho do OAuth (RFC 6749 §2.2),
   "the client identifier is not a secret" — uma aplicação de navegador é um
   *public client* e não tem onde guardar segredo, então o ID é enviado a todo
   visitante de qualquer forma. Quem controla o acesso é a lista de
   "Authorized JavaScript origins" no Google Cloud Console: o ID copiado para
   outro domínio não consegue obter token nenhum.

   O *client secret* que o Console gera junto com o ID é outra história e NÃO
   deve vir para cá — neste fluxo ele simplesmente não é usado.

   Se você forkou este projeto, crie o seu (README, seção "Sincronizar entre
   aparelhos"): o ID abaixo não funciona a partir da sua origem.
   Vazio (ou mal preenchido) = o menu ☁ avisa que o sync não está configurado.
   ========================================================================== */
window.EP = window.EP || {};
EP.SYNC_CLIENT_ID = '892778159277-t26dp88uet9qnmqmp432vsrhts772bog.apps.googleusercontent.com';
