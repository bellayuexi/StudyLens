# StudyLens 开发者指南

## 设计理念

StudyLens 采用 **AI 增强的知识管理** 架构，核心设计原则：

1. **AI 作为辅助而非替代**：AI 生成的内容（问题、回答、专题页）始终支持用户编辑和覆盖
2. **渐进式学习**：通过"录入 → 探索 → 生成 → 修改"的循环，逐步深化知识理解
3. **数据本地化**：所有数据以 Markdown/JSON 文件存储在用户主目录下的 `~/.studylens/` 目录（全局安装时），无需外部数据库
4. **LLM 供应商无关**：通过 provider 抽象层支持多种 LLM 后端（OpenAI-compatible、Ollama 等）

---

## 系统架构

```
StudyLens/
├── server/index.js          # Express API 服务器（PORT=3000）
├── core/
│   ├── llm-provider.js      # LLM 调用层（provider 切换、JSON 提取）
│   ├── wiki-storage.js      # Markdown 文件存储（知识点、专题页、索引）
│   └── extractor.js         # 文件/URL 内容提取（PDF、Word、Excel、网页）
├── portal/                   # React 前端（Vite 构建）
│   └── src/
│       ├── components/
│       │   ├── App.jsx           # 路由和主布局
│       │   ├── EntryDetail.jsx   # 知识点详情（专题页、问答、版本管理）
│       │   ├── DeepAnalysis.jsx  # 深入分析（子知识点拆解）
│       │   ├── IngestPanel.jsx   # 知识录入面板（粘贴笔记 AI 拆解、手动逐条添加，可设最大知识点数）
│       │   ├── CategoryView.jsx  # 分类浏览
│       │   ├── TimelineView.jsx  # 时间线视图
│       │   ├── KnowledgeGraph.jsx # 知识图谱可视化
│       │   ├── QAPanel.jsx       # 全局问答面板
│       │   ├── QAPage.jsx        # 问答详情页
│       │   ├── SettingsPanel.jsx  # 设置面板（LLM 配置、Prompt 配置）
│       │   └── RestructurePanel.jsx # 知识重组
│       └── lib/
│           ├── api.js            # API 调用封装
│           └── exportHtml.js     # HTML 导出（含打印分页优化）
├── config/                   # 配置模板
│   ├── prompts.json          # Prompt 模板（按学科自定义）
│   └── llm-config.template.json # LLM 配置模板
├── bin/studylens.js          # CLI 入口（npm 全局安装用，注入 ~/.studylens 数据目录）
├── ~/.studylens/             # 用户数据目录（全局安装时；开发模式回退项目内 wiki/）
│   ├── wiki/                 # 知识点 Markdown、专题页、JSON 索引
│   ├── uploads/              # 上传文件临时目录
│   ├── logs/                 # 运行日志
│   └── llm-config.json       # 用户 LLM 配置（含 API Key）
├── tests/                    # API 集成测试
├── e2e/                      # Playwright E2E 测试
└── docs/                     # 文档
```

### 关键设计决策

- **单进程部署**：Express 同时提供 API 和静态文件（portal/dist/），简化部署
- **Markdown 文件存储**：所有数据以 Markdown + YAML frontmatter 格式存储在 `~/.studylens/wiki/` 目录（全局安装时），方便版本控制和人工编辑
- **npm 可发布**：通过 `bin/studylens.js` 支持全局安装，`npx studylens` 即可启动

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
- **核心函数**：`analyze`（支持 maxPoints 限制提取数量）、`askQuestion`、`generateTopicHTML`、`expandEntry`、`generateSmartQuestions`、`buildQAMindMap`、`findConnections`、`checkDuplicates`、`restructure`

### portal/src/components/EntryDetail.jsx

系统最复杂的组件（~1300 行），管理：

