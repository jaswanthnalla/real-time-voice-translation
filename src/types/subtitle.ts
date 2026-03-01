export interface SubtitleEntry {
  id: string;
  originalText: string;
  translatedText: string;
  speakerId: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  isFinal: boolean;
}

export interface SubtitleState {
  entries: SubtitleEntry[];
  isVisible: boolean;
  maxEntries: number;
}
