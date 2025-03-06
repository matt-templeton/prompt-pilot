import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { evaluate, EvaluationResult } from 'langsmith/evaluation';
// import { loadPrompt } from './prompt-loader';
import minimist from 'minimist';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'langsmith';
import Parser from 'tree-sitter';
// import { fileURLToPath } from 'url';
// import { dirname, join, basename } from 'path';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);


dotenv.config();

export function loadPrompt(promptName: string): string {
  const promptPath = path.join(__dirname, '..', '..', 'prompts', 'ast_versions', `${promptName}.md`);
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }

  const content = fs.readFileSync(promptPath, 'utf-8');
  
  return content;
} 
// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const promptName = argv.prompt || 'refactored';

 // Ensure required environment variables are set
const requiredEnvVars = [
  'LANGSMITH_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Load prompt from file
const prompt = loadPrompt(promptName);

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface Input {
  content: string,
  language: string
}

const target = async (input: Input): Promise<{ response: string }> => {
    const content = await extractAst(input);
    // Save the AST content to a file in the /src directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ast_content_${timestamp}.json`;
    const filePath = path.join(__dirname, filename);
    
    // Write the content to the file with proper formatting for readability
    // fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`AST content saved to: ${filePath}`);
    
    const fullPrompt = `${prompt};
    
NOW, PLEASE ANALYZE THE FOLLOWING CODE:
<AST>
\`\`\`
${JSON.stringify(content, null, 2)}
\`\`\`
</AST>

<RAW CODE>
${input.content}
</RAW CODE>


Please analyze the code above and provide its API surface in the same format as shown in the example. Do not repeat the example output - analyze the new code provided.`;
  
// console.log("FULL PROMPT -------------------------------------------");
// console.log(prompt);
// console.log("END:::FULL PROMPT -------------------------------------------");

// Use Claude 3.5 Sonnet instead of OpenAI
const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 4000,
    messages: [
        { role: "user", content: fullPrompt }
    ]
});
// Handle the response content correctly
let ret = "";
if (response.content && response.content.length > 0) {
    const firstContent = response.content[0];
    if ('text' in firstContent) {
        ret = firstContent.text;
    }
}
return { response: ret };
};

