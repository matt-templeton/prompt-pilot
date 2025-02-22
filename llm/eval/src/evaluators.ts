import { OpenAI } from 'openai';
import type { ApiSurface } from './types';
import type { EvaluationResult } from 'langsmith/evaluation';

interface StructureEvaluation {
  score: number;
  reasoning: string;
  missing_elements: string[];
  extra_elements: string[];
}

/**
 * Evaluates the completeness and accuracy of the API surface extraction
 */
export async function evaluateApiSurfaceCompleteness(
  extracted: ApiSurface,
  expected: ApiSurface,
  openai: OpenAI
): Promise<StructureEvaluation> {
  const prompt = `You are an expert code reviewer evaluating API surface extraction results.
Please analyze the extracted API surface against the expected output and evaluate its completeness and accuracy.

Expected API Surface:
\`\`\`json
${JSON.stringify(expected, null, 2)}
\`\`\`

Extracted API Surface:
\`\`\`json
${JSON.stringify(extracted, null, 2)}
\`\`\`

Please evaluate the following aspects and provide a detailed analysis:
1. Are all expected classes present in the extracted output?
2. Are all methods and their signatures correctly captured?
3. Are all properties with correct types included?
4. Are all function definitions complete and accurate?
5. Are descriptions preserved where they should be?

Provide your response in the following JSON format:
{
  "score": <number between 0 and 1>,
  "reasoning": "<detailed explanation of the score>",
  "missing_elements": ["<list of expected elements that are missing>"],
  "extra_elements": ["<list of extracted elements that shouldn't be there>"]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content || "{}") as StructureEvaluation;
  return result;
}

/**
 * Creates a detailed evaluation result for LangSmith
 */
export async function createDetailedEvaluation(
  outputs: Record<string, unknown> | undefined,
  referenceOutputs: Record<string, unknown> | undefined,
  openai: OpenAI
): Promise<EvaluationResult> {
  const extractedSurface = (outputs?.result || { classes: [], functions: [] }) as ApiSurface;
  const expectedSurface = (referenceOutputs?.expected || { classes: [], functions: [] }) as ApiSurface;

  const evaluation = await evaluateApiSurfaceCompleteness(
    extractedSurface,
    expectedSurface,
    openai
  );

  return {
    key: "api_surface_accuracy",
    score: evaluation.score,
    comment: JSON.stringify({
      reasoning: evaluation.reasoning,
      missing_elements: evaluation.missing_elements,
      extra_elements: evaluation.extra_elements
    })
  };
} 