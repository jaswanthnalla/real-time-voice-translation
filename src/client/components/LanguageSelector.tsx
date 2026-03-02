import React from 'react';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';

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
        <label htmlFor="source-lang">From</label>
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

      <button
        className="swap-btn"
        onClick={handleSwap}
        disabled={disabled}
        aria-label="Swap languages"
      >
        &#8596;
      </button>

      <div className="lang-select">
        <label htmlFor="target-lang">To</label>
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
  );
};
