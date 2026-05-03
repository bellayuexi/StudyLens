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