async function accuracy({
    outputs,
    referenceOutputs
  }: {
    outputs?: Record<string, string>;
    referenceOutputs?: Record<string, string>;
  }): Promise<EvaluationResult> {

    // Extract the YAML content from within <output> tags in the model's response
    let extractedOutput = outputs?.response || "";
    const outputTagMatch = extractedOutput.match(/<output>([\s\S]*?)<\/output>/);
    
    if (outputTagMatch && outputTagMatch[1]) {
      // Use the content within the <output> tags
      extractedOutput = outputTagMatch[1].trim();
    } else {
      // Fallback: Try to extract YAML content from code blocks if <output> tags aren't found
      const yamlMatch = extractedOutput.match(/```(?:yaml)?\s*([\s\S]*?)```/);
      if (yamlMatch && yamlMatch[1]) {
        extractedOutput = yamlMatch[1].trim();
      }
    }

    const prompt = `You are an expert code reviewer evaluating API surface extraction results.
        Please analyze the extracted API surface against the expected output and evaluate its completeness and accuracy.

        Expected API Surface:
        \`\`\`json
        ${JSON.stringify(referenceOutputs, null, 2)}
        \`\`\`

        Extracted API Surface:
        \`\`\`yaml
        ${extractedOutput}
        \`\`\`

        Please evaluate the following aspects and provide a detailed analysis:
        1. Are all expected classes present in the extracted output?
        2. Are all method names correctly captured?
        3. Are all property names included?
        4. Are all function names present?

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


    // Use Claude 3.5 Sonnet instead of OpenAI
    const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
    });
    console.log(response.content);
    
    // Helper function to extract array items from a JSON array string
    function extractArrayItems(arrayString: string): string[] {
        const items: string[] = [];
        const itemMatches = arrayString.matchAll(/"([^"]*)"/g);
        for (const match of itemMatches) {
            items.push(match[1]);
        }
        return items;
    }
    
    // Extract the JSON from the response
    let jsonContent = "";
    if (response.content && response.content.length > 0) {
        const firstContent = response.content[0];
        if ('text' in firstContent) {
            jsonContent = firstContent.text;
        }
    }
    
    console.log("Raw response content:");
    console.log(jsonContent);
    
    // Try multiple approaches to extract the JSON
    let jsonObject = null;
    
    // Approach 1: Try to find JSON between ```json and ``` markers
    const jsonMatch = jsonContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
        try {
            // Sanitize the JSON string by removing problematic characters
            const sanitizedJson = jsonMatch[1]
                .split('')
                .filter(char => {
                    const code = char.charCodeAt(0);
                    return !(code < 32 || (code >= 127 && code <= 159));
                })
                .join('');
            
            jsonObject = JSON.parse(sanitizedJson);
            console.log("Extracted JSON using code block approach");
        } catch (error) {
            console.error("Error parsing JSON from code block:", error);
        }
    }
    
    // Approach 2: If the first approach failed, try to extract JSON directly from the beginning of the response
    if (!jsonObject) {
        try {
            // Look for a JSON object at the beginning of the response
            const directJsonMatch = jsonContent.match(/^\s*(\{[\s\S]*?\})\s*(\n|$)/);
            if (directJsonMatch) {
                const sanitizedJson = directJsonMatch[1]
                    .split('')
                    .filter(char => {
                        const code = char.charCodeAt(0);
                        return !(code < 32 || (code >= 127 && code <= 159));
                    })
                    .join('');
                
                jsonObject = JSON.parse(sanitizedJson);
                console.log("Extracted JSON using direct approach");
            }
        } catch (error) {
            console.error("Error parsing JSON directly:", error);
        }
    }
    
    // Approach 3: Try to find JSON anywhere in the text (for cases where it's preceded by text)
    if (!jsonObject) {
        try {
            // Look for a JSON object anywhere in the text with score and reasoning
            const fullJsonRegex = /\{[\s\S]*?"score"\s*:\s*([\d.]+)[\s\S]*?"reasoning"\s*:\s*"([^"]*(?:"[^"]*"[^"]*)*)[\s\S]*?\}/;
            const anywhereJsonMatch = jsonContent.match(fullJsonRegex);
            
            if (anywhereJsonMatch) {
                // Try to extract the full JSON object
                const fullJsonMatch = jsonContent.match(/(\{[\s\S]*?"score"[\s\S]*?:[\s\S]*?[\d.]+[\s\S]*?"reasoning"[\s\S]*?:[\s\S]*?"[^"]*(?:"[^"]*"[^"]*)*"[\s\S]*?\})/);
                if (fullJsonMatch) {
                    const sanitizedJson = fullJsonMatch[1]
                        .split('')
                        .filter(char => {
                            const code = char.charCodeAt(0);
                            return !(code < 32 || (code >= 127 && code <= 159));
                        })
                        .join('');
                    
                    try {
                        jsonObject = JSON.parse(sanitizedJson);
                        console.log("Extracted JSON using anywhere approach");
                    } catch (error) {
                        // If parsing the full JSON fails, at least extract the score and reasoning
                        console.error("Error parsing full JSON:", error);
                        const score = parseFloat(anywhereJsonMatch[1]);
                        const reasoning = anywhereJsonMatch[2];
                        
                        // Try to extract missing_elements and extra_elements
                        const missingElementsMatch = jsonContent.match(/"missing_elements"\s*:\s*\[([\s\S]*?)\]/);
                        const extraElementsMatch = jsonContent.match(/"extra_elements"\s*:\s*\[([\s\S]*?)\]/);
                        
                        jsonObject = { 
                            score,
                            reasoning,
                            missing_elements: missingElementsMatch ? extractArrayItems(missingElementsMatch[1]) : [],
                            extra_elements: extraElementsMatch ? extractArrayItems(extraElementsMatch[1]) : []
                        };
                        console.log("Extracted partial JSON using anywhere approach");
                    }
                }
            }
        } catch (error) {
            console.error("Error extracting JSON from anywhere:", error);
        }
    }
    
    // Approach 4: Try to extract just the score if JSON parsing fails
    if (!jsonObject) {
        const scoreMatch = jsonContent.match(/"score"\s*:\s*([\d.]+)/);
        if (scoreMatch && scoreMatch[1]) {
            const score = parseFloat(scoreMatch[1]);
            console.log(`Fallback: Extracted score ${score}`);
            jsonObject = { score };
        }
    }
    
    if (jsonObject) {
        return {
            key: "accuracy",
            ...jsonObject
        };
    } else {
        throw Error("Unable to parse json from eval result.");
    }
  };



  export const createDataset = async (datasetName: string, datasetDirName: string): Promise<string> => {
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

    const examples: [Input, string][] = [];
    // Read the dataset directory
    
    const datasetDir = path.join(__dirname, '..', 'datasets', datasetDirName);
    const languages = fs.readdirSync(datasetDir);
  
    for (const language of languages) {
        const languageDir = path.join(datasetDir, language);
        if (!fs.statSync(languageDir).isDirectory()) {continue;}
  
        // Read all files in the language directory
        const files = fs.readdirSync(languageDir);
        
        // Find the expected.json file
        const expectedFile = files.find((f: string) => f === 'expected.yaml');
        if (!expectedFile) {continue;}
        
        // Read the expected output
        const expectedPath = path.join(languageDir, expectedFile);
        const expectedContent = fs.readFileSync(expectedPath, 'utf8');
        
        // Read all code files (excluding expected.json)
        const codeFiles = files.filter((f: string) => f !== 'expected.json');
        // let codeContent = '';
        
        for (const file of codeFiles) {
          const filePath = path.join(languageDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
          const language = languageMap[ext];
          // Add the example
          if (!language) {
            continue;
          }
          examples.push([{content: content, language} as Input, expectedContent]);
          // codeContent += `// File: ${file}\n${content}\n\n`;
        }
        
        
    }
  
    // Create inputs and outputs format matching the test.ts structure
    const inputs = examples.map(([input]) => ({
        content: input.content,
        language: input.language
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



  // Create outputs directory if it doesn't exist
  // const outputsDir = path.join(__dirname, 'outputs');
  // if (!fs.existsSync(outputsDir)) {
  //   fs.mkdirSync(outputsDir);
  // }
  
  // Set of node types to exclude
  const excludedTypes = new Set([
    '!', '!=', '"', '#define', '#endif', '#ifndef', '#include',
    '&', '(', ')', '*', '+', ',', '->', '.', ':', '::', ';',
    '<', '<<', '=', '==', '>', '[', ']', '{', '}', '~', '@'
  ]);
  
  // Function to check if a node type should be included
  function shouldIncludeNode(node: Parser.SyntaxNode): boolean {
    return node.isNamed && 
           !excludedTypes.has(node.type);
  }
  
  // Function to check if a type string should be included
  // function shouldIncludeType(type: string): boolean {
  //   return !excludedTypes.has(type);
  // }
  
  interface AstNode {
    type: string;
    grammarType: string;
    text: string;
    children: AstNode[];
  }
  
  // Function to convert a node to a JSON-friendly object
  function nodeToJson(node: Parser.SyntaxNode): AstNode | null {
    if (!shouldIncludeNode(node)) {
      return null;
    }
  
    const children: AstNode[] = [];
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const childJson = nodeToJson(child);
        if (childJson) {
          children.push(childJson);
        }
      }
    }
  
    return {
      type: node.type,
      grammarType: node.grammarType,
      text: node.text,
      children: children
    };
  }
  
  // Map file extensions to their language names
  const languageMap: Record<string, string> = {
    '.java': 'java',
    '.js': 'javascript',
    '.hpp': 'cpp',
    '.cpp': 'cpp',
    '.h': 'c',
    '.c': 'c',
    '.cs': 'c-sharp',
    '.py': 'python',
    '.ts': 'typescript'
  };
  
  // Load parser for a specific language
  async function loadParser(language: string) {
    const parser = new Parser();
    const langModule = await import(`tree-sitter-${language}`);
    if (language == 'typescript') {
      parser.setLanguage(langModule.default.typescript);
    } else {
      parser.setLanguage(langModule.default);
    }
    return parser;
  }
  
  // Function to process a single file
  async function extractAst(input: Input): Promise<AstNode | null> {
   
    
    // if (!language) {
    //   console.log(`Skipping ${filePath} - no parser available for ${ext}`);
    //   return;
    // }
  
    // try {
    const parser = await loadParser(input.language);
    // const sourceCode = fs.readFileSync(filePath, 'utf8');
    const tree = parser.parse(input.content);
    
    // Convert the tree to JSON
    const jsonTree = nodeToJson(tree.rootNode);
    
    // Collect all unique node types
    const nodeTypes = new Set<string>();
    function collectNodeTypes(node: AstNode) {
      if (node.type) {
        nodeTypes.add(node.type);
      }
      if (node.children) {
        node.children.forEach(collectNodeTypes);
      }
    }
    if (jsonTree) {
      collectNodeTypes(jsonTree);
    }
    // Create the final output object
    return jsonTree;
    
    // Generate output filename
    // const fileName =path.basename(filePath);
    // const outputPath = path.join(outputsDir, `${fileName}_ast.json`);
    
    // Write to file
    // fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    // console.log(`AST for ${fileName} has been written to: ${outputPath}`);
    // return output;
    // } catch (error) {
    //   // console.error(`Error processing ${filePath}:`, error);
    // }
  }
  
  // // Process all files in the code directory
  // async function extractAst() {
  //   const codeDir = join(__dirname, 'code');
  //   const files = fs.readdirSync(codeDir);
  
  //   for (const file of files) {
  //     const filePath = join(codeDir, file);
  //     await processFile(filePath);
  //   }
  // }
  
  
  // const callExpression = tree.rootNode.child(1)?.firstChild;
  // console.log(callExpression);
  


async function main() {
  try {
    const DATASET_DIRECTORY_NAME = 'refactored';
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
