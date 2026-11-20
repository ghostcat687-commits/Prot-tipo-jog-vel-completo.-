# Linguagem Bubble — núcleo provisório 0.1

Este documento descreve **exatamente** o que o compilador do Bubble Studio aceita
hoje. Ele é a referência do código-fonte em `src/bubble/` e está marcado como
**PROPOSTO**: a especificação oficial do projeto (seção 17 do rascunho) ainda não
fechou a sintaxe nem a função de cada caractere especial.

> Regra do projeto: o compilador nunca inventa sintaxe silenciosamente. Tudo que
> ele reconhece está aqui, e tudo que não está aprovado permanece **reservado**.

## 1. Arquivos e módulos

- Extensão de código: `.bubble` (decisão ainda **PENDENTE** na especificação; o
  Studio usa `.bubble`, como no exemplo `core/main.bubble`).
- Todo arquivo pode declarar seu módulo na primeira linha:
  `module core.game.performance`
- Módulos podem ser qualificados (`a.b.c`). `use core.math` importa o módulo
  `core.math` ou o arquivo `core/math.bubble`.
- Um arquivo sem `module` gera **aviso** `BUB311`, não erro.

## 2. Gramática (EBNF simplificada)

```ebnf
programa      = [ módulo ] { uso | struct | função | evento | global } ;
módulo        = "module" nomeQualificado ;
uso           = "use" nomeQualificado ;
struct        = "struct" ID "{" { ID ":" tipo } "}" ;
função        = "fn" ID "(" [ parâmetro { "," parâmetro } ] ")"
                [ "->" tipo ] bloco ;
parâmetro     = ID ":" tipo ;
evento        = "on" ID bloco ;
global        = ( "let" | "const" ) ID [ ":" tipo ] "=" expressão ;

tipo          = "num" | "text" | "bool" | "void" | "any"
              | "list" "<" tipo ">" | ID /* struct */ ;

bloco         = "{" { instrução } "}" ;
instrução     = declaraçãoLocal | se | enquanto | para | retorno
              | "break" | "continue" | atribuição | expressão | bloco ;
declaraçãoLocal = ( "let" | "const" ) ID [ ":" tipo ] [ "=" expressão ] ;
se            = "if" expressão bloco [ "else" ( se | bloco ) ] ;
enquanto      = "while" expressão bloco ;
para          = "for" ID "in" expressão bloco ;
retorno       = "return" [ expressão ] ;
atribuição    = expressão "=" expressão ;

expressão     = ou ;
ou            = e { "or" e } ;
e             = igualdade { "and" igualdade } ;
igualdade     = comparação { ( "==" | "!=" ) comparação } ;
comparação    = soma { ( "<" | "<=" | ">" | ">=" ) soma } ;
soma          = produto { ( "+" | "-" ) produto } ;
produto       = unário { ( "*" | "/" | "%" ) unário } ;
unário        = ( "-" | "not" | "!" ) unário | posfixo ;
posfixo       = primário { "." ID | "[" expressão "]" | "(" [ args ] ")" } ;
primário      = número | texto | "true" | "false" | ID | "(" expressão ")"
              | "[" [ expressão { "," expressão } ] "]" ;
```

Comentários: `// linha` e `/* bloco */`.
Não há terminador `;` (decisão futura). Cada instrução termina pelo fim da linha
ou pelo fechamento de bloco.

## 3. Palavras reservadas

`module` `use` `fn` `let` `const` `struct` `if` `else` `while` `for` `in`
`return` `break` `continue` `on` `and` `or` `not` `true` `false`

## 4. Tipos

| Tipo | Uso |
| --- | --- |
| `num` | número (ponto flutuante de 64 bits) |
| `text` | texto |
| `bool` | `true` / `false` |
| `void` | ausência de valor (retorno de função) |
| `any` | tipo desconhecido/curinga (usado nas assinaturas nativas) |
| `list<T>` | lista homogênea |
| `vec3` | struct nativa com `x`, `y`, `z` do tipo `num` |

Structs declaradas no projeto também são tipos válidos dentro do módulo.

## 5. Símbolos

Os símbolos abaixo têm função **definida** e o parser os usa:

| Símbolo | Função |
| --- | --- |
| `+` | soma numérica ou concatenação de texto |
| `-` | subtração / negação |
| `*` `/` `%` | multiplicação, divisão, resto |
| `=` | atribuição |
| `==` `!=` `<` `<=` `>` `>=` | comparação |
| `->` | tipo de retorno |
| `!` | negação lógica |
| `(` `)` `{` `}` `[` `]` | agrupamento, blocos, listas |
| `,` `:` `.` | separadores e acesso a membro |
| `"` | literal de texto |

**Reservados** (reconhecidos pelo lexer, sem função aprovada; o uso gera erro
`BUB101` com o símbolo e a posição):

