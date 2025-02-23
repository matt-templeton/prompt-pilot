import dotenv from 'dotenv';
import OpenAI from 'openai';
import { evaluate, EvaluationResult } from 'langsmith/evaluation';
// import { loadPrompt } from './prompt-loader';
import minimist from 'minimist';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'langsmith';

dotenv.config();

export function loadPrompt(promptName: string): string {
  const promptPath = path.join(__dirname, '..', '..', 'prompts', `${promptName}.md`);
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }

  const content = fs.readFileSync(promptPath, 'utf-8');
  
  return content;
} 
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

export interface Input {
  content: string
}

const target = async (input: Input): Promise<{ response: string }> => {
    const fullPrompt = `${prompt}
    
NOW, PLEASE ANALYZE THE FOLLOWING CODE:
${input.content}
\`\`\`

Please analyze the code above and provide its API surface in the same format as shown in the example. Do not repeat the example output - analyze the new code provided.`;
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "user", content: fullPrompt }
        ]
    });
    const ret = response.choices[0].message.content?.trim() || "";
    console.log(ret);
    return { response: ret };
};

async function accuracy({
    outputs,
    referenceOutputs
  }: {
    outputs?: Record<string, string>;
    referenceOutputs?: Record<string, string>;
  }): Promise<EvaluationResult> {

    console.log("accuracy:");
    console.log("OUTPUTS: --------------------------------");
    console.log(outputs);
    console.log(" END OUTPUTS: --------------------------------");
    console.log("REFERENCE OUTPUTS: ---------------------------");
    console.log(referenceOutputs);
    console.log("END REFERENCE OUTPUTS: ---------------------------");


    const prompt = `You are an expert code reviewer evaluating API surface extraction results.
        Please analyze the extracted API surface against the expected output and evaluate its completeness and accuracy.

        Expected API Surface:
        \`\`\`json
        ${JSON.stringify(referenceOutputs, null, 2)}
        \`\`\`

        Extracted API Surface:
        \`\`\`json
        ${JSON.stringify(outputs, null, 2)}
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
        }
        
        Rules:
        1. Names of properties, classes, structs, functions or anything else that is defined as some entity within the file must be an exact string match.
        `;


    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0
    });
        
        // Try to find JSON between ```json and ``` markers
    const jsonMatch = response.choices[0].message.content?.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
        const result = JSON.parse(jsonMatch[1]);
        return {
            key: "accuracy",
            ...result
          };
    } else {
        throw Error("Unable to parse json from eval result.");
    }
  };



  export const createDataset = async (datasetName: string, datasetDirName: string): Promise<string> => {
    console.log("createDataset: top");
    const client = new Client({apiKey: process.env.LANGSMITH_API_KEY});

    // Check if dataset already exists
    const datasets = [];
    for await (const dataset of client.listDatasets()) {
      datasets.push(dataset);
    }
    const existingDataset = datasets.find(dataset => dataset.name === datasetName);
    if (existingDataset) {
      console.log(`Dataset '${datasetName}' already exists, using existing dataset`);
      return existingDataset.id;
    }

    const examples: [string, string][] = [];
    // Read the dataset directory
    
    const datasetDir = path.join(__dirname, '..', 'datasets', datasetDirName);
    const languages = fs.readdirSync(datasetDir);
  
    for (const language of languages) {
        const languageDir = path.join(datasetDir, language);
        if (!fs.statSync(languageDir).isDirectory()) {continue;}
  
        // Read all files in the language directory
        const files = fs.readdirSync(languageDir);
        
        // Find the expected.json file
        const expectedFile = files.find((f: string) => f === 'expected.json');
        if (!expectedFile) {continue;}
        
        // Read the expected output
        const expectedPath = path.join(languageDir, expectedFile);
        const expectedContent = fs.readFileSync(expectedPath, 'utf8');
        
        // Read all code files (excluding expected.json)
        const codeFiles = files.filter((f: string) => f !== 'expected.json');
        let codeContent = '';
        
        for (const file of codeFiles) {
            const filePath = path.join(languageDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            codeContent += `// File: ${file}\n${content}\n\n`;
        }
        
        // Add the example
        examples.push([codeContent, expectedContent]);
    }
  
    // Create inputs and outputs format matching the test.ts structure
    const inputs = examples.map(([inputCode]) => ({
        content: inputCode
    }));
    const outputs = examples.map(([, outputJson]) => ({
        answer: outputJson,
    }));
  
    // Create the dataset in LangSmith
    const dataset = await client.createDataset(datasetName, {
        description: "A dataset of code files and their expected analysis output.",
    });
  
    // Add examples to the dataset
    await client.createExamples({
        inputs,
        outputs,
        datasetId: dataset.id,
    });
  
    console.log(`Dataset created with ${examples.length} examples`);
    return dataset.id;
  };

async function main() {
  try {
    const DATASET_DIRECTORY_NAME = 'golden';
    // Using a hardcoded name instead of a constructed one
    const DATASET_NAME = `Prompt Pilot Eval - ${DATASET_DIRECTORY_NAME}`;
    
    console.log('Setting up LangSmith dataset...');
    await createDataset(DATASET_NAME, DATASET_DIRECTORY_NAME);

    await evaluate(
      (exampleInput) => {
        return target(exampleInput);
      },
      {
        data: DATASET_NAME,
        evaluators: [accuracy],
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