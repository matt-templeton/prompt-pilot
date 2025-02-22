import dotenv from 'dotenv';
import { DatasetManager } from './dataset';
import OpenAI from 'openai';
import path from 'path';
import { evaluate } from 'langsmith/evaluation';
import type { EvaluationResult } from 'langsmith/evaluation';
import type { ApiSurface } from './types';
import { loadPrompt } from './prompt-loader';
import minimist from 'minimist';
import { parse as parseYaml } from 'yaml';
import { createDetailedEvaluation } from './evaluators';

dotenv.config();

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const promptName = argv.prompt || 'surface';

// Ensure required environment variables are set
const requiredEnvVars = [
  'LANGSMITH_API_KEY',
  'OPENAI_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Load prompt from file
const prompt = loadPrompt(promptName);

// Initialize OpenAI client for the extraction function
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Helper function to extract structured data (JSON or YAML) from a string that may contain markdown or other formatting
 */
function extractStructuredData(content: string): ApiSurface {
  // Try to find YAML between ```yaml and ``` markers
  const yamlMatch = content.match(/```yaml\s*([\s\S]*?)\s*```/);

  if (yamlMatch) {
    try {
      const y = parseYaml(yamlMatch[1]);
      // console.log(y);
      return y;
    } catch (error) {
      console.error("Failed to parse response as YAML:", error);
    }
  }

  // Try to find JSON between ```json and ``` markers
  const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
      console.error("Failed to parse response as JSON:", error);
    }
  }

  // Try to find any JSON-like structure
  const anyJsonMatch = content.match(/(\{[\s\S]*\})/);
  if (anyJsonMatch) {
    try {
      return JSON.parse(anyJsonMatch[1]);
    } catch (error) {
      console.error("Failed to parse response as raw JSON:", error);
    }
  }

  // Try to parse the entire content as YAML as a last resort
  try {
    return parseYaml(content);
  } catch (error) {
    console.error("Failed to parse entire response as YAML:", error);
    return { classes: [], functions: [] };
  }
}

/**
 * Function to extract API surface from code
 */
async function extractApiSurface(input: { content: string; language: string }) {
  // Construct the prompt with clear separation between example and code to analyze
  const fullPrompt = `${prompt.user}

NOW, PLEASE ANALYZE THE FOLLOWING CODE:
\`\`\`${input.language}
${input.content}
\`\`\`

Please analyze the code above and provide its API surface in the same format as shown in the example. Do not repeat the example output - analyze the new code provided.`;

  console.log("Sending to OpenAI:");
  console.log("Language:", input.language);
  console.log("Code length:", input.content.length);
  console.log("First 100 chars of code:", input.content.slice(0, 100));

  console.log("SENDING DA WHOLE PROMPTTTTT>....");
  console.log(fullPrompt);
  console.log('ok');

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "user", content: fullPrompt }
    ],
    temperature: 0
  });

  const responseContent = response.choices[0].message.content || "{}";
  console.log("\nReceived from OpenAI:");
  console.log("Response length:", responseContent.length);
  console.log("First 100 chars of response:", responseContent.slice(0, 100));

  return {
    result: extractStructuredData(responseContent)
  };
}

/**
 * Evaluator function that compares extracted API surface with reference
 */
async function apiSurfaceAccuracy({
  outputs,
  referenceOutputs,
}: {
  outputs?: Record<string, unknown>;
  referenceOutputs?: Record<string, unknown>;
}): Promise<EvaluationResult> {
  return createDetailedEvaluation(outputs, referenceOutputs, openai);
}

async function main() {
  try {
    const DATASET_NAME = 'API Surface Extraction Dataset';
    
    // Initialize dataset manager
    const datasetManager = new DatasetManager(process.env.LANGSMITH_API_KEY!, path.join(__dirname, '..', 'datasets'));
    
    // Create or get existing dataset in LangSmith
    console.log('Setting up LangSmith dataset...');
    const datasetId = await datasetManager.createLangSmithDataset(
      DATASET_NAME,
      'Dataset for evaluating API surface extraction across different programming languages'
    );
    console.log(`Using dataset with ID: ${datasetId}`);

    // Run the evaluation experiment
    console.log('Running evaluation experiment...');
    await evaluate(
      (example) => extractApiSurface(example),
      {
        data: datasetId,
        evaluators: [apiSurfaceAccuracy],
        experimentPrefix: "api-surface-extraction",
        maxConcurrency: 2
      }
    );
    console.log('Evaluation complete. Check LangSmith for results.');

  } catch (error) {
    console.error('Error running evaluation:', error);
    process.exit(1);
  }
}

main(); 