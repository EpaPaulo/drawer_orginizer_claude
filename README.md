# ORGANIZA

Transforma uma gaveta de casa num conjunto de caixas modulares à medida,
prontas a imprimir em 3D.

A app é a implementação da proposta UI/UX **“gavetas de casa”**. O modo de
ferramentas (tracing de contornos) ficou de fora desta versão.

> Interface em português (pt-PT), tal como a proposta. Os comentários do código
> seguem a mesma língua.

## O que faz

1. **A gaveta** — medidas interiores (largura, profundidade, altura útil) e,
   opcionalmente, uma fotografia como referência.
2. **O conteúdo** — escolher os grupos a arrumar (escrita, cabos, panos…),
   quanto há de cada um e que formato pedem.
3. **A proposta** — a distribuição é calculada para aquelas medidas e pode ser
   editada: arrastar, rodar, trocar de tamanho, mudar o nome, acrescentar e
   remover caixas.
4. **Produzir** — descarregar os ficheiros STL, ou a lista de peças para pedir
   orçamento a um serviço de impressão.

Tudo corre no navegador. Não há conta, servidor nem envio de dados: o projeto e
a fotografia ficam em `localStorage`.

## O que é real e o que não é

Vale a pena ser claro, porque a proposta original era um protótipo:

- **Real** — a distribuição das caixas é calculada por um solver para as
  medidas introduzidas; os ficheiros STL são geometria válida e fechada, pronta
  a fatiar; a verificação do tamanho da base da impressora e a estimativa de
  filamento são calculadas a partir das peças.
- **Não é real** — a fotografia **não é analisada automaticamente**. Serve de
  referência visual; é o utilizador que diz o que está na gaveta. Não há
  encomendas nem pagamentos: a opção “receber um kit” produz a lista de peças e
  os ficheiros para levar a quem os produza.

## Como funcionam os módulos

Todas as caixas são múltiplos de um **módulo base de 40 mm**, o que lhes permite
combinarem-se sem sobras irregulares. São os cinco formatos da proposta:

| Módulo   | Tamanho  | Em módulos |
| -------- | -------- | ---------- |
| Quadrado | 8 × 8 cm | 2 × 2      |
| Pequeno  | 12 × 8 cm | 3 × 2     |
| Longo    | 24 × 8 cm | 6 × 2     |
| Médio    | 16 × 12 cm | 4 × 3    |
| Grande   | 24 × 16 cm | 6 × 4    |

Cada grupo aceita uma lista ordenada de módulos, do preferido ao mínimo
tolerável. O solver coloca-os do maior para o menor, na primeira posição livre,
experimentando as duas orientações; quando o preferido não cabe, desce na lista
em vez de desistir. Se ainda assim ficar alguém de fora, há uma segunda
tentativa com toda a gente no módulo mínimo — é preferível arrumar todos os
grupos em caixas pequenas do que servir bem o primeiro e deixar o resto na
gaveta à solta.

## Executar

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # typecheck + build de produção para dist/
npm run preview    # serve o build
npm test           # testes do solver e da geração de STL
npm run typecheck
```

## Estrutura

```
src/
  domain/          lógica pura, sem React e com testes
    modules.ts     módulo base de 40 mm, catálogo de formatos, grelha da gaveta
    groups.ts      grupos típicos de uma gaveta e preferências de módulo
    solver.ts      distribuição na grelha e edições (mover, rodar, trocar)
    stl.ts         malha dos tabuleiros e escrita de STL binário
    project.ts     modelo do projeto, validações, resumo e persistência
  components/      um ficheiro por etapa, mais o esquema da gaveta em SVG
  lib/             leitura da fotografia e transferência de ficheiros
```

A camada `domain/` não depende do React e é onde estão os testes. O esquema da
gaveta é SVG: arrastar com o rato ou o dedo, e as setas do teclado movem a caixa
selecionada módulo a módulo.

## Os ficheiros STL

Cada caixa é um tabuleiro aberto no topo — paredes e fundo de 2 mm — gerado como
malha fechada de 28 triângulos e escrito em STL binário. Os testes verificam que
cada aresta tem exatamente um par oposto (malha estanque), que as normais
apontam para fora e que o volume da malha corresponde ao volume calculado.

A altura das caixas é a altura útil da gaveta menos 5 mm de folga, entre 20 e
120 mm. As medidas indicadas são exteriores e incluem as paredes.