- **状态缓存机制**：通过 `sharedCacheRef` 和 `latestStateRef` 在组件卸载/重新挂载时保持状态（解决 DeepAnalysis 子页面切换时状态丢失的问题）
- **后台任务处理**：切换知识点后，后台正在进行的 AI 请求会将结果写入缓存而非直接更新 UI
- **版本管理**：专题页的多版本浏览、删除、合并
- **模式系统**：`annotation`（批注修改）、`merge`（版本合并）、`regenerate`（重新生成）、默认（增量更新）

### server/index.js

Express 服务器，提供以下 API：
- `POST /api/ingest` - AI 分析文本提取知识点（支持 maxPoints 参数限制数量）
- `POST /api/ingest/file` - 上传文件提取知识点（PDF、Word、Excel、TXT；端点保留，当前未在前端 UI 暴露）
- `POST /api/ingest/url` - 从网页 URL 提取知识点（端点保留，当前未在前端 UI 暴露）
- `POST /api/entries` - 手动添加单个知识点（不经过 AI）
- `POST /api/entries/:id/children` - 手动添加子知识点（深入分析）
- `GET/PUT/DELETE /api/entries/:id` - 知识点 CRUD
- `GET /api/graph` - 获取知识图谱（节点 + 连接）
- `POST /api/entries/:id/ask` - 知识点范围内 AI 问答
- `POST /api/entries/:id/questions` - AI 生成智能问题
- `POST /api/entries/:id/topic-page` - 生成/更新专题页
- `POST /api/entries/:id/topic-page/save` - 保存专题页版本
- `DELETE /api/entries/:id/topic-page/:version` - 删除指定专题页版本
- `POST /api/entries/:id/expand` - AI 拆解子知识点
- `GET /api/entries/:id/topic-pages` - 专题页版本列表
- `POST /api/qa` - 全局 AI 问答
- `POST /api/restructure` - AI 重组知识结构
- `GET/PUT /api/settings` - Prompt 配置
- `GET/POST /api/llm/config` - LLM 供应商配置

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
cd StudyLens
npm test
```

### 运行前端测试
```bash
cd StudyLens/portal
npx vitest run
```

### 运行后端/核心测试
```bash
cd StudyLens
npx vitest run tests/
```

### 运行 E2E 测试
```bash
cd StudyLens
npx playwright test
```

### 测试覆盖范围
- `tests/`：API 集成测试（52 个测试）— 知识点 CRUD、数据隔离、extractJSON 等
- `portal/src/test/`：前端组件测试（60 个测试）— EntryDetail、IngestPanel 等
- `e2e/`：Playwright E2E 测试 — 设置面板、知识录入、编辑、导航等端到端场景

---

## 重启相关进程

### 完整重启流程

```bash
# 1. 构建前端
cd StudyLens/portal
npm run build

# 2. 停止旧服务器（找到占用 3000 端口的进程并终止）
# Windows:
netstat -ano | findstr :3000
taskkill /F /PID <pid>
# Linux/Mac:
kill $(lsof -ti:3000)

# 3. 启动服务器
cd StudyLens
node server/index.js &

# 4. 验证
curl http://localhost:3000/api/graph
```

### 仅前端更新（无需重启服务器）

如果只修改了前端代码（portal/src 下的文件）：
```bash
cd StudyLens/portal
npm run build
# 服务器会自动提供新的 portal/dist/ 内容
# 浏览器中 Ctrl+Shift+R 强制刷新即可
```

### 开发模式

```bash
cd StudyLens
npm run dev
# 同时启动 Express 服务器（端口 3000）和 Vite 开发服务器（端口 3001，热更新）
```

### 注意事项

- 默认端口 **3000**（可通过 `PORT` 环境变量覆盖）
- 修改 `core/` 或 `server/` 下的文件需要重启服务器
- 修改 `portal/src/` 下的文件只需重新构建前端（`npm run build`）
- 数据目录（`wiki/`、`uploads/`）不纳入 git 版本控制
