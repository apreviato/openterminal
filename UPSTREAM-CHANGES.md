# Análise de Mudanças do OpenCode Upstream

**Versão Base do OpenTerminal**: v1.2.15 (26 Feb 2026)  
**Última Versão OpenCode**: v1.2.20 (06 Mar 2026)  
**Período Analisado**: v1.2.16 → v1.2.20 (8 dias)

---

## 📊 Resumo Executivo

| Categoria       | Impacto  | Mudanças Relevantes                               |
| --------------- | -------- | ------------------------------------------------- |
| **Core/CLI**    | 🔴 ALTO  | Compatibilidade Bun → Node.js, correções críticas |
| **TUI**         | 🟡 MÉDIO | Melhorias de UX, markdown rendering               |
| **Desktop/Web** | 🟢 BAIXO | Não usado pelo OpenTerminal                       |
| **SDK**         | 🟢 BAIXO | Não usado pelo OpenTerminal                       |

---

## 🔴 Mudanças Críticas (ALTO IMPACTO)

### v1.2.19 - Migração Bun → Node.js APIs

**Contexto**: OpenCode está migrando de APIs específicas do Bun para APIs Node.js para melhor compatibilidade.

#### Mudanças Implementadas:

1. **Substituição de APIs Bun**:

   ```diff
   - Bun.stderr
   - Bun.color
   + Node.js equivalents

   - Bun.connect
   + net.createConnection

   - Bun.hash (xxHash3-XXH64)
   + SHA1 / Hash.fast

   - Bun.write
   + Filesystem.write

   - Bun.sleep
   + Node.js timers (setTimeout/setInterval)

   - Bun.stdin.text
   + node:stream/consumers
   ```

2. **Impacto no OpenTerminal**:
   - ✅ **Positivo**: Melhor compatibilidade cross-platform
   - ⚠️ **Atenção**: Verificar se nosso código usa APIs Bun específicas
   - 🔍 **Ação**: Auditar uso de `Bun.*` no código

#### Arquivos Potencialmente Afetados:

```
packages/opencode/src/cli/
packages/opencode/src/file/
packages/opencode/src/config/
```

---

### v1.2.20 - Correções de Memória e Performance

1. **Memory Leak Fix**:
   - **Problema**: fsmonitor daemons causavam 60GB+ de memória após testes
   - **Solução**: Stop leaking fsmonitor daemons
   - **Impacto**: 🟢 Positivo - melhor gestão de recursos

2. **Stdin Restoration**:
   - **Mudança**: Restore Bun stdin reads for prompt input
   - **Impacto**: 🟡 Verificar se afeta input do TUI

3. **Bun.which Replacement**:
   - **Mudança**: Replace Bun.which with npm which
   - **Impacto**: 🟢 Baixo - comando interno

---

### v1.2.16 - OpenTUI Upgrade + Markdown

**IMPORTANTE**: Esta é a mudança mais relevante para tabelas!

```diff
- OpenTUI v0.1.81 (ou anterior)
+ OpenTUI v0.1.86
+ Markdown rendering habilitado por padrão
```

#### Detalhes:

- **Upgrade OpenTUI to v0.1.86**
- **Enable markdown rendering by default**
- Pode resolver problemas de alinhamento de tabelas!

#### Ação Recomendada:

```bash
# Atualizar @opentui/core e @opentui/solid
bun add @opentui/core@0.1.86 @opentui/solid@0.1.86
```

---

## 🟡 Mudanças Médias (MÉDIO IMPACTO)

### v1.2.18 - TUI Improvements

1. **onClick Handlers**:
   - Add onClick handler to InlineTool and Task components
   - Melhora interatividade do TUI

2. **SIGHUP Handling**:
   - Handle SIGHUP signal and kill process gracefully
   - Melhor shutdown em ambientes Unix

3. **Dax UI Isolation**:
   - Don't let Dax touch the UI
   - Previne conflitos de renderização

---

### v1.2.17 - Workspace & Scrollbar

1. **Workspace Integration**:
   - Rework workspace integration and adaptor interface
   - Add workspace_id to session table
   - **Impacto**: 🟢 Baixo - feature não usada pelo OpenTerminal

2. **TUI Scrollbar**:
   - Show scrollbar by default
   - **Impacto**: 🟢 Positivo - melhor UX

3. **Orphaned Processes**:
   - Prevent orphaned opencode subprocesses on shutdown
   - **Impacto**: 🟢 Positivo - melhor cleanup

---

### v1.2.16 - Múltiplas Melhorias

1. **Error Handling**:
   - Recover from 413 Request Entity Too Large via automatic compaction
   - Show human-readable message for HTML error responses
   - **Impacto**: 🟢 Positivo - melhor UX

2. **MCP Process Management**:
   - Kill orphaned MCP child processes
   - Expose OPENCODE_PID on shutdown
   - **Impacto**: 🟢 Positivo - melhor gestão de recursos

3. **TUI Improvements**:
   - Replace curved arrow with straight arrow (terminal compatibility)
   - Show pending tool call count instead of 'Running...'
   - Use arrow indicator for active tool execution
   - **Impacto**: 🟢 Positivo - melhor feedback visual

---

