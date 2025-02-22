import dotenv from 'dotenv';
import { DatasetManager } from './dataset';
import { ApiSurfaceEvaluator } from './evaluator';
import OpenAI from 'openai';
import path from 'path';

dotenv.config();

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

// Initialize OpenAI client for the extraction function
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Function to extract API surface from code
 */
async function extractApiSurface(input: { content: string; language: string }) {
  const systemPrompt = `
    You are an expert code analyzer. Your task is to extract the API surface from the provided code.
    The API surface should include:
    - All classes with their methods and properties
    - All standalone functions
    - Accurate type information
    - Documentation comments
    Return ONLY a JSON object with the following structure:
    {
      "classes": [...],
      "functions": [...]
    }
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Language: ${input.language}\n\nCode:\n${input.content}` }
    ],
    temperature: 0
  });

  try {
    return {
      result: JSON.parse(response.choices[0].message.content || "{}")
    };
  } catch (error) {
    console.error("Failed to parse OpenAI response as JSON:", error);
    return {
      result: { classes: [], functions: [] }
    };
  }
}

async function main() {
  try {
    // Initialize managers
    const datasetManager = new DatasetManager(process.env.LANGSMITH_API_KEY!, path.join(__dirname, '..', 'datasets'));
    const dataset = await datasetManager.loadGoldenDataset();
    const evaluator = new ApiSurfaceEvaluator(process.env.OPENAI_API_KEY!, dataset);

    // Create dataset in LangSmith
    console.log('Creating dataset in LangSmith...');
    const datasetId = await datasetManager.createLangSmithDataset(
      'API Surface Extraction Dataset',
      'Dataset for evaluating API surface extraction across different programming languages'
    );
    console.log(`Dataset created with ID: ${datasetId}`);

    // Run the evaluation experiment
    console.log('Running evaluation experiment...');
    await evaluator.runExperiment(extractApiSurface, datasetId);
    console.log('Evaluation complete. Check LangSmith for results.');

  } catch (error) {
    console.error('Error running evaluation:', error);
    process.exit(1);
  }
}

main(); 