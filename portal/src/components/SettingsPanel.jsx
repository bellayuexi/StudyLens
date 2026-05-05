import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, getLLMConfig, saveLLMConfig, testLLMProvider } from '../lib/api.js';

const PROMPT_TYPES = [
  { key: 'analyzePrompt', label: '知识提取 Prompt' },
  { key: 'questionsPrompt', label: '智能提问 Prompt' },
  { key: 'topicPrompt', label: '专题页 Prompt' },
  { key: 'qaPrompt', label: '问答 Prompt' },
];

export default function SettingsPanel({ onClose, firstRun }) {
  const [settings, setSettings] = useState({ subjects: {}, defaultPrompts: {} });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);
  const [llmConfig, setLlmConfig] = useState(null);
  const [llmExpanded, setLlmExpanded] = useState(!!firstRun);
  const [llmDirty, setLlmDirty] = useState(false);
  const [llmSaving, setLlmSaving] = useState(false);
  const [testResults, setTestResults] = useState({});
  const llmOrigRef = useRef(null);
  const originalRef = useRef(null);

  useEffect(() => {
    getSettings().then(data => {
      setSettings(data);
      originalRef.current = JSON.stringify(data);
    });
    getLLMConfig().then(data => {
      setLlmConfig(data);
      llmOrigRef.current = JSON.stringify(data);
    });
  }, []);

  const subjectKeys = Object.keys(settings.subjects);
  const defaults = settings.defaultPrompts || {};

  const markDirty = (updater) => {
    setSettings(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setDirty(JSON.stringify(next) !== originalRef.current);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(settings);
    originalRef.current = JSON.stringify(settings);
    setDirty(false);
    setSaving(false);
  };

  const updateLlm = (updater) => {
    setLlmConfig(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setLlmDirty(JSON.stringify(next) !== llmOrigRef.current);
      return next;
    });
  };

  const handleLlmSave = async () => {
    setLlmSaving(true);
    await saveLLMConfig(llmConfig);
    llmOrigRef.current = JSON.stringify(llmConfig);
    setLlmDirty(false);
    setLlmSaving(false);
  };

  const handleTest = async (name) => {
    setTestResults(prev => ({ ...prev, [name]: { testing: true } }));
    const result = await testLLMProvider(name);
    setTestResults(prev => ({ ...prev, [name]: result }));
  };

  const addSubject = () => {
    const name = newSubject.trim();
    if (!name || settings.subjects[name]) return;
    const subjectDefaults = {};
    for (const pt of PROMPT_TYPES) {
      if (defaults[pt.key]) subjectDefaults[pt.key] = defaults[pt.key];
    }
    markDirty(prev => ({ ...prev, subjects: { ...prev.subjects, [name]: subjectDefaults } }));
    setNewSubject('');
    setExpanded(name);
  };

  const removeSubject = (name) => {
    markDirty(prev => {
      const { [name]: _, ...rest } = prev.subjects;
      return { ...prev, subjects: rest };
    });
    if (expanded === name) setExpanded(null);
  };

  const updatePrompt = (subject, key, value) => {
    markDirty(prev => ({
      ...prev,
      subjects: {
        ...prev.subjects,
        [subject]: { ...prev.subjects[subject], [key]: value },
      },
    }));
  };

  const updateDefault = (key, value) => {
    markDirty(prev => ({
      ...prev,
      defaultPrompts: { ...prev.defaultPrompts, [key]: value },
    }));
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd',
    fontSize: 12, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #2a2d35', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fff' }}>⚙️ 设置</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span style={{ fontSize: 11, color: '#fbbc05' }}>有未保存的修改</span>}
          <button onClick={handleSave} disabled={saving || !dirty}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: dirty ? 'pointer' : 'default',
              background: dirty ? '#34a853' : '#2a2d35', color: dirty ? '#fff' : '#666', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={onClose}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#4285f4', color: '#fff', fontSize: 13 }}>
            ← 返回
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {firstRun && (
          <div style={{ padding: '12px 16px', marginBottom: 16, borderRadius: 8, background: '#4285f415', border: '1px solid #4285f440', color: '#8ab4f8', fontSize: 13 }}>
            👋 欢迎使用 StudyLens！请先配置 AI 模型才能使用智能功能。展开下方「LLM 模型配置」，启用并测试至少一个 Provider。
          </div>
        )}
        {/* LLM Provider Config — first */}
        {llmConfig && (
          <div style={{ marginBottom: 20, borderRadius: 8, border: '1px solid #2a2d35', background: '#161822' }}>
            <div onClick={() => setLlmExpanded(!llmExpanded)}
              style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {llmExpanded ? '▼' : '▶'} LLM 模型配置
              </span>
              {llmDirty && <span style={{ fontSize: 11, color: '#fbbc05' }}>未保存</span>}
            </div>
            {llmExpanded && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>默认模式</label>
                  <select value={llmConfig.defaultProvider || 'auto'}
                    onChange={e => updateLlm(prev => ({ ...prev, defaultProvider: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="auto">自动检测 (推荐)</option>
                    {Object.keys(llmConfig.providers || {}).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {Object.entries(llmConfig.providers || {}).map(([name, cfg]) => {
                  const desc = name === 'agent-maestro' ? '通过 VS Code Copilot 免费使用（需 Agent Maestro 扩展）'
                    : name === 'openai-compatible' ? '使用 OpenAI 或兼容 API（需要 API Key）'
                    : name === 'ollama' ? '本地免费模型（需安装 Ollama）' : '';
                  return (
                  <div key={name} style={{ marginBottom: 12, padding: 10, borderRadius: 6, border: '1px solid #2a2d45', background: '#1a1d2e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>{name}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <label style={{ fontSize: 11, color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="checkbox" checked={cfg.enabled !== false}
                            onChange={e => updateLlm(prev => ({
                              ...prev, providers: { ...prev.providers, [name]: { ...prev.providers[name], enabled: e.target.checked } }
                            }))} />
                          启用
                        </label>
                        <button onClick={() => handleTest(name)}
                          disabled={testResults[name]?.testing}
                          style={{ padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                            background: '#4285f420', color: '#4285f4', fontSize: 11 }}>
                          {testResults[name]?.testing ? '测试中...' : '测试'}
                        </button>
                      </div>
                    </div>
                    {desc && <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>{desc}</div>}
                    {testResults[name] && !testResults[name].testing && (
                      <div style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, marginBottom: 6,
                        background: testResults[name].ok ? '#34a85320' : '#ea433520',
                        color: testResults[name].ok ? '#34a853' : '#ea4335' }}>
                        {testResults[name].message}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#777' }}>Base URL</label>
                        <input value={cfg.baseUrl || ''} onChange={e => updateLlm(prev => ({
                          ...prev, providers: { ...prev.providers, [name]: { ...prev.providers[name], baseUrl: e.target.value } }
                        }))} style={{ ...inputStyle, fontSize: 11 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#777' }}>模型</label>
                        <input value={cfg.model || ''} onChange={e => updateLlm(prev => ({
                          ...prev, providers: { ...prev.providers, [name]: { ...prev.providers[name], model: e.target.value } }
                        }))} style={{ ...inputStyle, fontSize: 11 }} />
                      </div>
                    </div>
                    {name === 'openai-compatible' && (
                      <div style={{ marginTop: 6 }}>
                        <label style={{ fontSize: 11, color: '#777' }}>API Key</label>
                        <input type="password" value={cfg.apiKey || ''} onChange={e => updateLlm(prev => ({
                          ...prev, providers: { ...prev.providers, [name]: { ...prev.providers[name], apiKey: e.target.value } }
                        }))} style={{ ...inputStyle, fontSize: 11 }} />
                      </div>
                    )}
                  </div>
                  )})}

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>任务路由</label>
                  <p style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>指定每种任务使用哪个 Provider（default = 使用默认模式）</p>
                  {Object.entries(llmConfig.taskRouting || {}).map(([task, provider]) => (
                    <div key={task} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#aaa', width: 80 }}>{task}</span>
                      <select value={provider || 'default'} onChange={e => updateLlm(prev => ({
                        ...prev, taskRouting: { ...prev.taskRouting, [task]: e.target.value }
                      }))} style={{ ...inputStyle, flex: 1, fontSize: 11, cursor: 'pointer' }}>
                        <option value="default">default（跟随默认模式）</option>
                        {Object.keys(llmConfig.providers || {}).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <button onClick={handleLlmSave} disabled={llmSaving || !llmDirty}
                  style={{ marginTop: 12, padding: '6px 16px', borderRadius: 6, border: 'none', cursor: llmDirty ? 'pointer' : 'default',
                    background: llmDirty ? '#34a853' : '#2a2d35', color: llmDirty ? '#fff' : '#666', fontSize: 12 }}>
                  {llmSaving ? '保存中...' : '保存 LLM 配置'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Prompt Config — wraps defaults + per-subject */}
        <div style={{ marginBottom: 20, borderRadius: 8, border: '1px solid #2a2d35', background: '#161822' }}>
          <div onClick={() => setPromptsExpanded(!promptsExpanded)}
            style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {promptsExpanded ? '▼' : '▶'} Prompt 配置
            </span>
            {dirty && <span style={{ fontSize: 11, color: '#fbbc05' }}>未保存</span>}
          </div>
          {promptsExpanded && (
            <div style={{ padding: '0 14px 14px' }}>
              {/* Default prompts */}
              <div style={{ marginBottom: 16, borderRadius: 6, border: '1px solid #2a2d45', background: '#1a1d2e' }}>
                <div onClick={() => setDefaultsExpanded(!defaultsExpanded)}
                  style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                    {defaultsExpanded ? '▼' : '▶'} 默认 Prompt（所有学科通用）
                  </span>
                </div>
                {defaultsExpanded && (
                  <div style={{ padding: '0 12px 12px' }}>
                    <p style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>
                      这些是系统默认的 AI 提示词。修改后将影响所有未单独配置的学科。
                    </p>
                    {PROMPT_TYPES.map(pt => (
                      <div key={pt.key} style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>{pt.label}</label>
                        <textarea
                          value={defaults[pt.key] || ''}
                          onChange={e => updateDefault(pt.key, e.target.value)}
                          rows={8}
                          style={inputStyle} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Per-subject prompts */}
              <h4 style={{ fontSize: 13, color: '#ccc', marginBottom: 8 }}>学科专属配置</h4>
              <p style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>
                添加学科后会自动填入默认提示词，你只需针对该学科做定制修改。留空则使用默认值。
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubject()}
                  placeholder="添加学科（如：生物、英语、地理）"
                  style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addSubject}
                  style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: '#4285f4', color: '#fff', fontSize: 12, whiteSpace: 'nowrap' }}>
                  + 添加
                </button>
              </div>

              {subjectKeys.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 13 }}>
                  暂无学科配置。添加学科后，可为每个学科定制 AI 提示词。
                </div>
              )}

              {subjectKeys.map(subject => (
                <div key={subject} style={{ marginBottom: 8, borderRadius: 6, border: '1px solid #2a2d45', background: '#1a1d2e' }}>
                  <div onClick={() => setExpanded(expanded === subject ? null : subject)}
                    style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                      {expanded === subject ? '▼' : '▶'} {subject}
                    </span>
                    <button onClick={e => { e.stopPropagation(); removeSubject(subject); }}
                      style={{ padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                        background: '#ea433520', color: '#ea4335', fontSize: 11 }}>
                      删除
                    </button>
                  </div>
                  {expanded === subject && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {PROMPT_TYPES.map(pt => (
                        <div key={pt.key} style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>{pt.label}</label>
                          <textarea
                            value={settings.subjects[subject]?.[pt.key] || ''}
                            onChange={e => updatePrompt(subject, pt.key, e.target.value)}
                            placeholder={defaults[pt.key] || ''}
                            rows={4}
                            style={inputStyle} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button onClick={handleSave} disabled={saving || !dirty}
                style={{ marginTop: 12, padding: '6px 16px', borderRadius: 6, border: 'none', cursor: dirty ? 'pointer' : 'default',
                  background: dirty ? '#34a853' : '#2a2d35', color: dirty ? '#fff' : '#666', fontSize: 12 }}>
                {saving ? '保存中...' : '保存 Prompt 配置'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