```
× ÷ _ @ # $ ^ & ' ; ? ` ~ \ | ° • ○ ● □ ■ ♤ ♡ ◇ ♧ ☆ ▪︎ ¤ 《 》
```

`_` pode aparecer **dentro** de identificadores (`meu_nome`), mas não sozinho.
`×` e `÷` estão reservados para uma possível futura forma de multiplicação e
divisão — nada é assumido antes da aprovação.

## 6. Biblioteca padrão provisória

| Função | Assinatura | Retorno |
| --- | --- | --- |
| `print` | `(text)` | `void` |
| `sqrt` | `(num)` | `num` |
| `abs` | `(num)` | `num` |
| `floor` | `(num)` | `num` |
| `min` `max` | `(num, num)` | `num` |
| `clamp` | `(num, num, num)` | `num` |
| `len` | `(text)` ou `(list<any>)` | `num` |
| `vec3` | `(num, num, num)` | `vec3` |

A execução dessas funções depende do futuro **Bubble Executor**. O compilador
valida assinatura, quantidade e tipos dos argumentos.

## 7. Eventos

`on start`, `on update`, `on draw`, `on stop` — sem parâmetros, no máximo um
bloco por evento por módulo. Quem chama os eventos é o Executor (ainda não
implementado); o compilador apenas valida a declaração.

O corpo de um evento se comporta como uma função `void`: `return` sem valor
encerra o handler e `return <valor>` é erro (`BUB406`).

## 8. Pipeline do compilador

1. **Lexer** (`lexer.ts`) — tokens com linha/coluna; símbolos reservados e
   caracteres desconhecidos viram diagnóstico.
2. **Parser** (`parser.ts`) — AST com recuperação por instrução.
3. **AST** (`ast.ts`) — nós independentes do compilador.
4. **Análise semântica** (`semantic.ts`) — declarações, escopos, resolução de
   nomes, regras estruturais.
5. **Verificação de tipos** (`typecheck.ts`) — tipos de todas as expressões.
6. **IR** (`ir.ts`) — representação intermediária tipada, gerada só sem erros.
7. **Pacote** (`compiler.ts`) — `ir/<módulo>.bubbleir.json` +
   `package/manifest.json` + relatório.

Otimização implementada: dobra de constantes numéricas e de texto (segura,
registrada em `stats.constantFolds`).

## 9. Diagnósticos

| Código | Significado |
| --- | --- |
| BUB101 | símbolo reservado usado |
| BUB102 | caractere desconhecido |
| BUB103 | escape inválido |
| BUB104 | texto não terminado |
| BUB105 | comentário de bloco não terminado |
| BUB106 | número inválido |
| BUB201 | token inesperado |
| BUB202 | token esperado |
| BUB203 | declaração de módulo fora do início |
| BUB205 | alvo de atribuição inválido |
| BUB207 | tipo inválido |
| BUB208 | variável sem tipo e sem valor inicial |
| BUB301 | nome não declarado |
| BUB302 | declaração duplicada |
| BUB303 | atribuição a constante |
| BUB304/BUB305 | `break`/`continue` fora de laço |
| BUB306 | `return` fora de função |
| BUB307/BUB308 | evento desconhecido / duplicado |
| BUB309 | módulo não encontrado em `use` |
| BUB310 | campo inexistente em struct |
| BUB311 | arquivo sem módulo (aviso) |
| BUB313 | campo duplicado em struct |
| BUB316 | nome já usado pela biblioteca padrão |
| BUB401 | tipo incompatível |
| BUB402/BUB403 | quantidade/tipo de argumento |
| BUB404 | condição não booleana |
| BUB405 | operador indefinido para os tipos |
| BUB406 | retorno incompatível |
| BUB407 | função pode terminar sem retorno (aviso) |
| BUB408/BUB409 | indexação inválida |
| BUB410 | tipo desconhecido |
| BUB411 | valor `void` usado |
| BUB412 | tipo não inferível |
| BUB413 | chamada de membro não suportada |
| BUB414 | `for` sobre valor que não é lista |
| BUB415 | valor chamado como função |
| BUB416 | tipo sem membros |
| BUB417 | lista com tipos incompatíveis |
| BUB418 | função usada como valor |
| BUB419 | expressão sem efeito (aviso) |
| BUB501 | projeto sem arquivo `.bubble` |
| BUB502 | JSON inválido no projeto |

As mensagens são traduzidas em `src/i18n/locales/*` (pt-BR, en, es, ar).

## 10. Como expandir a linguagem

1. Edite `src/bubble/language/spec.ts` (palavra reservada, tipo, símbolo,
   função nativa ou evento).
2. Atualize o parser/AST apenas se a estrutura mudar.
3. Atualize este documento e a versão da linguagem.
4. Adicione testes em `src/bubble/compiler/compiler.test.ts` cobrindo o código
   válido e o inválido.

## 11. Decisões ainda PENDENTES

- Função formal de cada caractere especial (lista acima segue reservada).
- Separador `::` ("Double Anchor") — não implementado.
- Formato final do pacote `.bubble` e das permissões.
- Construtores de struct e literais de struct.
- Métodos (chamadas `obj.método()`).
- Semântica de execução dos eventos (depende do Executor).
