'use server';
/**
 * @fileOverview AI Financial Analysis Flow.
 *
 * - analyzeFinancials - Analyzes historical and projected revenue to provide CFO-level insights.
 */

import { ai } from '@/ai/genkit';
import {
  FinancialAnalysisInputSchema,
  type FinancialAnalysisInput,
  FinancialAnalysisOutputSchema,
  type FinancialAnalysisOutput,
} from '@/ai/schemas/financial-analysis';

export async function analyzeFinancials(
  input: FinancialAnalysisInput
): Promise<FinancialAnalysisOutput> {
  return analyzeFinancialsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialAnalysisPrompt',
  input: { schema: FinancialAnalysisInputSchema },
  output: { schema: FinancialAnalysisOutputSchema },
prompt: `You are a world-class CFO and business analyst for Profs Training Solutions, a leading professional EdTech platform in Ghana.

Analyze the provided revenue data and generate a high-level strategic report.

### CONTEXT:
Profs Training Solutions sells professional courses (ICAG, CITG), study materials (Textbooks), and AI Premium subscriptions (GH₵25/month).

### REVENUE DATA:
- HISTORICAL (Actuals):
{{#each historicalData}}
  - {{month}}: GH₵{{revenue}}
{{/each}}

- PROJECTED (Trend-based):
{{#each projectedData}}
  - {{month}}: GH₵{{projected}} (Projected)
{{/each}}

### YOUR TASK:
1. Provide a concise, professional analysis of the trends (e.g., identifying seasonal dips or growth spurts).
2. Offer exactly 3-5 actionable business recommendations to maximize ROI or user retention.
3. Set the growth outlook based on the data slope.

Maintain a tone that is authoritative yet encouraging for the platform owners.`,
});

const analyzeFinancialsFlow = ai.defineFlow(
  {
    name: 'analyzeFinancialsFlow',
    inputSchema: FinancialAnalysisInputSchema,
    outputSchema: FinancialAnalysisOutputSchema,
  },
  async (input: FinancialAnalysisInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);
