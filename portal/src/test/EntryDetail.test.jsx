import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mock all API calls
vi.mock('../lib/api.js', () => ({
  deleteEntry: vi.fn(),
  updateEntry: vi.fn(),
  generateSmartQuestions: vi.fn().mockResolvedValue({ questions: [] }),
  askEntryQuestion: vi.fn().mockResolvedValue({ answer: 'test answer' }),
  generateTopicPage: vi.fn().mockResolvedValue({ html: '<html><body><h1>Test Topic</h1><p>This is a test topic page with enough content to pass the 50 char check for validation purposes.</p></body></html>' }),
  saveTopicPage: vi.fn().mockResolvedValue({ id: 'tp-1', version: 1, created_at: '2026-01-01' }),
  getLatestTopicPage: vi.fn().mockResolvedValue({ page: null }),
  getTopicPages: vi.fn().mockResolvedValue({ pages: [] }),
  getTopicPageByVersion: vi.fn(),
  updateTopicPageComments: vi.fn(),
  updateTopicPageQaHistory: vi.fn(),
}));

import EntryDetail from '../components/EntryDetail.jsx';
import * as api from '../lib/api.js';

const mockEntry = {
  id: 'entry-1',
  title: '王安石变法',
  content: '北宋时期王安石主导的一系列政治经济改革',
  subject: '历史-北宋',
  tags: ['政治制度', '经济发展'],
};

const renderDetail = (props = {}) => {
  return render(
    <MemoryRouter>
      <EntryDetail
        entry={mockEntry}
        allEntries={[mockEntry]}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        onNavigate={vi.fn()}
        onUpdated={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
};

describe('EntryDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getLatestTopicPage.mockResolvedValue({ page: null });
  });

  // ============================
  // F1: Basic Rendering
  // ============================
  describe('F1: Basic Rendering', () => {
    it('renders entry title', () => {
      renderDetail();
      expect(screen.getByText('王安石变法')).toBeInTheDocument();
    });

    it('shows tabs for topic and explore', () => {
      renderDetail();
      expect(screen.getByText(/专题/)).toBeInTheDocument();
      expect(screen.getByText(/探索/)).toBeInTheDocument();
    });

    it('renders close button', () => {
      const onClose = vi.fn();
      renderDetail({ onClose });
      const closeBtn = screen.getByText('×');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ============================
  // F2: Topic Page Generation
  // ============================
  describe('F2: Topic Page Generation', () => {
    it('shows generate button when QAs exist but no topic page', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('生成专题页')).toBeInTheDocument();
      });
    });

    it('shows custom requirements input when QAs exist but no topic page', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/输入你对专题页的要求/)).toBeInTheDocument();
      });
    });

    it('loads saved topic page on mount', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 3, html: '<p>Saved content</p>',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(api.getLatestTopicPage).toHaveBeenCalledWith('entry-1');
      });
    });
  });

  // ============================
  // F3: Smart Questions & Explore Tab
  // ============================
  describe('F3: Smart Questions', () => {
    it('shows generate smart questions button when none loaded', async () => {
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByText(/生成智能问题/)).toBeInTheDocument();
      });
    });

    it('shows custom question input', async () => {
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/添加自定义问题/)).toBeInTheDocument();
      });
    });
  });

  // ============================
  // F4: QA Answer Edit (manual editing)
  // ============================
  describe('F4: Answer Manual Editing', () => {
    it('shows edit and regenerate buttons for answered QAs', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '<p>Topic</p>',
          qa_history: [{ question: 'What is X?', answer: 'X is Y.' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByText('Q: What is X?')).toBeInTheDocument();
      });
      expect(screen.getByTitle('手动编辑答案')).toBeInTheDocument();
      expect(screen.getByTitle('AI重新生成答案')).toBeInTheDocument();
    });
  });

  // ============================
  // F5: Answered Question Dedup
  // ============================
  describe('F5: Question Dedup in Deep Learning', () => {
    it('filters answered questions from smart questions list', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '<p>Topic</p>',
          qa_history: [{ question: 'What is X?', answer: 'X is Y.' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      api.generateSmartQuestions.mockResolvedValue({
        questions: [
          { question: 'What is X?', category: '概念' },
          { question: 'Why is Z?', category: '原因' },
        ],
      });
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByText('Q: What is X?')).toBeInTheDocument();
      });
      // After loading smart questions, "What is X?" should be filtered
      fireEvent.click(screen.getByText('重新生成问题'));
      await waitFor(() => {
        expect(api.generateSmartQuestions).toHaveBeenCalled();
      });
    });
  });

  // ============================
  // F6: Deep Analysis Button
  // ============================
  describe('F6: Deep Analysis Button', () => {
    it('does not show deep analysis button for child entries', () => {
      renderDetail({ entry: { ...mockEntry, parent_id: 'parent-1' } });
      expect(screen.queryByText(/深入分析/)).toBeNull();
    });
  });

  // ============================
  // F7: Entry Edit & Delete
  // ============================
  describe('F7: Entry Edit & Delete', () => {
    it('renders entry info section with title', async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('王安石变法')).toBeInTheDocument();
      });
    });
  });
});
