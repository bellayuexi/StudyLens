export function buildHistory(messages) {
  const hist = [];
  for (let i = 0; i < messages.length; i += 2) {
    const q = messages[i];
    const a = messages[i + 1];
    if (q && a) hist.push({ question: q.text, answer: a.text, suggestedCards: a.cards || [] });
  }
  return hist;
}
