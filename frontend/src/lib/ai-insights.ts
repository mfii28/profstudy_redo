/**
 * @fileOverview AI-powered insights generation using Genkit + Google Gemini 2.5 Flash.
 * Generates natural language summaries of analytics patterns and course insights.
 */

import { ai } from '@/ai/genkit';

interface AIInsightRequest {
  type: 'dashboard' | 'course';
  data: Record<string, unknown>;
}

interface AIInsightResponse {
  insight: string;
  tokensUsed: number;
  premium: boolean;
}

export interface DashboardInsightData {
  totalRevenue: number;
  activeStudents: number;
  atRiskStudents: number;
  inactiveStudents: number;
  nextMonthPrediction: number;
  averageEngagementScore: number;
}

export interface CourseInsightData {
  courseTitle: string;
  totalEnrollments: number;
  completionRate: number;
  avgStudentRating: number;
  performanceScore: number;
  lowestEngagementStudents: Array<{ name: string; engagement: number }>;
}

/**
 * Generate dashboard-level insights from analytics data.
 * Summarizes teaching performance, student engagement, and revenue trends.
 */
export async function generateDashboardInsight(
  data: DashboardInsightData
): Promise<AIInsightResponse> {
  const prompt = `You are an educational analytics expert. Analyze this tutor's dashboard data and provide 2-3 specific, actionable insights in 150 words or less.

Dashboard Data:
- Total Revenue: GH₵${data.totalRevenue.toLocaleString()}
- Active Students: ${data.activeStudents}
- At-Risk Students: ${data.atRiskStudents}
- Inactive Students: ${data.inactiveStudents}
- Next Month Revenue Prediction: GH₵${data.nextMonthPrediction.toLocaleString()}
- Average Engagement Score: ${data.averageEngagementScore}/100

Focus on:
1. Student engagement health
2. Revenue opportunities
3. Retention strategies

Be encouraging but honest about areas needing attention. Use specific numbers from the data.`;

  try {
    const result = await ai.generate({
      prompt,
      model: 'googleai/gemini-2.5-flash',
    });

    const insight = result.text || '';

    // Calculate token usage (approximate: ~4 chars per token)
    const tokensUsed = Math.ceil((prompt.length + insight.length) / 4);

    return {
      insight,
      tokensUsed,
      premium: true,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('API key')) {
      // Return graceful fallback for missing API key
      return {
        insight: 'AI insights are temporarily unavailable. Please configure your Google API key to enable AI-powered analytics insights.',
        tokensUsed: 0,
        premium: false,
      };
    }
    throw error;
  }
}

/**
 * Generate course-specific insights from course analytics data.
 * Focuses on student success, content effectiveness, and improvement areas.
 */
export async function generateCourseInsight(
  data: CourseInsightData
): Promise<AIInsightResponse> {
  const lowestEngagementStr = data.lowestEngagementStudents
    .map(s => `${s.name} (score: ${s.engagement})`)
    .join(', ');

  const prompt = `You are an educational specialist. Analyze this course's performance and provide 2-3 specific, actionable recommendations in 150 words or less.

Course: ${data.courseTitle}
- Enrollments: ${data.totalEnrollments}
- Completion Rate: ${data.completionRate}%
- Student Rating: ${data.avgStudentRating}/5
- Performance Score: ${data.performanceScore}/100
- Lowest Engagement Students: ${lowestEngagementStr || 'None'}

Focus on:
1. Content improvement opportunities (based on ratings/performance)
2. Student support strategies (especially for low-engagement students)
3. Course positioning/marketing adjustments

Be specific and suggest concrete actions the tutor can take immediately.`;

  try {
    const result = await ai.generate({
      prompt,
      model: 'googleai/gemini-2.5-flash',
    });

    const insight = result.text || '';

    // Calculate token usage (approximate: ~4 chars per token)
    const tokensUsed = Math.ceil((prompt.length + insight.length) / 4);

    return {
      insight,
      tokensUsed,
      premium: true,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('API key')) {
      // Return graceful fallback for missing API key
      return {
        insight: 'AI insights are temporarily unavailable. Please configure your Google API key to enable course-specific AI insights.',
        tokensUsed: 0,
        premium: false,
      };
    }
    throw error;
  }
}

/**
 * Check if user has exceeded token quota for the month.
 * Premium users get 1M tokens/month; free users get 100k tokens/month.
 *
 * In production, this would track user token usage in Firestore.
 */
export function checkTokenQuota(
  tokensUsed: number,
  isPremium: boolean,
  monthlyUsedTokens: number
): {
  allowed: boolean;
  remaining: number;
  message?: string;
} {
  const monthlyLimit = 1000000;
  const remaining = monthlyLimit - (monthlyUsedTokens + tokensUsed);

  if (remaining < 0) {
    return {
      allowed: false,
      remaining: 0,
      message: 'Monthly AI token quota exceeded. Please try again next cycle.',
    };
  }

  return {
    allowed: true,
    remaining,
  };
}

/**
 * Log AI usage for analytics and token tracking.
 * In production, would write to Firestore for quota enforcement.
 */
export async function logAIUsage(
  tutorId: string,
  type: 'dashboard' | 'course',
  tokensUsed: number,
  isPremium: boolean
): Promise<void> {
  // In production, write to Firestore aiUsage collection:
  // db.collection('tutors').doc(tutorId).collection('aiUsage').add({
  //   type,
  //   tokensUsed,
  //   timestamp: new Date(),
  //   isPremium,
  // })
}
