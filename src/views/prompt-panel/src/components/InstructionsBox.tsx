import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { Box, Paper, Chip, Menu, MenuItem, TextField, Typography, Button } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const DUMMY_PROMPTS = ['Template 1', 'Template 2', 'Custom Prompt'];

interface FileContent {
  path: string;
  content: string;
}

interface InstructionsBoxProps {
  onAddFileContent?: (path: string, content: string) => void;
  onRemoveFile?: (path: string) => void;
  fileContent?: { path: string; content: string } | null;
  removedFilePath?: string | null;
}

export interface InstructionsBoxHandle {
  addFileContent: (path: string, content: string) => void;
  removeFile: (path: string) => void;
}

const InstructionsBox = forwardRef<InstructionsBoxHandle, InstructionsBoxProps>(
  ({ onAddFileContent, onRemoveFile, fileContent, removedFilePath }, ref) => {
    console.log("InstructionsBox: Component rendering with ref:", !!ref);
    console.log("InstructionsBox: Received fileContent prop:", fileContent);
    console.log("InstructionsBox: Received removedFilePath prop:", removedFilePath);
    
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
    const [instructionsText, setInstructionsText] = useState<string>('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fileContents, setFileContents] = useState<FileContent[]>([]);
    
    // Use refs to track processed files and prevent infinite loops
    const processedFilesRef = useRef<Set<string>>(new Set());
    const processedRemovalsRef = useRef<Set<string>>(new Set());
    const lastFileContentRef = useRef<{ path: string; content: string } | null>(null);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
      setAnchorEl(null);
    };

    const handlePromptSelect = (prompt: string) => {
      setSelectedPrompts([...selectedPrompts, prompt]);
      handleMenuClose();
    };

    const handlePromptDelete = (indexToDelete: number) => {
      const newPrompts = selectedPrompts.filter((_, index) => index !== indexToDelete);
      setSelectedPrompts(newPrompts);
    };

    const formatPathForXmlTag = (path: string): string => {
      // Replace slashes and backslashes with dots
      return path.replace(/[/\\]/g, '.');
    };

    const handleInstructionsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setInstructionsText(event.target.value);
    };

    // Process fileContent prop when it changes
    useEffect(() => {
      if (fileContent && fileContent.path && fileContent.content) {
        // Check if we've already processed this exact file content
        const fileContentKey = `${fileContent.path}:${fileContent.content.length}`;
        
        // Skip if we've already processed this exact file content
        if (processedFilesRef.current.has(fileContentKey)) {
          console.log('InstructionsBox: Skipping already processed file content:', fileContent.path);
          return;
        }
        
        console.log('InstructionsBox: Processing fileContent prop:', fileContent.path);
        
        // Add to processed set
        processedFilesRef.current.add(fileContentKey);
        lastFileContentRef.current = fileContent;
        
        // Process the file content
        addFileContent(fileContent.path, fileContent.content);
      }
    }, [fileContent]); // Intentionally omitting addFileContent from deps to prevent loops

    // Process removedFilePath prop when it changes
    useEffect(() => {
      if (removedFilePath) {
        // Skip if we've already processed this removal
        if (processedRemovalsRef.current.has(removedFilePath)) {
          console.log('InstructionsBox: Skipping already processed file removal:', removedFilePath);
          return;
        }
        
        console.log('InstructionsBox: Processing removedFilePath prop:', removedFilePath);
        
        // Add to processed set
        processedRemovalsRef.current.add(removedFilePath);
        
        // Process the file removal
        removeFile(removedFilePath);
      } else {
        // When removedFilePath is null, we can clear the processed removals set
        // This allows us to process the same file removal again if needed
        console.log('InstructionsBox: Clearing processed removals set');
        processedRemovalsRef.current.clear();
      }
    }, [removedFilePath]); // Intentionally omitting removeFile from deps to prevent loops

    // Public method to add file content
    const addFileContent = (path: string, content: string) => {
      console.log('InstructionsBox: addFileContent called with path:', path);
      
      // Add file content with XML tags to the instructions
      const formattedPath = formatPathForXmlTag(path);
      const xmlContent = `\n<${formattedPath}>\n${content}\n</${formattedPath}>\n`;
      console.log('InstructionsBox: Adding XML content:', xmlContent.substring(0, 100) + '...');
      
      // Update file contents array
      setFileContents(prev => {
        // Check if this file already exists in our array
        const existingIndex = prev.findIndex(file => file.path === path);
        if (existingIndex >= 0) {
          // Replace existing file content
          const newContents = [...prev];
          newContents[existingIndex] = { path, content };
          return newContents;
        } else {
          // Add new file content
          return [...prev, { path, content }];
        }
      });
      
      // Append to instructions text
      setInstructionsText(prev => {
        const newText = prev + xmlContent;
        console.log('InstructionsBox: Updated instructions text length:', newText.length);
        return newText;
      });
      
      // Call the callback if provided
      if (onAddFileContent) {
        onAddFileContent(path, content);
      }
    };

    // Public method to remove file
    const removeFile = (path: string) => {
      console.log('InstructionsBox: removeFile called with path:', path);
      
      // Remove file from fileContents array
      setFileContents(prev => prev.filter(file => file.path !== path));
      
      // Remove file content from instructions text
      const formattedPath = formatPathForXmlTag(path);
      setInstructionsText(prev => {
        // Create regex to match the entire XML tag block for this file
        const regex = new RegExp(`\\n<${formattedPath}>\\n[\\s\\S]*?\\n</${formattedPath}>\\n`, 'g');
        const newText = prev.replace(regex, '');
        console.log('InstructionsBox: Removed file content from instructions text for path:', path);
        return newText;
      });
      
      // Call the callback if provided
      if (onRemoveFile) {
        onRemoveFile(path);
      }
    };

    // Expose methods via useImperativeHandle
    useImperativeHandle(ref, () => {
      console.log('InstructionsBox: Setting up imperative handle');
      return {
        addFileContent,
        removeFile
      };
    }, []);  // Empty dependency array to ensure it only runs once

    // Log when component mounts
    useEffect(() => {
      console.log('InstructionsBox: Component mounted');
      return () => {
        console.log('InstructionsBox: Component unmounted');
      };
    }, []);

    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">Instructions</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selectedPrompts.map((prompt, index) => (
                <Chip 
                  key={index} 
                  label={prompt} 
                  onDelete={() => handlePromptDelete(index)}
                  size="small"
                />
              ))}
            </Box>
          </Box>
          
          <Button
            onClick={handleMenuClick}
            endIcon={<KeyboardArrowDownIcon />}
            variant="outlined"
            size="small"
          >
            Prompts
          </Button>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            {DUMMY_PROMPTS.map((prompt) => (
              <MenuItem 
                key={prompt} 
                onClick={() => handlePromptSelect(prompt)}
              >
                {prompt}
              </MenuItem>
            ))}
          </Menu>
        </Box>
        
        <TextField
          multiline
          fullWidth
          minRows={10}
          placeholder="Enter your instructions here..."
          variant="outlined"
          value={instructionsText}
          onChange={handleInstructionsChange}
        />
      </Paper>
    );
  }
);

// Add display name for debugging
InstructionsBox.displayName = 'InstructionsBox';

export default InstructionsBox; 