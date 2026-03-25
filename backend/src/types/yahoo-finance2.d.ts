declare module 'yahoo-finance2' {
  export interface Quote {
    date: Date;
    open?: number | null;
    high?: number | null;
    low?: number | null;
    close?: number | null;
    volume?: number | null;
  }

  export interface ChartResult {
    quotes: Quote[];
  }

  const yahooFinance: {
    chart(
      symbol: string,
      options: { interval: string; range: string }
    ): Promise<ChartResult>;
  };

  export default yahooFinance;
}
