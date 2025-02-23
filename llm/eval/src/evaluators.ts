import { OpenAI } from 'openai';
// import type { ApiSurface } from './types';

interface StructureEvaluation {
  score: number;
  reasoning: string;
  missing_elements: string[];
  extra_elements: string[];
}

export interface EvaluationResult {
  score: number;
  comment: string;
  type: "score";
  key?: string;
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
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  // Try to find JSON between ```json and ``` markers
  const jsonMatch = response.choices[0].message.content?.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    const result = JSON.parse(jsonMatch[1]);
    console.log(result);
    return result;
  } else {
    throw Error("Unable to parse json from eval result.");
  }
}

/**
 * Creates a detailed evaluation result for LangSmith
 */
export async function createDetailedEvaluation(
  outputs: Record<string, unknown> | undefined,
  referenceOutputs: Record<string, unknown> | undefined,
  openai: OpenAI
): Promise<EvaluationResult> {
  console.log('createDetailedEvaluation called with:');
  console.log('outputs type:', outputs ? typeof outputs : 'undefined');
  console.log('outputs keys:', outputs ? Object.keys(outputs) : []);
  console.log('referenceOutputs type:', referenceOutputs ? typeof referenceOutputs : 'undefined');
  console.log('referenceOutputs keys:', referenceOutputs ? Object.keys(referenceOutputs) : []);

  if (!outputs || !referenceOutputs) {
    console.log('Missing outputs or referenceOutputs, returning error score');
    return {
      score: 0,
      comment: "Missing outputs or reference outputs",
      type: "score"
    };
  }

  // Extract the API surfaces from the outputs
  const extractedSurface = outputs.result;
  const expectedSurface = referenceOutputs.result;

  console.log('Extracted surfaces:');
  console.log('extractedSurface:', extractedSurface ? 'present' : 'missing');
  console.log('expectedSurface:', expectedSurface ? 'present' : 'missing');

  if (!extractedSurface || !expectedSurface) {
    console.log('Invalid output format - missing result field');
    return {
      score: 0,
      comment: "Invalid API surface format",
      type: "score"
    };
  }

  const evaluation = await evaluateApiSurfaceCompleteness(
    extractedSurface,
    expectedSurface,
    openai
  );

  return {
    score: evaluation.score,
    comment: evaluation.reasoning,
    type: "score"
  };
} 