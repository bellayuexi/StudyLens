import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../lib/api.js';

const PROMPT_TYPES = [
  { key: 'analyzePrompt', label: '知识提取 Prompt' },
  { key: 'topicPrompt', label: '专题页 Prompt' },
  { key: 'qaPrompt', label: '问答 Prompt' },
];

export default function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState({ subjects: {}, defaultPrompts: {} });
  const [saving, setSaving] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const subjectKeys = Object.keys(settings.subjects);
  const defaults = settings.defaultPrompts || {};

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(settings);
    setSaving(false);
  };

  const addSubject = () => {
    const name = newSubject.trim();
    if (!name || settings.subjects[name]) return;
    const subjectDefaults = {};
    for (const pt of PROMPT_TYPES) {
      if (defaults[pt.key]) subjectDefaults[pt.key] = defaults[pt.key];
    }
    setSettings(prev => ({ ...prev, subjects: { ...prev.subjects, [name]: subjectDefaults } }));
    setNewSubject('');
    setExpanded(name);
  };

  const removeSubject = (name) => {
    setSettings(prev => {
      const { [name]: _, ...rest } = prev.subjects;
      return { ...prev, subjects: rest };
    });
    if (expanded === name) setExpanded(null);
  };

  const updatePrompt = (subject, key, value) => {
    setSettings(prev => ({
      ...prev,
      subjects: {
        ...prev.subjects,
        [subject]: { ...prev.subjects[subject], [key]: value },
      },
    }));
  };

  const updateDefault = (key, value) => {
    setSettings(prev => ({
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#34a853', color: '#fff', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={onClose}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #333', cursor: 'pointer',
              background: 'transparent', color: '#aaa', fontSize: 13 }}>
            关闭
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {/* Default prompts */}
        <div style={{ marginBottom: 20, borderRadius: 8, border: '1px solid #2a2d35', background: '#161822' }}>
          <div onClick={() => setDefaultsExpanded(!defaultsExpanded)}
            style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {defaultsExpanded ? '▼' : '▶'} 默认 Prompt（所有学科通用）
            </span>
          </div>
          {defaultsExpanded && (
            <div style={{ padding: '0 14px 14px' }}>
              <p style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>
                这些是系统默认的 AI 提示词。修改后将影响所有未单独配置的学科。
              </p>
              {PROMPT_TYPES.map(pt => (
                <div key={pt.key} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>{pt.label}</label>
                  <textarea
                    value={defaults[pt.key] || ''}
                    onChange={e => updateDefault(pt.key, e.target.value)}
                    rows={4}
                    style={inputStyle} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-subject prompts */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, color: '#ccc', marginBottom: 8 }}>学科专属配置</h3>
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
            <div key={subject} style={{ marginBottom: 8, borderRadius: 8, border: '1px solid #2a2d35', background: '#161822' }}>
              <div onClick={() => setExpanded(expanded === subject ? null : subject)}
                style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#ddd' }}>
                  {expanded === subject ? '▼' : '▶'} {subject}
                </span>
                <button onClick={e => { e.stopPropagation(); removeSubject(subject); }}
                  style={{ padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: '#ea433520', color: '#ea4335', fontSize: 11 }}>
                  删除
                </button>
              </div>
              {expanded === subject && (
                <div style={{ padding: '0 14px 14px' }}>
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
        </div>
      </div>
    </div>
  );
}
