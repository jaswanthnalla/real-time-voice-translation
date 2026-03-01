export interface DeepgramStreamConfig {
  model: string;
  language?: string;
  detectLanguage: boolean;
  punctuate: boolean;
  interimResults: boolean;
  utteranceEndMs: number;
  encoding: string;
  sampleRate: number;
  channels: number;
  smartFormat: boolean;
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuatedWord?: string;
}

export interface DeepgramTranscript {
  text: string;
  isFinal: boolean;
  confidence: number;
  words: DeepgramWord[];
  speechFinal: boolean;
}

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  timestamp: number;
}

export interface DeepgramStreamEvents {
  transcript: (transcript: DeepgramTranscript) => void;
  languageDetected: (result: LanguageDetectionResult) => void;
  error: (error: Error) => void;
  close: () => void;
}
