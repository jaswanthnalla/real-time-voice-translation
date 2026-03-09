interface TranscriptEntry {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

export function exportTranscript(entries: TranscriptEntry[], format: 'txt' | 'json'): void {
  let content: string;
  let mimeType: string;

  if (format === 'json') {
    content = JSON.stringify(entries, null, 2);
    mimeType = 'application/json';
  } else {
    content = entries.map((e) =>
      `[${new Date(e.timestamp).toLocaleString()}]\n` +
      `${e.sourceLang.toUpperCase()}: ${e.originalText}\n` +
      `${e.targetLang.toUpperCase()}: ${e.translatedText}\n`
    ).join('\n');
    mimeType = 'text/plain';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcript-${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
