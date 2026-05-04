# StudyGraph 开发者指南

## 设计理念

StudyGraph 采用 **AI 增强的知识管理** 架构，核心设计原则：

1. **AI 作为辅助而非替代**：AI 生成的内容（问题、回答、专题页）始终支持用户编辑和覆盖
2. **渐进式学习**：通过"录入 → 探索 → 生成 → 修改"的循环，逐步深化知识理解
3. **数据本地化**：所有数据（SQLite 数据库、wiki 文件）存储在本地，无需外部数据库
4. **LLM 供应商无关**：通过 provider 抽象层支持多种 LLM 后端

---

## 系统架构

```
StudyGraph/
├── server/index.js          # Express API 服务器（PORT=3001）
├── core/
│   ├── llm-provider.js      # LLM 调用层（provider 切换、JSON 提取）
│   ├── storage.js            # SQLite 数据持久化
│   ├── wiki-storage.js       # Wiki 文件存储（专题页 HTML）
│   ├── dual-storage.js       # 双写层（SQLite + Wiki）
│   └── extractor.js          # 文件内容提取（Word 等）
├── portal/                   # React 前端（Vite 构建）
│   └── src/components/
│       ├── App.jsx           # 路由和主布局
│       ├── EntryDetail.jsx   # 知识点详情（专题页、问答、版本管理）
│       ├── DeepAnalysis.jsx  # 深入分析（子知识点拆解）
│       ├── IngestPanel.jsx   # 知识录入面板
│       ├── CategoryView.jsx  # 分类浏览
│       ├── TimelineView.jsx  # 时间线视图
│       ├── KnowledgeGraph.jsx # 知识图谱可视化
│       ├── QAPanel.jsx       # 全局问答面板
│       ├── QAPage.jsx        # 问答详情页
│       └── RestructurePanel.jsx # 知识重组
├── wiki/                     # Wiki 数据文件（.gitignore）
├── data/                     # SQLite 数据库（.gitignore）
└── docs/                     # 文档
```

### 关键设计决策

- **单进程部署**：Express 同时提供 API 和静态文件（portal/dist/），简化部署
- **Wiki 文件存储**：专题页 HTML 存储在 wiki/ 目录的 JSON 文件中，而非数据库
- **双写模式**：通过 dual-storage 同时写入 SQLite 和 wiki，保证数据一致性

---

## 重要组件详解

### core/llm-provider.js

LLM 调用的核心抽象层，负责：

- **Provider 管理**：支持 agent-maestro（Claude API 代理）和 ollama（本地模型）
- **extractJSON(text, opts)**：统一的 JSON 提取工具，支持：
  - Markdown 代码块清理
  - 数组/对象模式切换（`isArray`）
  - 尾逗号修复
  - 字符串内换行符修复
  - 智能引号修复（`repairKeys` 回退）
- **核心函数**：`analyze`、`askQuestion`、`generateTopicHTML`、`expandEntry`、`generateSmartQuestions`、`buildQAMindMap`、`findConnections`、`restructure`

### portal/src/components/EntryDetail.jsx

系统最复杂的组件（~1300 行），管理：

- **状态缓存机制**：通过 `sharedCacheRef` 和 `latestStateRef` 在组件卸载/重新挂载时保持状态（解决 DeepAnalysis 子页面切换时状态丢失的问题）
- **后台任务处理**：切换知识点后，后台正在进行的 AI 请求会将结果写入缓存而非直接更新 UI
- **版本管理**：专题页的多版本浏览、删除、合并
- **模式系统**：`annotation`（批注修改）、`merge`（版本合并）、`regenerate`（重新生成）、默认（增量更新）

### server/index.js

Express 服务器，提供以下 API：
- `POST /api/analyze` - AI 分析文本提取知识点
- `GET/POST/PUT/DELETE /api/entries` - 知识点 CRUD
- `POST /api/entries/:id/ask` - AI 问答
- `POST /api/entries/:id/smart-questions` - AI 生成智能问题
- `POST /api/entries/:id/topic-page` - 生成专题页
- `POST /api/entries/:id/expand` - AI 拆解子知识点
- `GET/POST /api/entries/:id/topic-pages` - 专题页版本管理

