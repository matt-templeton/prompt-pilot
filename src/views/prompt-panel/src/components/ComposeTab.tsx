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
    // Request models from extension
    vscode.postMessage({ type: 'getModels' });

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      
      
      // Create a unique key for this message to prevent duplicate processing
      let messageKey = `${message.type}`;
      if (message.path) {
        messageKey += `:${message.path}`;
      } else if (message.type === 'fileSelected' && message.file && message.file.path) {
        // For fileSelected messages, include the file path in the key
        messageKey += `:${message.file.path}`;
      } else if (message.type === 'selectedFiles' && message.files) {
        // For selectedFiles messages, include a hash of the token counts to detect updates
        const tokenCountsHash = message.files
          .map((file: SelectedPath) => `${file.path}:${file.tokenCount}`)
          .join('|');
        messageKey += `:${tokenCountsHash}`;
      }
      if (message.content) {messageKey += `:${message.content.length}`;}
      
      // Skip if we've already processed this exact message
      if (processedMessagesRef.current.has(messageKey)) {
        return;
      }
      
      
      // Handle different message types
      switch (message.type) {
        case 'models':
          setModelsByProvider(message.models);
          setSelectedModel(message.selectedModel);
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'selectedFiles':
          setSelectedFiles(message.files);
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'fileSelected':
          
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
            instructionsBoxRef.current.addFileContent(message.file.path, message.content);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call addFileContent");
          }
          
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'fileUnselected':
          {
            // Remove the file from the selected files list
            setSelectedFiles(prev => {
              const fileIndex = prev.findIndex(f => f.path === message.path);
              
              if (fileIndex >= 0) {
                const newFiles = prev.filter(f => f.path !== message.path);
                return newFiles;
              } else {
                return prev;
              }
            });
            
            // Set removed file path for InstructionsBox
            setRemovedFilePath(message.path);
            
            // Also try using the ref approach as a backup
            if (instructionsBoxRef.current) {
              instructionsBoxRef.current.removeFile(message.path);
            } else {
              console.error("ComposeTab: instructionsBoxRef.current is null, cannot call removeFile");
            }
            
            // Remove the corresponding fileSelected entry from processedMessagesRef
            // so that if the file is selected again, it will be processed
            const keysToRemove: string[] = [];
            processedMessagesRef.current.forEach(key => {
              // Check for both old format (fileSelected:contentLength) and new format (fileSelected:path:contentLength)
              if (key.startsWith(`fileSelected:${message.path}`) || 
                  (key.startsWith('fileSelected:') && key.includes(message.path))) {
                keysToRemove.push(key);
              }
            });
            
            keysToRemove.forEach(key => {
              processedMessagesRef.current.delete(key);
            });
            
            processedMessagesRef.current.add(messageKey);
          }
          break;
          
        case 'fileContent':
          // Keep this for backward compatibility, but it should no longer be used
          // Set current file content for InstructionsBox
          setCurrentFileContent({
            path: message.path,
            content: message.content
          });
          
          // Also try using the ref approach as a backup
          if (instructionsBoxRef.current) {
            instructionsBoxRef.current.addFileContent(message.path, message.content);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call addFileContent");
          }
          
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'fileRemoved':
          // Keep this for backward compatibility, but it should no longer be used
          // Set removed file path for InstructionsBox
          setRemovedFilePath(message.path);
          
          // Also try using the ref approach as a backup
          if (instructionsBoxRef.current) {
            instructionsBoxRef.current.removeFile(message.path);
          } else {
            console.error("ComposeTab: instructionsBoxRef.current is null, cannot call removeFile");
          }
          
          processedMessagesRef.current.add(messageKey);
          break;
          
        case 'apiSurfaceUsageChanged':
          // Forward this message to the InstructionsBox
          if (instructionsBoxRef.current) {
            // The message will be handled by the FileContents components
            // through the event listener in InstructionsBox
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
    setSelectedModel(modelId);
    
    vscode.postMessage({
      type: 'modelSelected',
      modelId: modelId
    });
  };
  
  const handleRequestFiles = () => {
    vscode.postMessage({ 
      type: 'getSelectedFiles',
      action: 'get'
    });
  };
  
  const handleFileDelete = (path: string) => {
    console.log("ComposeTab: handleFileDelete called for path:", path);
    
    // First, remove the file from the selected files list
    setSelectedFiles(prev => {
      console.log("ComposeTab: Current selectedFiles:", prev);
      const newFiles = prev.filter(f => f.path !== path);
      console.log("ComposeTab: New selectedFiles after removal:", newFiles);
      return newFiles;
    });
    
    // Then, try to remove the file content from InstructionsBox directly
    if (instructionsBoxRef.current) {
      console.log("ComposeTab: Removing file from InstructionsBox via ref");
      instructionsBoxRef.current.removeFile(path);
    } else {
      console.error("ComposeTab: instructionsBoxRef.current is null, cannot call removeFile");
    }
    
    // Also set removedFilePath as a backup mechanism
    console.log("ComposeTab: Setting removedFilePath");
    setRemovedFilePath(path);
    
    // Remove the corresponding fileSelected entry from processedMessagesRef
    // so that if the file is selected again, it will be processed
    console.log("ComposeTab: Looking for fileSelected entries to remove for path:", path);
    
    const keysToRemove: string[] = [];
    processedMessagesRef.current.forEach(key => {
      // Check for both old format (fileSelected:contentLength) and new format (fileSelected:path:contentLength)
      if (key.startsWith(`fileSelected:${path}`) || 
          (key.startsWith('fileSelected:') && key.includes(path))) {
        console.log("ComposeTab: Found key to remove:", key);
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      console.log("ComposeTab: Removing key from processedMessagesRef:", key);
      processedMessagesRef.current.delete(key);
    });
    
    // Finally, send message to extension to uncheck the file
    console.log("ComposeTab: Sending toggleFileSelection message to uncheck file:", path);
    vscode.postMessage({
      type: 'toggleFileSelection',
      action: 'uncheck',
      file: path
    });
  };
  
  const handleModelChangeWithFiles = (model: string, files: SelectedPath[]) => {
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