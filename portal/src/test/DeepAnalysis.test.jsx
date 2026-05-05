import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/exportHtml.js', () => ({
  exportSinglePageHtml: vi.fn(),
  PRINT_RULES: 'mock-print-rules',
}));

vi.mock('../lib/api.js', () => ({
  getChildren: vi.fn().mockResolvedValue({ children: [] }),
  expandEntry: vi.fn().mockResolvedValue({ children: [] }),
  addChildEntry: vi.fn().mockResolvedValue({ id: 'child-1', title: 'New Child', content: 'content', tags: [] }),
  deleteEntry: vi.fn(),
  updateEntry: vi.fn(),
  getLatestTopicPage: vi.fn().mockResolvedValue({ page: null }),
  generateTopicPage: vi.fn().mockResolvedValue({ html: '<html><body>Topic</body></html>' }),
  saveTopicPage: vi.fn().mockResolvedValue({ id: 'tp-1', version: 1, created_at: '2026-01-01' }),
  getTopicPages: vi.fn().mockResolvedValue({ pages: [] }),
  getTopicPageByVersion: vi.fn(),
  updateTopicPageComments: vi.fn(),
  updateTopicPageQaHistory: vi.fn(),
  generateSmartQuestions: vi.fn().mockResolvedValue({ questions: [] }),
  askEntryQuestion: vi.fn(),
}));

import DeepAnalysis from '../components/DeepAnalysis.jsx';
import * as api from '../lib/api.js';

const mockParent = {
  id: 'parent-1',
  title: '王安石变法',
  content: '北宋改革',
  subject: '历史',
  tags: ['政治'],
};

const mockChildren = [
  { id: 'c1', title: '青苗法', content: '农业贷款制度', tags: ['内容-经济'] },
  { id: 'c2', title: '募役法', content: '以钱代役', tags: ['内容-制度'] },
  { id: 'c3', title: '反对派', content: '司马光等反对', tags: ['评价-争议'] },
];

const renderDeepAnalysis = (parentEntry = mockParent, children = mockChildren) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(parentEntry),
  });
  api.getChildren.mockResolvedValue({ children });

  return render(
    <MemoryRouter initialEntries={[`/deep/${parentEntry.id}`]}>
      <Routes>
        <Route path="/deep/:entryId" element={<DeepAnalysis />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('DeepAnalysis Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('shows parent title and child count', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/3 个子节点/)).toBeInTheDocument();
      });
    });

    it('renders children in sidebar', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText('青苗法')).toBeInTheDocument();
      });
      expect(screen.getByText('募役法')).toBeInTheDocument();
      expect(screen.getByText('反对派')).toBeInTheDocument();
    });

    it('shows overview entry in sidebar', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/综述: 王安石变法/)).toBeInTheDocument();
      });
    });
  });

  describe('Overview with Topic Navigation (F2)', () => {
    it('shows child navigation bar when overview has topic HTML', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: { html: '<html><body><h1>Overview</h1></body></html>', version: 1 },
      });
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText('子主题导航')).toBeInTheDocument();
      });
    });

    it('shows update summary button when children exist', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/用子节点内容更新综述/)).toBeInTheDocument();
      });
    });

    it('shows empty state prompt when no children', async () => {
      renderDeepAnalysis(mockParent, []);
      await waitFor(() => {
        expect(screen.getByText(/暂无子节点/)).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('shows AI expand and manual add buttons', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/AI自动拆解/)).toBeInTheDocument();
      });
      expect(screen.getByText(/手动添加/)).toBeInTheDocument();
    });

    it('toggles add child form', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/手动添加/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/手动添加/));
      expect(screen.getByPlaceholderText('子知识点标题')).toBeInTheDocument();
    });

    it('shows back to home link', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/返回主页/)).toBeInTheDocument();
      });
    });
  });

  describe('Export', () => {
    it('shows both export buttons when summary page exists', async () => {
      api.getLatestTopicPage.mockResolvedValue({
        page: { html: '<html><body><h1>Overview</h1></body></html>', version: 1 },
      });
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/导出当前页面/)).toBeInTheDocument();
      });
      expect(screen.getByText(/导出整体/)).toBeInTheDocument();
    });

    it('shows export full button even without summary page', async () => {
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/导出整体/)).toBeInTheDocument();
      });
    });

    it('calls exportSinglePageHtml when export current page clicked', async () => {
      const { exportSinglePageHtml } = await import('../lib/exportHtml.js');
      api.getLatestTopicPage.mockResolvedValue({
        page: { html: '<html><body><h1>Overview</h1></body></html>', version: 1 },
      });
      renderDeepAnalysis();
      await waitFor(() => {
        expect(screen.getByText(/导出当前页面/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/导出当前页面/));
      expect(exportSinglePageHtml).toHaveBeenCalledWith(
        '<html><body><h1>Overview</h1></body></html>',
        '王安石变法 - 综述',
        '王安石变法_综述.html'
      );
    });
  });
});
