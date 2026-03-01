export class LatencyTimer {
  private timers: Map<string, number> = new Map();
  private results: Map<string, number> = new Map();

  start(label: string): void {
    this.timers.set(label, performance.now());
  }

  stop(label: string): number {
    const startTime = this.timers.get(label);
    if (startTime === undefined) return 0;

    const elapsed = performance.now() - startTime;
    this.results.set(label, elapsed);
    this.timers.delete(label);
    return elapsed;
  }

  getElapsed(label: string): number {
    return this.results.get(label) ?? 0;
  }

  getReport(): Record<string, number> {
    const report: Record<string, number> = {};
    for (const [label, value] of this.results) {
      report[label] = Math.round(value * 100) / 100;
    }
    return report;
  }

  getTotalMs(): number {
    let total = 0;
    for (const value of this.results.values()) {
      total += value;
    }
    return Math.round(total * 100) / 100;
  }

  reset(): void {
    this.timers.clear();
    this.results.clear();
  }
}
