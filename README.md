# Bubble Studio 0.1

Ambiente oficial de desenvolvimento da linguagem **Bubble** — criado e idealizado
por **Ruan**. Este repositório contém o primeiro MVP funcional do Studio: editor
próprio da linguagem, compilador real e prévia 3D.

> O Bubble Studio não é uma demonstração visual. O compilador analisa código de
> verdade (lexer → parser → AST → semântica → tipos → IR) e a prévia 3D renderiza
> uma cena WebGL real com métricas medidas no dispositivo.

## O que já existe

| Área | Situação |
| --- | --- |
| PWA (manifesto, service worker, ícones, instalação, offline) | implementado |
| Editor Bubble (destaque, linhas, indentação, autocompletar, diagnósticos) | implementado |
| Lexer / Parser / AST / semântica / tipos / IR / pacote | implementado |
| Painel de compilação com estatísticas, diagnósticos e artefatos | implementado |
| Prévia 3D WebGL com câmera, luzes, materiais, shader, FPS real | implementado |
| Idiomas pt-BR (padrão), en, es, ar (RTL) + seletor salvo | implementado |
| Tema escuro/claro/sistema, layout responsivo PC/tablet/celular | implementado |
| Executor, Omni 3D, pacotes assinados, construtores de struct | **não implementado** |

A linguagem em si está em `docs/LANGUAGE.md` e é um **núcleo provisório 0.1**:
tudo que o compilador aceita está documentado, e símbolos sem função aprovada
permanecem reservados.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do compilador e das traduções
npm run build      # build de produção
npm run icons      # regenera os ícones do PWA
```

O app é servido na porta **3000** e funciona como PWA instalável em navegadores
modernos (Chrome/Edge/Android; Safari/iOS instala pela opção “Adicionar à Tela de
Início”, com as limitações conhecidas do sistema).

## Estrutura

```
src/
  bubble/
    language/spec.ts        definição única da linguagem
    compiler/               lexer, parser, ast, semantic, typecheck, ir, compiler
  editor/                   CodeMirror + linguagem Bubble (destaque/autocomplete)
  three/
    assets/                 carregamento assíncrono e cache de texturas
    scene/                  descrição da cena (lógica)
    render/                 renderer, câmera, loop, métricas, descarte
  components/               painéis da interface
  i18n/                     traduções (pt-BR, en, es, ar)
  studio/                   projeto, persistência e preferências
public/                     manifesto, service worker, offline, ícones
docs/LANGUAGE.md            especificação do núcleo da linguagem
```

## Limites conhecidos (honestos)

- **Executor**: não existe ainda. Os eventos `start/update/draw/stop` são
  validados, mas não executados.
- **Omni 3D**: a prévia usa WebGL próprio do Studio; o motor oficial não está
  implementado. A cena é um adaptador de pré-visualização.
- **Assets**: as texturas da prévia são geradas localmente até os assets oficiais
  serem adicionados ao repositório.
- **Structs**: só é possível obter valores de struct por tipos nativos (`vec3`);
  literais/construtores estão pendentes.
- **Testes em dispositivos reais**: ainda não realizados (requisito da
  especificação antes de declarar compatibilidade total).

Créditos de criação: **Ruan**.
