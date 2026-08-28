---
name: ant-design-mobile
description: Diretrizes de uso e referência para a biblioteca Ant Design Mobile (React)
metadata:
  type: reference
---

# Ant Design Mobile – Diretrizes de Uso

Esta skill reúne as principais informações e recomendações para quem trabalha com a biblioteca **Ant Design Mobile** (React) – um conjunto de componentes UI focado em aplicações web mobile.

## Visão geral
- **Objetivo**: Fornecer blocos de UI reutilizáveis, leves e otimizados para dispositivos móveis.
- **Principais metas**:
  - Desempenho rápido em redes lentas e dispositivos de baixo poder de processamento.
  - Tematização fácil via CSS‑variables para adequar a identidade visual da marca.
  - Componentes atômicos (botões, listas, selectors, tabs, etc.) que evitam peso desnecessário.
  - Experiência fluida com animações e gestos táteis.
  - Suporte a acessibilidade (ARIA) e internacionalização (RTL).

## Quando usar
- Desenvolvimento de **aplicações web mobile** ou **PWAs** que exigem UI nativa‑like.
- Projetos que já utilizam o ecossistema Ant Design e desejam consistência visual entre web desktop e mobile.
- Necessidade de **bundle pequeno** e **tempo de carregamento curto**.
- Quando a equipe precisa de componentes já testados e com documentação/demos integradas.

## Componentes principais (exemplos)
| Categoria | Componentes notáveis |
|-----------|-----------------------|
| Navegação | `TabBar`, `NavBar`, `Drawer` |
| Feedback | `Toast`, `Badge`, `PullToRefresh` |
| Formulários | `InputItem`, `Picker`, `DatePicker`, `SearchBar` |
| Listas & Grids | `List`, `Grid`, `Carousel` |
| Layout | `Flex`, `WingBlank`, `WhiteSpace` |

## Boas práticas
1. **Importação seletiva** – importe apenas os componentes que realmente serão usados para reduzir o tamanho do bundle.
2. **Tematização** – utilize o provider `<ConfigProvider>` ou sobrescreva as variáveis CSS (`--adm-color-primary`, `--adm-border-radius`, etc.) para adaptar as cores, tipografia e espaçamento.
3. **Gestos táteis** – quando usar componentes que envolvem swipe ou scroll, teste em dispositivos reais para garantir responsividade.
4. **Acessibilidade** – verifique atributos `aria-label`, `role` e suporte a navegação por teclado nos componentes interativos.
5. **Internacionalização** – habilite `locale` no `ConfigProvider` e use os recursos de RTL quando necessário.

## Como referenciar na documentação ou tickets
- **Repositório**: https://github.com/ant-design/ant-design-mobile
- **Versão estável (última)**: Consulte o `package.json` ou `npm view antd-mobile version` para saber a versão corrente.
- **Docs oficiais**: https://mobile.ant.design
- **Exemplo de uso**:
  ```tsx
  import { Button, List, NavBar } from 'antd-mobile';

  const Home = () => (
    <>
      <NavBar>Meu App</NavBar>
      <List>
        <List.Item extra='Detalhe'>Item 1</List.Item>
      </List>
      <Button color='primary'>Confirmar</Button>
    </>
  );
  ```

## Perguntas frequentes (FAQ)
- **É compatível com Next.js?** Sim, basta instalar a dependência e usar a importação padrão. Para SSR, use `dynamic` ou carregamento cliente‑only quando necessário.
- **Como reduzir ainda mais o bundle?** Combine importação seletiva com ferramentas de tree‑shaking (Webpack, Vite) e habilite a minificação de CSS.
- **Posso criar temas customizados?** Sim – defina um objeto de tema e passe ao `<ConfigProvider theme={myTheme}>`.
- **Qual a licença?** MIT – permite uso livre, inclusive comercial.

---
*Esta skill pode ser invocada com `/ant-design-mobile` para obter rapidamente a visão geral, boas práticas e exemplos de uso da biblioteca.*