import { Client } from 'langsmith';
import * as fs from 'fs';
import * as path from 'path';
import { ClassDefinition, FunctionDefinition, TestFile } from './types';

export interface ApiExample {
  input: {
    content: string;
    language: string;
  };
  output: {
    expected: {
      classes: ClassDefinition[];
      functions: FunctionDefinition[];
    };
  };
}

export class DatasetManager {
  private client: Client;
  private datasetRoot: string;

  constructor(apiKey: string, datasetRoot: string) {
    this.client = new Client({ apiKey });
    this.datasetRoot = datasetRoot;
  }

  /**
   * Load all examples from the golden dataset directory
   */
  async loadGoldenDataset(): Promise<TestFile[]> {
    const examples: TestFile[] = [];
    const languages = ['typescript', 'python', 'javascript', 'csharp', 'cpp', 'c'];

    for (const lang of languages) {
      const langDir = path.join(this.datasetRoot, 'golden', lang);
      
      // Get the main source file based on language
      const sourceFile = this.getSourceFile(lang);
      const sourcePath = path.join(langDir, sourceFile);
      
      if (!fs.existsSync(sourcePath)) {
        console.warn(`Source file not found for ${lang}: ${sourcePath}`);
        continue;
      }

      const content = fs.readFileSync(sourcePath, 'utf-8');
      const expectedPath = path.join(langDir, 'expected.json');
      
      if (!fs.existsSync(expectedPath)) {
        console.warn(`Expected output not found for ${lang}: ${expectedPath}`);
        continue;
      }

      const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));

      examples.push({
        content,
        expected,
        language: lang,
        complexity: 'simple',
        metadata: {
          features: [],
          edgeCases: []
        }
      });
    }

    return examples;
  }

  /**
   * Create a dataset in LangSmith from our examples
   */
  async createLangSmithDataset(name: string, description: string): Promise<string> {
    const examples = await this.loadGoldenDataset();
    
    // Create the dataset
    const dataset = await this.client.createDataset(name, {
      description
    });

    // Add examples to the dataset
    await this.client.createExamples({
      inputs: examples.map(example => ({ content: example.content, language: example.language })),
      outputs: examples.map(example => ({ expected: example.expected })),
      datasetId: dataset.id
    });

    return dataset.id;
  }

  private getSourceFile(language: string): string {
    switch (language) {
      case 'typescript':
        return 'shape.ts';
      case 'python':
        return 'shape.py';
      case 'javascript':
        return 'shape.js';
      case 'csharp':
        return 'Shape.cs';
      case 'cpp':
        return 'shape.hpp';
      case 'c':
        return 'shape.h';
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
} 