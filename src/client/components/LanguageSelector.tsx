import React from 'react';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';

const LANG_FLAGS: Record<string, string> = {
  en: '\uD83C\uDDFA\uD83C\uDDF8',
  es: '\uD83C\uDDEA\uD83C\uDDF8',
  fr: '\uD83C\uDDEB\uD83C\uDDF7',
  de: '\uD83C\uDDE9\uD83C\uDDEA',
  it: '\uD83C\uDDEE\uD83C\uDDF9',
  pt: '\uD83C\uDDE7\uD83C\uDDF7',
  ru: '\uD83C\uDDF7\uD83C\uDDFA',
  zh: '\uD83C\uDDE8\uD83C\uDDF3',
  ja: '\uD83C\uDDEF\uD83C\uDDF5',
  ko: '\uD83C\uDDF0\uD83C\uDDF7',
  ar: '\uD83C\uDDF8\uD83C\uDDE6',
  hi: '\uD83C\uDDEE\uD83C\uDDF3',
  te: '\uD83C\uDDEE\uD83C\uDDF3',
  ta: '\uD83C\uDDEE\uD83C\uDDF3',
  kn: '\uD83C\uDDEE\uD83C\uDDF3',
  ml: '\uD83C\uDDEE\uD83C\uDDF3',
  bn: '\uD83C\uDDEE\uD83C\uDDF3',
  mr: '\uD83C\uDDEE\uD83C\uDDF3',
  gu: '\uD83C\uDDEE\uD83C\uDDF3',
  pa: '\uD83C\uDDEE\uD83C\uDDF3',
  ur: '\uD83C\uDDF5\uD83C\uDDF0',
  th: '\uD83C\uDDF9\uD83C\uDDED',
  vi: '\uD83C\uDDFB\uD83C\uDDF3',
  tr: '\uD83C\uDDF9\uD83C\uDDF7',
  nl: '\uD83C\uDDF3\uD83C\uDDF1',
  pl: '\uD83C\uDDF5\uD83C\uDDF1',
  sv: '\uD83C\uDDF8\uD83C\uDDEA',
  id: '\uD83C\uDDEE\uD83C\uDDE9',
  ms: '\uD83C\uDDF2\uD83C\uDDFE',
};

interface Props {
  sourceLang: string;
  targetLang: string;
  onSourceChange: (lang: string) => void;
  onTargetChange: (lang: string) => void;
  disabled: boolean;
}

export const LanguageSelector: React.FC<Props> = ({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  disabled,
}) => {
  const languages = Object.entries(SUPPORTED_LANGUAGES);

  const handleSwap = () => {
    onSourceChange(targetLang);
    onTargetChange(sourceLang);
  };

  return (
    <div className="language-selector">
      <div className="lang-select">
        <label htmlFor="source-lang">Speaking</label>
        <div className="select-wrapper">
          <span className="select-flag">{LANG_FLAGS[sourceLang] || ''}</span>
          <select
            id="source-lang"
            value={sourceLang}
            onChange={(e) => onSourceChange(e.target.value)}
            disabled={disabled}
          >
            {languages.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="swap-btn"
        onClick={handleSwap}
        disabled={disabled}
        aria-label="Swap languages"
        title="Swap languages"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </button>

      <div className="lang-select">
        <label htmlFor="target-lang">Translating to</label>
        <div className="select-wrapper">
          <span className="select-flag">{LANG_FLAGS[targetLang] || ''}</span>
          <select
            id="target-lang"
            value={targetLang}
            onChange={(e) => onTargetChange(e.target.value)}
            disabled={disabled}
          >
            {languages.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
