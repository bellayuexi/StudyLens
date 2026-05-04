const { extractJSON } = require('./llm-provider');

describe('extractJSON', () => {
  // Regression: double-escaped regex bug (commit adc4ff5)
  // Previously \s was written as \\s in source, causing regex to look for literal \s chars
  it('strips markdown code fences with whitespace', () => {
    const input = '```json\n[{"title": "Test"}]\n```';
    const result = extractJSON(input, { isArray: true });
    expect(result).toEqual([{ title: 'Test' }]);
  });

  it('strips code fences with varying whitespace', () => {
    const input = '```json  \n{"answer": "hello"}\n```  ';
    const result = extractJSON(input);
    expect(result).toEqual({ answer: 'hello' });
  });

  it('returns null when no JSON found', () => {
    expect(extractJSON('no json here', { isArray: true })).toBeNull();
    expect(extractJSON('just some text')).toBeNull();
  });

  it('parses clean JSON array', () => {
    const result = extractJSON('[{"a": 1}, {"a": 2}]', { isArray: true });
    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('parses clean JSON object', () => {
    const result = extractJSON('{"answer": "hello", "cards": []}');
    expect(result).toEqual({ answer: 'hello', cards: [] });
  });

  it('repairs trailing commas', () => {
    const result = extractJSON('{"a": 1, "b": 2,}');
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('repairs unescaped newlines in string values', () => {
    const input = '{"answer": "line1\nline2", "cards": []}';
    const result = extractJSON(input);
    expect(result).toEqual({ answer: 'line1\nline2', cards: [] });
  });

  // Regression: AI decomposition returning empty (expandEntry)
  it('uses repairKeys fallback when JSON has curly/smart quotes', () => {
    const input = '[{“title”: “Foo”, “content”: “Bar”, “category”: “Baz”}]';
    const result = extractJSON(input, { isArray: true, repairKeys: ['title', 'content', 'category'] });
    expect(result).toEqual([{ title: 'Foo', content: 'Bar', category: 'Baz' }]);
  });

  it('uses repairKeys for question/category pairs', () => {
    const input = '[{“question”: “What is X?”, “category”: “概念”}]';
    const result = extractJSON(input, { isArray: true, repairKeys: ['question', 'category'] });
    expect(result).toEqual([{ question: 'What is X?', category: '概念' }]);
  });

  it('repairs unescaped double quotes inside string values', () => {
    const input = '[{"title": "形成\\"树瘤\\"的原因", "content": "正常"}]';
    const raw = input.replace(/\\"/g, '"').replace(',"', '", "');
    const mangled = '[{"title": "形成"树瘤"的原因", "content": "正常"}]';
    const result = extractJSON(mangled, { isArray: true });
    expect(result).not.toBeNull();
    expect(result[0].title).toContain('树瘤');
    expect(result[0].content).toBe('正常');
  });

  it('repairs multiple unescaped quotes in one string', () => {
    const input = '{"answer": "He said "hello" and she said "bye"", "ok": true}';
    const result = extractJSON(input);
    expect(result).not.toBeNull();
    expect(result.answer).toContain('hello');
    expect(result.ok).toBe(true);
  });

  it('handles already-escaped quotes without double-escaping', () => {
    const input = '{"answer": "He said \\"hello\\"", "ok": true}';
    const result = extractJSON(input);
    expect(result).toEqual({ answer: 'He said "hello"', ok: true });
  });

  it('extracts JSON embedded in surrounding text', () => {
    const input = 'Here is the result:\n[{"id": 1}]\nDone.';
    const result = extractJSON(input, { isArray: true });
    expect(result).toEqual([{ id: 1 }]);
  });

  it('prefers array match when isArray is true', () => {
    const input = '{"wrapper": [{"a": 1}]}';
    const result = extractJSON(input, { isArray: true });
    expect(result).toEqual([{ a: 1 }]);
  });
});
