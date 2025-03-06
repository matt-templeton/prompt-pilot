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
  console.log("DEBUG: ComposeTab component rendered");
  const vscode = useVSCode();
  const { selectedModel, setSelectedModel } = useModel();
  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider>({ openai: [], anthropic: [] });
  const [selectedFiles, setSelectedFiles] = useState<SelectedPath[]>([]);
  const [currentFileContent, setCurrentFileContent] = useState<{ path: string; content: string } | null>(null);
  const [removedFilePath, setRemovedFilePath] = useState<string | null>(null);
  
  // Refs to child components and tracking processed messages
  const instructionsBoxRef = useRef<InstructionsBoxHandle>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  
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
      console.log("DEBUG: ComposeTab received message:", message.type);
      
      // Create a unique key for this message to avoid processing duplicates
      const messageKey = `${message.type}-${JSON.stringify(message)}`;
      
      // Skip if we've already processed this exact message
      if (processedMessagesRef.current.has(messageKey)) {
        console.log("DEBUG: Skipping duplicate message:", message.type);
        return;
      }
      
      console.log("ComposeTab: Message received:", message);
      
      // Handle different message types
      switch (message.type) {
        case 'models':
          setModelsByProvider(message.models);
          setSelectedModel(message.selectedModel);
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'selectedFiles':
          console.log("DEBUG: ComposeTab processing selectedFiles message");
          console.log("DEBUG: Current selectedFiles state:", selectedFiles);
          console.log("ComposeTab: Received selected files:", message.files);
          setSelectedFiles(message.files);
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'fileSelected':
          console.log("ComposeTab: Received fileSelected for:", message.file.path);
          
          // Update the selected files list to include this file
          setSelectedFiles(prev => {
            // Check if this file is already in the list
            const fileIndex = prev.findIndex(f => f.path === message.file.path);
            if (fileIndex >= 0) {
              // Replace the existing file
              const newFiles = [...prev];
              newFiles[fileIndex] = message.file;
              return newFiles;
            } else {
              // Add the new file
              return [...prev, message.file];
            }
          });
          
          // Set current file content for InstructionsBox
          setCurrentFileContent({
            path: message.file.path,
            content: message.content
          });
          
          // Use the ref approach to add file content
          // This is the only place we should call addFileContent to avoid duplicates
          if (instructionsBoxRef.current) {
            console.log("ComposeTab: instructionsBoxRef.current exists, calling addFileContent");
            instructionsBoxRef.current.addFileContent(message.file.path, message.content);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call addFileContent");
          }
          
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'fileUnselected':
          console.log("ComposeTab: File unselected:", message.path);
          
          // Remove the file from the selected files list
          setSelectedFiles(prev => prev.filter(f => f.path !== message.path));
          
          // Set removed file path for InstructionsBox
          setRemovedFilePath(message.path);
          
          // Also try using the ref approach as a backup
          if (instructionsBoxRef.current) {
            console.log("ComposeTab: instructionsBoxRef.current exists, calling removeFile");
            instructionsBoxRef.current.removeFile(message.path);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call removeFile");
          }
          
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'fileContent':
          // Keep this for backward compatibility, but it should no longer be used
          console.log("ComposeTab: Received legacy fileContent for:", message.path);
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
          
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'fileRemoved':
          // Keep this for backward compatibility, but it should no longer be used
          console.log("ComposeTab: Received legacy fileRemoved:", message.path);
          // Set removed file path for InstructionsBox
          setRemovedFilePath(message.path);
          
          // Also try using the ref approach as a backup
          if (instructionsBoxRef.current) {
            console.log("ComposeTab: instructionsBoxRef.current exists, calling removeFile");
            instructionsBoxRef.current.removeFile(message.path);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call removeFile");
          }
          
          processedMessagesRef.current.add(messageKey);
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

  // Reset currentFileContent after it's been processed
  useEffect(() => {
    if (currentFileContent) {
      const timer = setTimeout(() => {
        setCurrentFileContent(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentFileContent]);

  const handleModelChange = (e: SelectChangeEvent<string>) => {
    const modelId = e.target.value;
    console.log("DEBUG: handleModelChange called with modelId:", modelId);
    console.log("DEBUG: Previous selectedModel value:", selectedModel);
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
    
    // First, remove the file from the selected files list
    setSelectedFiles(prev => prev.filter(f => f.path !== path));
    
    // Then, try to remove the file content from InstructionsBox directly
    if (instructionsBoxRef.current) {
      console.log("ComposeTab: Calling removeFile on instructionsBoxRef for path:", path);
      instructionsBoxRef.current.removeFile(path);
    }
    
    // Also set removedFilePath as a backup mechanism
    setRemovedFilePath(path);
    
    // Finally, send message to extension to uncheck the file
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
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      overflow: 'hidden' // Prevent the compose tab from scrolling
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2, 
        flexGrow: 1,
        overflow: 'hidden' // Prevent this container from scrolling
      }}>
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
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 2, 
        p: 1,
        flexShrink: 0 // Prevent this container from shrinking
      }}>
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