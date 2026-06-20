import { z } from 'genkit';

export const FinancialAnalysisInputSchema = z.object({
  historicalData: z.array(z.object({
    month: z.string(),
    revenue: z.number(),
  })).describe("The last 6 months of actual revenue data."),
  projectedData: z.array(z.object({
    month: z.string(),
    projected: z.number(),
  })).describe("The next 3 months of projected revenue data."),
});
export type FinancialAnalysisInput = z.infer<typeof FinancialAnalysisInputSchema>;

export const FinancialAnalysisOutputSchema = z.object({
  analysis: z.string().describe("A professional CFO-level analysis of the revenue trends."),
  recommendations: z.array(z.string()).describe("3-5 actionable business recommendations to improve revenue."),
  growthOutlook: z.enum(['Bullish', 'Neutral', 'Bearish']).describe("The overall market sentiment for the platform."),
});
export type FinancialAnalysisOutput = z.infer<typeof FinancialAnalysisOutputSchema>;
