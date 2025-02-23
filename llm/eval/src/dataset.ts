import { Client } from 'langsmith';
import * as fs from 'fs';
import * as path from 'path';
// import { ClassDefinition, FunctionDefinition, TestFile } from './types';


export const createDataset = async (datasetName: string, datasetDirName: string): Promise<string> => {
  console.log("createDataset: top");
  const examples: [string, string][] = [];
  const client = new Client({apiKey: process.env.LANGSMITH_API_KEY});
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

// export interface ApiExample {
//   input: {
//     content: string;
//     language: string;
//   };
//   output: {
//     expected: {
//       classes: ClassDefinition[];
//       functions: FunctionDefinition[];
//     };
//   };
// }

// export class DatasetManager {
//   private client: Client;
//   private datasetRoot: string;

//   constructor(apiKey: string, datasetRoot: string) {
//     this.client = new Client({ apiKey });
//     this.datasetRoot = datasetRoot;
//   }

//   /**
//    * Load all examples from the golden dataset directory
//    */
//   async loadGoldenDataset(): Promise<TestFile[]> {
//     const examples: TestFile[] = [];
//     const languages = ['typescript', 'python', 'javascript', 'csharp', 'cpp', 'c'];

//     for (const lang of languages) {
//       const langDir = path.join(this.datasetRoot, 'golden', lang);
      
//       // Get the main source file based on language
//       const sourceFile = this.getSourceFile(lang);
//       const sourcePath = path.join(langDir, sourceFile);
      
//       if (!fs.existsSync(sourcePath)) {
//         console.warn(`Source file not found for ${lang}: ${sourcePath}`);
//         continue;
//       }

//       const content = fs.readFileSync(sourcePath, 'utf-8');
//       const expectedPath = path.join(langDir, 'expected.json');
      
//       if (!fs.existsSync(expectedPath)) {
//         console.warn(`Expected output not found for ${lang}: ${expectedPath}`);
//         continue;
//       }

//       const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));

//       examples.push({
//         content,
//         expected,
//         language: lang,
//         complexity: 'simple',
//         metadata: {
//           features: [],
//           edgeCases: []
//         }
//       });
//     }

//     return examples;
//   }

//   /**
//    * Check if a dataset with the given name exists
//    */
//   async getExistingDataset(name: string): Promise<string | null> {
//     try {
//       const datasets = [];
//       for await (const dataset of this.client.listDatasets()) {
//         datasets.push(dataset);
//       }
//       const existingDataset = datasets.find(d => d.name === name);
//       return existingDataset?.id || null;
//     } catch (error) {
//       console.error("Error checking for existing dataset:", error);
//       return null;
//     }
//   }

//   /**
//    * Create a dataset in LangSmith from our examples
//    */
//   async createLangSmithDataset(name: string, description: string): Promise<string> {
//     // Check for existing dataset
//     const existingId = await this.getExistingDataset(name);
//     if (existingId) {
//       console.log(`Using existing dataset with ID: ${existingId}`);
//       return existingId;
//     }

//     const dataset = await this.client.createDataset(name, {
//       description
//     });

//     // Add examples to the dataset with proper reference outputs
//     const examples = await this.loadGoldenDataset();
//     const formattedExamples = examples.map(example => ({
//       input: {
//         content: example.content,
//         language: example.language
//       },
//       output: example.expected
//     }));
    
//     console.log('Dataset Example Structure:');
//     console.log(JSON.stringify(formattedExamples[0], null, 2));
    
//     await this.client.createExamples({
//       inputs: formattedExamples.map(ex => ex.input),
//       outputs: formattedExamples.map(ex => ex.output),
//       datasetId: dataset.id
//     });

//     return dataset.id;
//   }

//   private getSourceFile(language: string): string {
//     switch (language) {
//       case 'typescript':
//         return 'shape.ts';
//       case 'python':
//         return 'shape.py';
//       case 'javascript':
//         return 'shape.js';
//       case 'csharp':
//         return 'Shape.cs';
//       case 'cpp':
//         return 'shape.hpp';
//       case 'c':
//         return 'shape.h';
//       default:
//         throw new Error(`Unsupported language: ${language}`);
//     }
//   }
// } 