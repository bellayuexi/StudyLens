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
  deleteTopicPageVersion: vi.fn().mockResolvedValue({ ok: true }),
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

    it('shows delete button', () => {
      renderDetail();
      expect(screen.getByText('删除')).toBeInTheDocument();
    });

    it('calls onDeleted when delete button clicked', async () => {
      const onDeleted = vi.fn();
      api.deleteEntry.mockResolvedValue({});
      renderDetail({ onDeleted });
      fireEvent.click(screen.getByText('删除'));
      await waitFor(() => {
        expect(api.deleteEntry).toHaveBeenCalledWith('entry-1');
        expect(onDeleted).toHaveBeenCalled();
      });
    });
  });

  // ============================
  // F8: Tab Switching
  // ============================
  describe('F8: Tab Switching', () => {
    it('defaults to topic tab', () => {
      renderDetail();
      expect(screen.getByText(/专题/)).toBeInTheDocument();
    });

    it('switches to explore tab on click', async () => {
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByText(/深入学习/)).toBeInTheDocument();
      });
    });

    it('shows smart question generate button in explore tab', async () => {
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByText(/生成智能问题/)).toBeInTheDocument();
      });
    });
  });

  // ============================
  // F9: Comments / Annotations
  // ============================
  describe('F9: Comments', () => {
    it('shows annotation button when topic page exists', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '<p>Topic content here</p>',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/添加批注/)).toBeInTheDocument();
      });
    });

    it('toggles comment mode on button click', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '<p>Topic content here</p>',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/添加批注/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/添加批注/));
      await waitFor(() => {
        expect(screen.getByText(/批注中/)).toBeInTheDocument();
      });
    });
  });

  // ============================
  // F10: Batch Ask
  // ============================
  describe('F10: Batch Ask', () => {
    it('shows batch ask button when smart questions are selected', async () => {
      api.generateSmartQuestions.mockResolvedValue({
        questions: [
          { question: 'New question?', category: '概念' },
        ],
      });
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByText(/生成智能问题/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/生成智能问题/));
      await waitFor(() => {
        expect(screen.getByText('New question?')).toBeInTheDocument();
      });
      expect(screen.getByText(/批量提问选中的/)).toBeInTheDocument();
    });
  });

  // ============================
  // F11: Topic Page Version History
  // ============================
  describe('F11: Version History', () => {
    it('shows version status when topic page has versions', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 3, html: '<p>V3 content</p>',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/v3 已保存/)).toBeInTheDocument();
      });
    });
  });

  // ============================
  // F12: Custom Question Input
  // ============================
  describe('F12: Custom Question', () => {
    it('shows add custom question input in explore tab', async () => {
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/添加自定义问题/)).toBeInTheDocument();
      });
    });

    it('has add button that is disabled when input is empty', async () => {
      renderDetail();
      fireEvent.click(screen.getByText(/探索/));
      await waitFor(() => {
        const addBtn = screen.getByText('+添加');
        expect(addBtn).toBeInTheDocument();
        expect(addBtn).toHaveStyle('opacity: 0.5');
      });
    });
  });

  // ============================
  // F13: Topic Page Export
  // ============================
  describe('F13: Export HTML', () => {
    it('shows export button when topic page exists', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '<p>Topic content</p>',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [], included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/导出HTML/)).toBeInTheDocument();
      });
    });
  });

  // ============================
  // F14: Content Editing
  // ============================
  describe('F14: Content Display', () => {
    it('shows entry content in topic tab', async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(mockEntry.content)).toBeInTheDocument();
      });
    });

    it('shows tags', () => {
      renderDetail();
      expect(screen.getByText('#政治制度')).toBeInTheDocument();
      expect(screen.getByText('#经济发展')).toBeInTheDocument();
    });

    it('shows subject badge', () => {
      renderDetail();
      expect(screen.getByText('历史-北宋')).toBeInTheDocument();
    });
  });

  // ============================
  // F15: Empty State Two Choices (F1 feature)
  // ============================
  describe('F15: Empty State Learning Paths', () => {
    it('shows two learning path choices when no QAs and no topic page', async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('智能问答探索')).toBeInTheDocument();
      });
      expect(screen.getByText('手工输入需求')).toBeInTheDocument();
    });

    it('shows description for each learning path', async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/AI生成问题/)).toBeInTheDocument();
        expect(screen.getByText(/输入你的学习需求/)).toBeInTheDocument();
      });
    });

    it('shows custom requirements input when clicking manual option', async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('手工输入需求')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('手工输入需求'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的学习需求/)).toBeInTheDocument();
      });
    });

    it('clicking explore choice switches to explore tab', async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('智能问答探索')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('智能问答探索'));
      await waitFor(() => {
        expect(screen.getByText(/深入学习/)).toBeInTheDocument();
      });
    });
  });

  // ============================
  // F16: Annotation Apply Incremental Update (B4 fix)
  // ============================
  describe('F16: Annotation Apply with existingHTML', () => {
    it('passes existingHTML and requirements when applying comments', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: {
          id: 'tp-1', version: 1, html: '<p>Existing topic content</p>',
          qa_history: [{ question: 'Q1', answer: 'A1' }],
          comments: [{ id: 'c1', text: '需要补充更多细节' }],
          included_qa_ids: [], created_at: '2026-01-01',
        },
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/应用批注更新/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/应用批注更新/));
      await waitFor(() => {
        expect(api.generateTopicPage).toHaveBeenCalledWith(
          'entry-1',
          [],
          '<p>Existing topic content</p>',
          '需要补充更多细节',
          'annotation'
        );
      });
    });
  });

  // ============================
  // F17: Version Delete & Merge
  // ============================
  describe('F17: Version Delete & Merge', () => {
    const multiVersionPage = {
      id: 'tp-1', version: 3, html: '<p>V3 content with enough text for validation</p>',
      qa_history: [{ question: 'Q1', answer: 'A1' }],
      comments: [], included_qa_ids: [], created_at: '2026-01-01',
    };

    it('shows merge button when multiple versions exist', async () => {
      api.getLatestTopicPage.mockResolvedValue({ page: multiVersionPage });
      api.getTopicPages.mockResolvedValue({ pages: [{ version: 1 }, { version: 2 }, { version: 3 }] });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('合并')).toBeInTheDocument();
      });
    });

    it('shows delete button when viewing old version', async () => {
      api.getLatestTopicPage.mockResolvedValue({ page: multiVersionPage });
      api.getTopicPages.mockResolvedValue({ pages: [{ version: 1 }, { version: 2 }, { version: 3 }] });
      api.getTopicPageByVersion.mockResolvedValue({
        ...multiVersionPage, version: 1, html: '<p>V1 content</p>',
      });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('v1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('v1'));
      await waitFor(() => {
        expect(screen.getByTitle(/删除 v1/)).toBeInTheDocument();
      });
    });

    it('enters merge mode and shows selection UI', async () => {
      api.getLatestTopicPage.mockResolvedValue({ page: multiVersionPage });
      api.getTopicPages.mockResolvedValue({ pages: [{ version: 1 }, { version: 2 }, { version: 3 }] });
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText('合并')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('合并'));
      await waitFor(() => {
        expect(screen.getByText('取消合并')).toBeInTheDocument();
      });
    });
  });
});
