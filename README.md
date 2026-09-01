# Vídeoaulas CEDERJ · Sistemas de Computação (não-oficial)

> ⚠️ **Projeto não-oficial**, feito por um aluno e **sem qualquer vínculo com o
> CEDERJ/CECIERJ**. Todos os créditos das aulas e dos slides são deles e dos professores, aqui é só um facilitador para chegar mais rápido ao que já existia. Fonte oficial: <https://cederj.edu.br/videoaulas/>

Um visualizador web, leve e sem back-end, para as **vídeoaulas do CEDERJ** (curso de
Sistemas de Computação) hospedadas no [EduPlay/RNP](https://eduplay.rnp.br). O projeto foi desenvolvido por um aluno para ser possível mesmo em dispositivos mobile assistir as aulas em tela cheia **com os slides sincronizados ao lado** conforme o vídeo avança, o slide correspondente muda sozinho.

Tudo roda no navegador é só HTML, CSS e JavaScript puro, sem framework e sem
servidor.

---

## ✨ O que dá pra fazer

- **Catálogo navegável** por período/disciplina, com busca por matéria ou aula.
- **Player com slide sincronizado**: vídeo de um lado, slide do outro, trocando
  automaticamente no tempo certo.
- **Navegar entre aulas** direto no player, com botões **◀ anterior** e **▶ próxima**
  (dentro da mesma disciplina; desabilitam nas pontas).
- **Colapsar/descolapsar a timeline de slides** (a tira de miniaturas embaixo do
  vídeo) pelo botão **▦ Timeline**, a preferência fica salva pro próximo acesso.
- **Timeline clicável**: pule direto para o momento de qualquer slide.
- **Galeria de slides** para folhear/estudar sem o vídeo.
- **Retomar de onde parou**: o progresso de cada aula é guardado no navegador, e
  aparece no catálogo (`▶ parou em 12:22 · 34%`).
- **Marcar aulas como assistidas** e acompanhar **quanto de cada matéria** já foi
  (veja [a seção abaixo](#-progresso-aulas-assistidas)).
- **Sincronizar entre aparelhos** pelo seu próprio Google Drive, num botão só
  (veja [a seção abaixo](#-sincronizar-entre-aparelhos)).
- **Tela cheia** mantendo vídeo + slide juntos.
- **Responsivo**: em retrato (celular) empilha vídeo em cima e slide embaixo.
- **URLs "de verdade"**: cada aula tem seu endereço (`player.html?id=…`), então dá
  pra **recarregar (F5), favoritar e compartilhar** o link de uma aula específica.

---

## 🗂️ As 3 páginas

O app é dividido em três páginas independentes que conversam pela URL (o `id` é o
identificador da aula no EduPlay):

| Página | O que é | Como se chega |
| --- | --- | --- |
| `docs/index.html` | Catálogo de disciplinas e aulas | página inicial |
| `docs/pages/player.html?id=<id>` | Vídeo + slide sincronizado | botão ▶ / nome da aula no catálogo |
| `docs/pages/slides.html?id=<id>` | Galeria de slides para consulta | botão ▦ Slides no catálogo |

Como a aula fica na URL, dar **F5 recarrega a mesma aula** (não volta pro catálogo),
e os botões ◀/▶ do player realmente navegam entre os endereços das aulas. O ✕ de
cada página volta ao catálogo.

---

## 🧠 Como funciona (visão geral)

- O **catálogo** e os **timings dos slides** ficam em `docs/assets/data/data.json`.
  Cada aula tem um `id` do EduPlay; os slides são uma lista de pares
  `[tempo_em_ms, arquivo_da_imagem]`.
- Os **timings são pré-calculados e embutidos** no JSON de propósito: a API do
  EduPlay não libera CORS, então não dá pra buscar essa sincronia ao vivo do
  navegador. Por isso ela já vem pronta no arquivo de dados.
- O **vídeo** é carregado assim, em ordem de preferência:
  1. **MP4 direto** (via `.../videos/<id>/h5p-url`), funciona em qualquer navegador
     e é o que permite o slide sincronizado + o "retomar de onde parou".
  2. **HLS nativo** (`.m3u8`), funciona em Chrome/Safari, também com slide ao lado.
  3. **Embed do EduPlay** (iframe), fallback quando as opções acima não tocam
     (ex.: HLS no Chrome/Android). Nesse modo não há slide sincronizado nem
     controle de progresso, porque o player é cross-origin.
- As **imagens dos slides** vêm direto do EduPlay (`assetPrefix` no JSON).

> Observação: o projeto **não hospeda** vídeos nem slides e **não reivindica nenhum
> crédito** sobre o conteúdo das aulas. Ele apenas organiza e aponta para o material
> já publicado, e foi **baseado no acesso às vídeoaulas disponibilizado pela própria
> CEDERJ** em <https://cederj.edu.br/videoaulas/> (conteúdo hospedado no EduPlay/RNP).

---

## 📁 Estrutura do projeto

```
.
├── docs/                          # tudo que vai pro GitHub Pages (source = /docs)
│   ├── index.html                 # catálogo (página inicial)
│   ├── pages/
│   │   ├── player.html            # player: vídeo + slide sincronizado (?id=…)
│   │   └── slides.html            # galeria de slides (?id=…)
│   └── assets/
│       ├── css/
│       │   └── styles.css         # todo o estilo (compartilhado pelas 3 páginas)
│       ├── js/
│       │   ├── core.js            # compartilhado: carrega o data.json + helpers
│       │   ├── store.js           # progresso + preferências (formato com timestamp)
│       │   ├── sync-config.js     # Client ID do OAuth do Google (só isso)
│       │   ├── gdrive.js          # sync do store via Google Drive do usuário
│       │   ├── syncui.js          # menu ☁ do catálogo + backup em arquivo
│       │   ├── catalog.js         # lógica do catálogo
│       │   ├── player.js          # lógica do player (sync, navegação, retomar)
│       │   └── gallery.js         # lógica da galeria de slides
│       └── data/
│           └── data.json          # catálogo + timings dos slides + fontes de vídeo
└── README.md
```

Tudo que o site precisa fica em `docs/` é a pasta que o GitHub Pages publica.
Cada página HTML carrega o `core.js` (comum) e o script específico dela. Como as
páginas de `pages/` ficam um nível abaixo dos assets, elas os referenciam com
`../assets/…`; o `core.js` resolve o caminho do `data.json` relativo a si mesmo,
então funciona igual nas duas profundidades.

---

## ▶️ Como rodar localmente

Como as páginas carregam o `data.json` via `fetch`, **abrir os arquivos com dois
cliques (`file://`) não funciona**, o navegador bloqueia a leitura do JSON local.
Rode um servidor estático simples na pasta do projeto:

```bash
# Python 3 (já vem na maioria dos sistemas), rode DE DENTRO da pasta docs/
cd docs
python3 -m http.server 8000
```

Depois abra <http://localhost:8000/> no navegador (servindo `docs/` como raiz, igual
ao que o GitHub Pages faz).

Alternativas equivalentes:

```bash
npx serve .        # Node
php -S localhost:8000
```

---

## ✅ Progresso (aulas assistidas)

Cada aula tem um estado **assistida (sim/não)** e uma **porcentagem**, e cada matéria
mostra **quantas das suas aulas já foram assistidas**.

### Como marcar uma aula como assistida

Das três formas, e todas gravam a mesma coisa:

1. **Sozinho**, quando o vídeo passa de **90%** do total.
2. **No player**, pelo checkbox **Assistida** na barra de cima.
3. **No catálogo**, pelo botão **✓** na linha da aula — sem precisar abrir a aula.
   Serve também para aulas que só abrem no EduPlay.

Desmarcar na mão **suspende a marcação automática** enquanto você estiver naquela aula.
Sem isso, desmarcar com o vídeo parado em 92% seria inútil: o próprio player remarcaria
meio segundo depois.

### De onde vêm as porcentagens

- **Da aula**: posição guardada ÷ duração do vídeo. A duração é medida quando você abre
  a aula e fica guardada junto com o resto — assim o catálogo mostra a % **sem precisar
  carregar o vídeo de novo**, e ela viaja no sync para os outros aparelhos. Aula que você
  nunca abriu não tem duração conhecida, então aparece só o `parou em …`, sem %.
- **`100%` só aparece em aula marcada como assistida.** Enquanto não estiver marcada, a
  barra para em 99% — assim "100%" e "não assistida" nunca se contradizem na tela.
- **Da matéria**: aulas marcadas ÷ aulas que existem de fato (as indisponíveis na fonte
  ficam de fora, senão 100% seria inalcançável). É o `4/18 · 22%` e a barrinha verde no
  cabeçalho da disciplina.

Tudo isso entra no mesmo arquivo de sincronia descrito abaixo, então marcar uma aula no
celular reflete no PC.

---

## ☁️ Sincronizar entre aparelhos

Começar uma aula no celular e continuar no PC. O botão **☁** no topo do catálogo abre
um menu com **Sincronizar**, e pronto.

**Continua sem back-end.** O arquivo de sincronia vive no **Google Drive de quem está
usando** — este projeto não tem servidor, não tem banco, não tem conta de usuário e não
vê nada. É literalmente um `videoaulas-cederj.sync.json` na sua conta, que você pode
abrir ou apagar quando quiser.

O que é sincronizado: o **progresso de cada aula**, o **estado de assistida**, a
**duração** de cada aula (para a %) e a preferência da timeline. Nada mais sai do aparelho.

### Como funciona a fusão (e por que não perde progresso)

Cada item guarda **quando** foi alterado. Ao sincronizar, o app baixa o arquivo, funde
**aula por aula** (vence o registro mais recente) e sobe o resultado. Como isso é
idempotente e não depende de ordem, os aparelhos convergem sozinhos, sem ninguém
coordenando — que é justamente o que dispensa o servidor.

Concluir uma aula grava um marcador `[0, data]` em vez de apagar o registro, e o mesmo
vale para **desmarcar** uma aula assistida (grava `[false, data]`). Sem isso, um aparelho
que ainda tivesse o estado antigo o ressuscitaria na próxima sincronia.

A duração é a exceção: como é um fato objetivo do vídeo, igual em qualquer aparelho, ela
é fundida por união simples e não carrega data.

### Permissões e privacidade

O app pede **um único escopo**, o `drive.file`, que dá acesso **apenas aos arquivos que
o próprio app criou**. Ele não consegue ler, listar nem tocar em mais nada do seu Drive
— nem que quisesse. O token de acesso fica só na memória da aba e nunca é gravado em
disco. "Desconectar este aparelho" esquece tudo localmente e **não apaga nada** no Drive.

O SDK do Google só é baixado **quando você abre o menu ☁**. Quem nunca usa o sync não
faz nenhuma requisição a terceiros.

### Backup em arquivo (funciona sem Google)

No mesmo menu: **Exportar backup** baixa um `.json`, **Importar backup** funde ele no
que você já tem (não sobrescreve). Serve de backup e de plano B.

### Configurando num fork

O `docs/assets/js/sync-config.js` guarda o **Client ID do OAuth**. Ele fica no repositório
de propósito: pelo desenho do OAuth 2.0 ([RFC 6749 §2.2](https://www.rfc-editor.org/rfc/rfc6749#section-2.2)),
*"the client identifier is not a secret"* — uma aplicação de navegador é um *public client*,
sem onde guardar segredo, e o ID é enviado a todo visitante de qualquer forma. Quem controla
o acesso é a lista de **Authorized JavaScript origins**: copiado para outro domínio, o ID não
consegue token nenhum. Ou seja: **o ID deste repositório não vai funcionar no seu fork** —
crie o seu:

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto.
2. Ative a **Google Drive API**.
3. Em **OAuth consent screen**: tipo *External*, preencha o branding e adicione **somente**
   o escopo `.../auth/drive.file`. Publique em *Production*.
   Como esse escopo não é sensível, **não precisa de verificação do Google** nem tem
   limite de usuários.
   Dê ao app um nome que deixe claro que é **não-oficial** — um app OAuth público com nome
   que sugira ser do CEDERJ é motivo de suspensão por falsidade ideológica.
4. Em **Credentials → OAuth client ID → Web application**, cadastre em
   *Authorized JavaScript origins* a origem do seu site (ex.: `https://seuusuario.github.io`)
   e, para desenvolver, `http://localhost:8000`. Não precisa *redirect URI*.
5. Cole o Client ID em `docs/assets/js/sync-config.js`. Faça isso com atenção: um ID mal
   colado é detectado (o menu ☁ diz que não está configurado, em vez de deixar o usuário
   descobrir na tela do Google), mas quem detecta é só o formato — ele precisa terminar em
   `.apps.googleusercontent.com`.

> O **client secret** que o Console gera junto com o ID é outra coisa e **não** deve vir
> para cá: neste fluxo ele simplesmente não é usado. Publique o ID, nunca o secret.

Sem o Client ID, o menu ☁ continua aparecendo e avisa que o sync não está configurado — o
export/import de arquivo continua funcionando normalmente.

### Limitação conhecida

A sincronia roda **no catálogo**, não dentro do player. O progresso feito num aparelho
sobe quando você volta ao catálogo (o ✕ do player já faz isso). Se você fechar a aba
direto no player, aquele trecho só sobe na próxima visita ao catálogo.

---

## 💬 Consideração final

A ideia **não é** transformar isto num produto cheio de features. O uso "de verdade",
no dia a dia, deve continuar sendo pela **própria plataforma do CEDERJ/EduPlay**
este projeto é só um visualizador de conveniência para assistir mobile com o slide ao lado.

Mas fico **aberto a sugestões e reports de bug** (caso queira pode até abrir _Issues_ ou
_Pull Requests_) se quiser contribuir. 🙂
