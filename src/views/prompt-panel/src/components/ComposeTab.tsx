import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Select, MenuItem, FormControl, InputLabel, ListSubheader, SelectChangeEvent } from '@mui/material';
import InstructionsBox from './InstructionsBox';
import FileExplorerBox from './FileExplorerBox';
import { useVSCode } from '../contexts/VSCodeContext';
// import { Anthropic } from '@anthropic-ai/sdk';
import type { Anthropic as AnthropicType } from '@anthropic-ai/sdk';

interface OpenAIModel {
  id: string;
  created: number;
  owned_by: string;
}

interface ModelsByProvider {
  openai: OpenAIModel[];
  anthropic: AnthropicType.ModelInfo[];
}

const ComposeTab = () => {
  console.log("ComposeTab: Component mounting");
  const vscode = useVSCode();
  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider>({ openai: [], anthropic: [] });
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  useEffect(() => {
    console.log("ComposeTab: Setting up message listener");
    console.log("Sending message...");
    // Request models from extension
    vscode.postMessage({ type: 'getModels' });

    const handleMessage = (event: MessageEvent) => {
      console.log("handleMessage:, ", event);
      const message = event.data;
      if (message.type === 'models') {
        setModelsByProvider(message.models);
        // Use the selected model from the message or fall back to default
        if (message.selectedModel) {
          setSelectedModel(message.selectedModel);
        } else if (message.models.anthropic.length > 0) {
          setSelectedModel(message.models.anthropic[0].id);
        } else if (message.models.openai.length > 0) {
          setSelectedModel(message.models.openai[0].id);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleModelChange = (e: SelectChangeEvent<string>) => {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    
    vscode.postMessage({
      type: 'modelSelected',
      modelId: modelId
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100vh' }}>
      <InstructionsBox />
      <FileExplorerBox />
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 1 }}>
        <Button variant="contained" color="primary">
          Copy
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2">
            Tokens: 0/2000
          </Typography>
          
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="model-select-label">Model</InputLabel>
            <Select
              labelId="model-select-label"
              value={selectedModel}
              label="Model"
              onChange={handleModelChange}
              size="small"
            >
              {modelsByProvider.anthropic.length > 0 && (
                <ListSubheader>Anthropic</ListSubheader>
              )}
              {modelsByProvider.anthropic.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.display_name || model.id}
                </MenuItem>
              ))}
              
              {modelsByProvider.openai.length > 0 && (
                <ListSubheader>OpenAI</ListSubheader>
              )}
              {modelsByProvider.openai.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
    </Box>
  );
};

export default ComposeTab; 