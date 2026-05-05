import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportSinglePageHtml, PRINT_RULES } from '../lib/exportHtml.js';

describe('exportHtml', () => {
  describe('PRINT_RULES', () => {
    it('contains white background rule', () => {
      expect(PRINT_RULES).toContain('background: #fff !important');
    });

    it('contains dark text color', () => {
      expect(PRINT_RULES).toContain('color: #222 !important');
    });

    it('resets webkit text fill color', () => {
      expect(PRINT_RULES).toContain('-webkit-text-fill-color: initial !important');
    });

    it('resets webkit background clip', () => {
      expect(PRINT_RULES).toContain('-webkit-background-clip: initial !important');
    });

    it('styles known classes for print', () => {
      expect(PRINT_RULES).toContain('.badge');
      expect(PRINT_RULES).toContain('.highlight');
      expect(PRINT_RULES).toContain('.card');
      expect(PRINT_RULES).toContain('.hero');
      expect(PRINT_RULES).toContain('.compare-table');
    });
  });

  describe('exportSinglePageHtml', () => {
    let createObjectURLMock;
    let revokeObjectURLMock;
    let clickMock;

    beforeEach(() => {
      createObjectURLMock = vi.fn(() => 'blob:test-url');
      revokeObjectURLMock = vi.fn();
      clickMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return { href: '', download: '', click: clickMock };
        }
        return origCreate(tag);
      });
    });

    it('creates a blob with correct HTML structure', () => {
      exportSinglePageHtml('<p>Test</p>', 'Test Title', 'test.html');
      const blobArg = createObjectURLMock.mock.calls[0][0];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe('text/html');
    });

    it('triggers download with correct filename', () => {
      let capturedEl;
      document.createElement.mockImplementationOnce(() => {
        capturedEl = { href: '', download: '', click: clickMock };
        return capturedEl;
      });
      exportSinglePageHtml('<p>Test</p>', 'Test Title', 'my-export.html');
      expect(capturedEl.download).toBe('my-export.html');
      expect(clickMock).toHaveBeenCalledOnce();
    });

    it('revokes object URL after download', () => {
      exportSinglePageHtml('<p>Test</p>', 'Test Title', 'test.html');
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
    });

    it('includes title in generated HTML', async () => {
      exportSinglePageHtml('<p>Content</p>', 'My Title', 'test.html');
      const blob = createObjectURLMock.mock.calls[0][0];
      const text = await blob.text();
      expect(text).toContain('<title>My Title</title>');
    });

    it('includes body content in generated HTML', async () => {
      exportSinglePageHtml('<div class="card">Hello</div>', 'T', 'test.html');
      const blob = createObjectURLMock.mock.calls[0][0];
      const text = await blob.text();
      expect(text).toContain('<div class="card">Hello</div>');
    });

    it('includes print CSS in generated HTML', async () => {
      exportSinglePageHtml('<p>X</p>', 'T', 'test.html');
      const blob = createObjectURLMock.mock.calls[0][0];
      const text = await blob.text();
      expect(text).toContain('@media print');
      expect(text).toContain('background: #fff !important');
    });
  });
});
