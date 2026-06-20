import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../lib/api.js', () => ({
  getSettings: vi.fn().mockResolvedValue({ subjects: {}, defaultPrompts: {} }),
  saveSettings: vi.fn().mockResolvedValue({ ok: true }),
  getLLMConfig: vi.fn().mockResolvedValue({
    defaultProvider: 'auto',
    providers: {
      'openai-compatible': { enabled: true, baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o' },
    },
    taskRouting: {},
  }),
  saveLLMConfig: vi.fn().mockResolvedValue({ ok: true }),
  testLLMProvider: vi.fn().mockResolvedValue({ ok: true, message: 'Response: OK' }),
}));

import SettingsPanel from '../components/SettingsPanel.jsx';
import * as api from '../lib/api.js';

describe('SettingsPanel — test auto-saves config first', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getLLMConfig.mockResolvedValue({
      defaultProvider: 'auto',
      providers: {
        'openai-compatible': { enabled: true, baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o' },
      },
      taskRouting: {},
    });
    api.saveLLMConfig.mockResolvedValue({ ok: true });
    api.testLLMProvider.mockResolvedValue({ ok: true, message: 'Response: OK' });
  });

  it('saves the freshly-typed API key before testing the provider', async () => {
    render(<SettingsPanel onClose={() => {}} firstRun={true} />);

    // Wait for the API Key field to render (firstRun expands the LLM section)
    const keyInput = await screen.findByDisplayValue('');
    // Type a new API key
    fireEvent.change(
      screen.getAllByDisplayValue('').find(el => el.type === 'password'),
      { target: { value: 'sk-my-new-key' } }
    );

    const testBtn = screen.getByText('测试');
    fireEvent.click(testBtn);

    await waitFor(() => expect(api.testLLMProvider).toHaveBeenCalledWith('openai-compatible'));

    // The config must have been saved BEFORE the test ran, carrying the new key.
    expect(api.saveLLMConfig).toHaveBeenCalled();
    const savedConfig = api.saveLLMConfig.mock.calls[0][0];
    expect(savedConfig.providers['openai-compatible'].apiKey).toBe('sk-my-new-key');

    // Ordering: save resolved before test was invoked.
    const saveOrder = api.saveLLMConfig.mock.invocationCallOrder[0];
    const testOrder = api.testLLMProvider.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(testOrder);
  });

  it('does not re-save when nothing changed', async () => {
    render(<SettingsPanel onClose={() => {}} firstRun={true} />);
    await screen.findByText('测试');

    fireEvent.click(screen.getByText('测试'));

    await waitFor(() => expect(api.testLLMProvider).toHaveBeenCalled());
    // No edits were made, so no save should fire.
    expect(api.saveLLMConfig).not.toHaveBeenCalled();
  });
});
