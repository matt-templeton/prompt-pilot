import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Select, MenuItem, FormControl, InputLabel, ListSubheader, SelectChangeEvent } from '@mui/material';
import InstructionsBox, { InstructionsBoxHandle } from './InstructionsBox';
import FileExplorerBox from './FileExplorerBox';
import { useVSCode } from '../contexts/VSCodeContext';
// import { Anthropic } from '@anthropic-ai/sdk';
import type { Anthropic as AnthropicType } from '@anthropic-ai/sdk';
import { useModel } from '../contexts/ModelContext';

interface OpenAIModel {
  id: string;
  created: number;
  owned_by: string;
}

interface ModelsByProvider {
  openai: OpenAIModel[];
  anthropic: AnthropicType.ModelInfo[];
}

interface SelectedPath {
  path: string;
  isDirectory: boolean;
  tokenCount?: number | null;
}

const ComposeTab: React.FC = () => {
  console.log("ComposeTab: Component mounting");
  const vscode = useVSCode();
  const { selectedModel, setSelectedModel } = useModel();
  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider>({ openai: [], anthropic: [] });
  const [selectedFiles, setSelectedFiles] = useState<SelectedPath[]>([]);
  const [currentFileContent, setCurrentFileContent] = useState<{ path: string; content: string } | null>(null);
  const [removedFilePath, setRemovedFilePath] = useState<string | null>(null);
  
  // Refs to child components
  const instructionsBoxRef = useRef<InstructionsBoxHandle>(null);
  
  // Check if ref is set after component mounts
  useEffect(() => {
    console.log("ComposeTab: Checking instructionsBoxRef after mount:", instructionsBoxRef.current);
  }, []);
  
  useEffect(() => {
    console.log("ComposeTab: Setting up message listener");
    // Request models from extension
    vscode.postMessage({ type: 'getModels' });

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log("ComposeTab: Message received:", message);
      console.log("ComposeTab: ", message.type);
      // Handle different message types
      switch (message.type) {
        case 'models':
          setModelsByProvider(message.models);
          setSelectedModel(message.selectedModel);
          break;
          
        case 'selectedFiles':
          console.log("ComposeTab: Received selected files:", message.files);
          setSelectedFiles(message.files);
          break;
          
        case 'fileContent':
          console.log("ComposeTab: Received file content for:", message.path);
          // Set current file content for InstructionsBox
          setCurrentFileContent({
            path: message.path,
            content: message.content
          });
          
          // Also try using the ref approach as a backup
          if (instructionsBoxRef.current) {
            console.log("ComposeTab: instructionsBoxRef.current exists, calling addFileContent");
            instructionsBoxRef.current.addFileContent(message.path, message.content);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call addFileContent");
          }
          break;
          
        case 'fileRemoved':
          console.log("ComposeTab: File removed:", message.path);
          // Set removed file path for InstructionsBox
          setRemovedFilePath(message.path);
          
          // Also try using the ref approach as a backup
          if (instructionsBoxRef.current) {
            console.log("ComposeTab: instructionsBoxRef.current exists, calling removeFile");
            instructionsBoxRef.current.removeFile(message.path);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call removeFile");
          }
          break;
          
        default:
          console.log("ComposeTab: Unhandled message type:", message.type);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode, setSelectedModel]);

  // Reset removedFilePath after it's been processed
  useEffect(() => {
    if (removedFilePath) {
      const timer = setTimeout(() => {
        setRemovedFilePath(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [removedFilePath]);

  const handleModelChange = (e: SelectChangeEvent<string>) => {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    
    vscode.postMessage({
      type: 'modelSelected',
      modelId: modelId
    });
  };
  
  const handleRequestFiles = () => {
    console.log("ComposeTab: Requesting selected files");
    vscode.postMessage({ 
      type: 'getSelectedFiles',
      action: 'get'
    });
  };
  
  const handleFileDelete = (path: string) => {
    console.log("ComposeTab: Deleting file:", path);
    vscode.postMessage({
      type: 'toggleFileSelection',
      action: 'uncheck',
      file: path
    });
  };
  
  const handleModelChangeWithFiles = (model: string, files: SelectedPath[]) => {
    console.log("ComposeTab: Model changed with files:", model, files);
    vscode.postMessage({
      type: 'selectedFiles',
      action: 'update',
      files: files,
      model: model
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100vh' }}>
      <InstructionsBox 
        ref={instructionsBoxRef}
        fileContent={currentFileContent}
        removedFilePath={removedFilePath}
      />
      <FileExplorerBox 
        selectedFiles={selectedFiles}
        onFileDelete={handleFileDelete}
        onRequestFiles={handleRequestFiles}
        onModelChange={handleModelChangeWithFiles}
      />
      
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