---

## 与 AI Agent 协作开发

### 开发原则

1. **改动前先理解**：在修改代码前，先阅读相关文件和测试，了解现有逻辑
2. **最小化改动**：只修改必要的部分，不做无关的重构或"顺便清理"
3. **保持测试通过**：每次修改后运行测试，确保不引入回归
4. **提交粒度**：每个独立的修改（bug 修复、功能添加）单独提交，提交信息清楚描述改动和原因

### 每次改动必须遵循的质量流程

**所有代码变更（无论大小）在提交前必须完成以下步骤：**

1. **运行回归测试**：`npm test` 运行全量测试，确保没有引入回归
2. **补充测试用例**：为本次改动添加对应的测试覆盖（bug 修复需要回归测试，新功能需要功能测试）
3. **全部测试通过**：所有测试（包括新增的）必须通过后才能提交
4. **重启服务验证**：构建前端（`npm run build`）并重启服务器，确认功能正常
5. **人工复核**：通知用户进行人工验收，确认改动符合预期

> ⚠️ 跳过任何一步可能导致线上问题。即使是"很小的改动"也必须走完整流程。

### 常见开发任务

**添加新的 AI 功能**：
1. 在 `core/llm-provider.js` 添加新函数，使用 `extractJSON` 处理 LLM 返回
2. 在 `server/index.js` 添加对应的 API endpoint
3. 在 `portal/src/lib/api.js` 添加前端 API 调用函数
4. 在对应的组件中集成 UI

**修复 LLM 输出解析问题**：
- 优先在 `extractJSON` 中添加修复逻辑（集中处理）
- 添加对应的单元测试到 `core/llm-provider.test.js`

**修改 EntryDetail 状态管理**：
- 如果添加新的状态字段，必须同步更新 `cacheableState()` 和 `restoreCache()`
- 检查 cache update effect 的依赖数组是否包含新字段

---

## 测试执行流程

### 运行所有测试
```bash
cd StudyGraph
npm test
```

### 运行前端测试
```bash
cd StudyGraph/portal
npx vitest run
```

### 运行后端/核心测试
```bash
cd StudyGraph
npx vitest run tests/
npx jest core/llm-provider.test.js
```

### 测试覆盖范围
- `core/llm-provider.test.js`：extractJSON 工具函数（11 个测试）
- `portal/src/test/EntryDetail.test.jsx`：EntryDetail 组件（46 个测试）
  - 基础渲染、专题页生成、智能问题、答案编辑、版本管理、缓存持久化等
- `tests/test-topic-page-isolation.js`：专题页数据隔离测试

---

## 重启相关进程

### 完整重启流程

```bash
# 1. 构建前端
cd StudyGraph/portal
npm run build

# 2. 停止旧服务器
cd StudyGraph
# Windows:
taskkill /F /PID $(cat server.pid)
# 或者找到占用 3001 端口的进程并终止：
netstat -ano | findstr :3001

# 3. 启动服务器
PORT=3001 node server/index.js &
echo $! > server.pid

# 4. 验证
curl http://localhost:3001/
```

### 仅前端更新（无需重启服务器）

如果只修改了前端代码（portal/src 下的文件）：
```bash
cd StudyGraph/portal
npm run build
# 服务器会自动提供新的 portal/dist/ 内容
# 浏览器中 Ctrl+Shift+R 强制刷新即可
```

### 开发模式

```bash
cd StudyGraph
npm run dev
# 同时启动 Express 服务器和 Vite 开发服务器（热更新）
```

### 注意事项

- 生产环境始终使用 **PORT=3001**
- 服务器进程 PID 记录在 `server.pid` 文件中
- 修改 `core/` 或 `server/` 下的文件需要重启服务器
- 修改 `portal/src/` 下的文件只需重新构建前端（`npm run build`）
- 数据目录（`wiki/`、`data/`、`uploads/`）不纳入 git 版本控制
