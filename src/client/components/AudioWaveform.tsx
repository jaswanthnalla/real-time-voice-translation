import React, { useRef, useEffect } from 'react';

interface Props {
  isActive: boolean;
  barCount?: number;
}

export const AudioWaveform: React.FC<Props> = ({ isActive, barCount = 5 }) => {
  const barsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !barsRef.current) return;

    const bars = barsRef.current.children;
    const intervals: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i] as HTMLDivElement;
      const animate = () => {
        const height = isActive ? 8 + Math.random() * 24 : 4;
        bar.style.height = `${height}px`;
      };
      animate();
      intervals.push(window.setInterval(animate, 120 + i * 30));
    }

    return () => intervals.forEach(clearInterval);
  }, [isActive]);

  return (
    <div className="audio-waveform" ref={barsRef}>
      {Array.from({ length: barCount }, (_, i) => (
        <div
          key={i}
          className={`wave-bar ${isActive ? 'active' : ''}`}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
};
