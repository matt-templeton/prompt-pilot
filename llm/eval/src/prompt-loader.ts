import fs from 'fs';
import path from 'path';

interface Prompt {
  user: string;
}

export function loadPrompt(promptName: string): Prompt {
  const promptPath = path.join(__dirname, '..', '..', 'prompts', `${promptName}.md`);
  
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }

  const content = fs.readFileSync(promptPath, 'utf-8');
  
  // const userMatch = content.match(/## User Prompt\s+([\s\S]*?)(?=##|$)/);

  // if (!userMatch) {
  //   throw new Error(`Invalid prompt format in ${promptPath}. Expected "## User Prompt" section.`);
  // }
  console.log("IN HERE!!!!'");
  console.log(content);
  return {
    user: content
  };
} 