## 🟢 Mudanças Baixas (BAIXO IMPACTO)

### Desktop/Web (Não Usado)

- Todas as mudanças em `app`, `desktop`, `console` não afetam OpenTerminal
- Refatoração para SolidJS, animações, UI compacta, etc.
- **Impacto**: ⚪ Nenhum

### SDK (Não Usado)

- Mudanças no SDK v2
- **Impacto**: ⚪ Nenhum

---

## 📋 Checklist de Ações Recomendadas

### 🔴 Prioridade Alta

- [ ] **Atualizar @opentui para v0.1.86**

  ```bash
  bun add @opentui/core@0.1.86 @opentui/solid@0.1.86
  ```

  - **Motivo**: Markdown rendering melhorado (resolve tabelas!)
  - **Arquivo**: `package.json`

- [ ] **Auditar uso de APIs Bun específicas**

  ```bash
  grep -r "Bun\." packages/opencode/src/
  ```

  - **Verificar**: `Bun.sleep`, `Bun.write`, `Bun.hash`, `Bun.connect`
  - **Substituir**: Por equivalentes Node.js se necessário

- [ ] **Testar stdin/prompt input**
  - **Verificar**: Input do TUI funciona corretamente
  - **Arquivo**: `packages/opencode/src/cli/cmd/tui/`

### 🟡 Prioridade Média

- [ ] **Revisar gestão de processos MCP**
  - **Verificar**: Cleanup de processos filhos
  - **Arquivo**: `packages/opencode/src/mcp/`

- [ ] **Testar SIGHUP handling**
  - **Verificar**: Shutdown gracioso em Unix
  - **Arquivo**: `packages/opencode/src/cli/`

- [ ] **Verificar scrollbar padrão**
  - **Testar**: Scrollbar visível no TUI
  - **Arquivo**: `packages/opencode/src/cli/cmd/tui/`

### 🟢 Prioridade Baixa

- [ ] **Revisar error messages**
  - Mensagens mais legíveis para erros HTML
  - Auto-compaction em 413 errors

- [ ] **Atualizar indicadores visuais**
  - Setas retas ao invés de curvas
  - Contadores de tool calls

---

## 🎯 Recomendação Principal

### **ATUALIZAR @opentui IMEDIATAMENTE**

A mudança mais impactante para o OpenTerminal é:

```json
{
  "dependencies": {
    "@opentui/core": "0.1.86",
    "@opentui/solid": "0.1.86"
  }
}
```

**Motivo**:

1. ✅ Markdown rendering habilitado por padrão
2. ✅ Provavelmente resolve problemas de tabelas
3. ✅ Melhorias gerais de renderização
4. ✅ Compatível com código atual

**Comando**:

```bash
cd packages/opencode
bun add @opentui/core@0.1.86 @opentui/solid@0.1.86
```

---

## 📊 Tabela de Compatibilidade

| Componente         | OpenTerminal v1.2.15 | OpenCode v1.2.20        | Status           |
| ------------------ | -------------------- | ----------------------- | ---------------- |
| **@opentui/core**  | 0.1.81               | 0.1.86                  | 🔴 Desatualizado |
| **@opentui/solid** | 0.1.81               | 0.1.86                  | 🔴 Desatualizado |
| **Bun APIs**       | Usado                | Migrando para Node.js   | 🟡 Atenção       |
| **TUI Core**       | Estável              | Melhorias incrementais  | 🟢 OK            |
| **MCP**            | Funcional            | Melhor cleanup          | 🟢 OK            |
| **Markdown**       | Padrão               | Experimental habilitado | 🟡 Testar        |

---

## 🔍 Mudanças Ignoradas (Não Relevantes)

### Desktop/App (100+ mudanças)

- SolidJS refactoring
- Compact UI mode
- Animation system
- Turkish translations
- Timeline performance
- File tree improvements
- Permission notifications
- Zen mode
- **Motivo**: OpenTerminal não usa desktop/web

### SDK v2

- Client/Server updates
- **Motivo**: OpenTerminal não usa SDK

### Console/Enterprise

- Routing fixes
- Locale sync
- **Motivo**: Features enterprise não usadas

---

## 📝 Notas Adicionais

### Sobre Bun → Node.js Migration

OpenCode está gradualmente migrando para APIs Node.js para:

1. Melhor compatibilidade cross-platform
2. Reduzir dependência de features específicas do Bun
3. Facilitar testes e CI/CD

**Para OpenTerminal**:

- ✅ Continuamos usando Bun como runtime
- ✅ Mas usamos APIs Node.js quando possível
- ✅ Melhor portabilidade futura

### Sobre OpenTUI v0.1.86

Esta versão inclui:

- Melhor suporte a markdown
- Correções de renderização
- Performance improvements
- **Provavelmente resolve o problema de tabelas!**

---

## 🚀 Próximos Passos

1. **Imediato**: Atualizar @opentui
2. **Curto prazo**: Auditar APIs Bun
3. **Médio prazo**: Testar todas as features
4. **Longo prazo**: Manter sincronização com upstream

---

**Última Atualização**: 07 Mar 2026  
**Analisado por**: OpenTerminal Maintenance Team  
**Próxima Revisão**: Quando OpenCode lançar v1.2.21+
