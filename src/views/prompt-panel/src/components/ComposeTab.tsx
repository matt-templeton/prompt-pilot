import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import InstructionsBox from './InstructionsBox';
import FileExplorerBox from './FileExplorerBox';
import { useVSCode } from '../contexts/VSCodeContext';

interface OpenAIModel {
  id: string;
  created: number;
  owned_by: string;
}

const ComposeTab = () => {
  const vscode = useVSCode();
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  useEffect(() => {
    console.log("Sending message...");
    // Request models from extension
    vscode.postMessage({ type: 'getModels' });

    const handleMessage = (event: MessageEvent) => {
      console.log("handleMessage:, ", event);
      const message = event.data;
      if (message.type === 'models') {
        setModels(message.models);
        if (message.models.length > 0) {
          setSelectedModel(message.models[0].id);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

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
              onChange={(e) => setSelectedModel(e.target.value)}
              size="small"
            >
              {models.map((model) => (
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