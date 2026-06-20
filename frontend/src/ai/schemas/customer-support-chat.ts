import { z } from 'genkit';

export const CustomerSupportChatInputSchema = z.object({
  question: z.string().describe("The user's question about the Profs Training Solutions platform."),
});
export type CustomerSupportChatInput = z.infer<
  typeof CustomerSupportChatInputSchema
>;

export const CustomerSupportChatOutputSchema = z.object({
  answer: z.string().describe("The AI support agent's helpful answer."),
});
export type CustomerSupportChatOutput = z.infer<
  typeof CustomerSupportChatOutputSchema
>;
