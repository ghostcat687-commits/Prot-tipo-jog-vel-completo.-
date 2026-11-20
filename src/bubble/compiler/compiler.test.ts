import { describe, expect, it } from 'vitest';
import { compileProject, type SourceFile } from './compiler';

const file = (content: string, path = 'main.bubble'): SourceFile => ({ path, content });

function compile(content: string, extra: SourceFile[] = []) {
  return compileProject([file(content), ...extra]);
}

const codes = (result: ReturnType<typeof compileProject>): string[] =>
  result.diagnostics.map((diagnostic) => diagnostic.code);

const VALID_PROGRAM = `module main

const LIMITE: num = 100

struct Bloco {
  id: num
  dureza: num
}

fn dano(base: num, multiplicador: num) -> num {
  let total: num = base * multiplicador
  if total > LIMITE {
    return LIMITE
  }
  return total
}

on start {
  let nome: text = "Bubble"
  print(nome)
  let valores: list<num> = [1, 2, 3]
  for valor in valores {
    let dobro: num = valor * 2
    print("valor")
  }
}
`;

describe('compilador Bubble — programa válido', () => {
  it('compila e gera IR + manifesto', () => {
    const result = compile(VALID_PROGRAM);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.stats.functions).toBe(1);
    expect(result.stats.events).toBe(1);
    expect(result.stats.structs).toBe(1);
    expect(result.artifacts.map((a) => a.path)).toContain('ir/main.bubbleir.json');
    expect(result.artifacts.map((a) => a.path)).toContain('package/manifest.json');
  });

  it('a IR carrega tipos resolvidos', () => {
    const result = compile(VALID_PROGRAM);
    const module = result.modules[0];
    expect(module.format).toBe('bubble-ir');
    expect(module.functions[0].name).toBe('dano');
    expect(module.functions[0].params).toEqual([
      { name: 'base', type: 'num' },
      { name: 'multiplicador', type: 'num' },
    ]);
    expect(module.functions[0].returns).toBe('num');
    expect(module.events[0].event).toBe('start');
  });

  it('resolve `use` entre arquivos do projeto', () => {
    const result = compile(
      `module main\n\nuse core.math\n\non start {\n  print("ok")\n}\n`,
      [file('module core.math\n\nfn soma(a: num, b: num) -> num {\n  return a + b\n}\n', 'core/math.bubble')],
    );
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('lexer — caracteres especiais', () => {
  it('reconhece símbolo reservado e informa linha/coluna', () => {
    const result = compile('module main\nlet a: num = 1 • 2\n');
    const diagnostic = result.diagnostics.find((d) => d.code === 'BUB101');
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.params?.symbol).toBe('•');
    expect(diagnostic?.span.start.line).toBe(2);
    expect(diagnostic?.span.start.column).toBe(16);
  });

  it('não confunde símbolo reservado dentro de texto', () => {
    const result = compile('module main\nlet a: text = "○ ● □"\n');
    expect(codes(result)).not.toContain('BUB101');
  });

  it('reporta texto não terminado', () => {
    const result = compile('module main\nlet a: text = "sem fim\n');
    expect(codes(result)).toContain('BUB104');
  });

  it('reporta caractere desconhecido', () => {
    const result = compile('module main\nlet a: num = 1 € 2\n');
    expect(codes(result)).toContain('BUB102');
  });
});

describe('análise semântica', () => {
  it('reporta nome não declarado', () => {
    const result = compile('module main\non start {\n  print(nomeInexistente)\n}\n');
    const diagnostic = result.diagnostics.find((d) => d.code === 'BUB301');
    expect(diagnostic?.params?.name).toBe('nomeInexistente');
    expect(diagnostic?.span.start.line).toBe(3);
  });

  it('impede atribuição a constante', () => {
    const result = compile(
      'module main\nconst A: num = 1\n\nfn troca() {\n  A = 2\n}\n',
    );
    expect(codes(result)).toContain('BUB303');
  });

  it('impede break fora de laço', () => {
    const result = compile('module main\non start {\n  break\n}\n');
    expect(codes(result)).toContain('BUB304');
  });

  it('aceita return dentro de evento (encerra o handler)', () => {
    const result = compile('module main\non start {\n  return\n}\n');
    expect(codes(result)).not.toContain('BUB306');
  });

  it('recusa valor de retorno em evento (void)', () => {
    const result = compile('module main\non start {\n  return 1\n}\n');
    expect(codes(result)).toContain('BUB406');
  });

  it('detecta declaração duplicada', () => {
    const result = compile('module main\nlet a: num = 1\nlet a: num = 2\n');
    expect(codes(result)).toContain('BUB302');
  });

  it('detecta evento desconhecido', () => {
    const result = compile('module main\non teletransporte {\n  print("x")\n}\n');
    expect(codes(result)).toContain('BUB307');
  });

  it('detecta módulo inexistente em use', () => {
    const result = compile('module main\nuse nao.existe\n');
    expect(codes(result)).toContain('BUB309');
  });
});

describe('verificação de tipos', () => {
  it('recusa atribuir texto a num', () => {
    const result = compile('module main\nlet a: num = "texto"\n');
    const diagnostic = result.diagnostics.find((d) => d.code === 'BUB401');
    expect(diagnostic?.params).toMatchObject({ expected: 'num', actual: 'text' });
  });

  it('recusa condição não booleana', () => {
    const result = compile('module main\non start {\n  if 1 {\n    print("x")\n  }\n}\n');
    expect(codes(result)).toContain('BUB404');
  });

  it('valida quantidade de argumentos', () => {
    const result = compile('module main\non start {\n  print(clamp(1, 2))\n}\n');
    expect(codes(result)).toContain('BUB402');
  });

  it('valida tipo de argumento', () => {
    const result = compile('module main\non start {\n  print(sqrt("x"))\n}\n');
    expect(codes(result)).toContain('BUB403');
  });

  it('valida campo de struct', () => {
    const result = compile(
      'module main\nfn usa(v: vec3) -> num {\n  return v.w\n}\n',
    );
    const diagnostic = result.diagnostics.find((d) => d.code === 'BUB310');
    expect(diagnostic?.params).toMatchObject({ field: 'w', type: 'vec3' });
  });

  it('valida retorno incompatível', () => {
    const result = compile(
      'module main\nfn f() -> num {\n  return "texto"\n}\n',
    );
    expect(codes(result)).toContain('BUB406');
  });

  it('avisa função sem retorno garantido', () => {
    const result = compile('module main\nfn f(x: num) -> num {\n  if x > 0 {\n    return 1\n  }\n}\n');
    expect(codes(result)).toContain('BUB407');
  });

  it('recusa percorrer valor que não é lista', () => {
    const result = compile('module main\non start {\n  for item in 10 {\n    print("x")\n  }\n}\n');
    expect(codes(result)).toContain('BUB414');
  });

  it('recusa lista com tipos incompatíveis', () => {
    const result = compile('module main\nlet l: list<num> = [1, "dois"]\n');
    expect(codes(result)).toContain('BUB417');
  });

  it('inferir tipo em list<num> e permitir indexação', () => {
    const result = compile(
      'module main\nlet lista: list<num> = [1, 2]\nlet primeiro: num = lista[0]\n',
    );
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
});

describe('otimização e pacote', () => {
  it('dobra constantes numéricas', () => {
    const result = compile('module main\nconst A: num = 2 + 3 * 4\n');
    expect(result.stats.constantFolds).toBe(2);
    expect(result.modules[0].globals[0].value).toMatchObject({ op: 'num', value: 14 });
  });

  it('não gera artefatos quando há erro', () => {
    const result = compile('module main\nlet a: num = "x"\n');
    expect(result.ok).toBe(false);
    expect(result.artifacts).toEqual([]);
  });

  it('exige pelo menos um arquivo .bubble', () => {
    const result = compileProject([file('{}', 'arms/structure.json')]);
    expect(codes(result)).toContain('BUB501');
  });

  it('valida JSON do projeto', () => {
    const result = compileProject([
      file('module main\n'),
      file('{ "quebrado": }', 'arms/structure.json'),
    ]);
    expect(codes(result)).toContain('BUB502');
  });
});
