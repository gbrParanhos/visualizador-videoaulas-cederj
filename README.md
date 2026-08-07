# Vídeoaulas CEDERJ · Sistemas de Computação

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
- **Retomar de onde parou**: o progresso de cada aula é guardado no navegador.
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

## 💬 Consideração final

A ideia **não é** transformar isto num produto cheio de features. O uso "de verdade",
no dia a dia, deve continuar sendo pela **própria plataforma do CEDERJ/EduPlay**
este projeto é só um visualizador de conveniência para assistir mobile com o slide ao lado.

Mas fico **aberto a sugestões e reports de bug** (caso queira pode até abrir _Issues_ ou
_Pull Requests_) se quiser contribuir. 🙂
