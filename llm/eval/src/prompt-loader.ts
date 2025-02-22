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
  
  return {
    user: content
  };
} 