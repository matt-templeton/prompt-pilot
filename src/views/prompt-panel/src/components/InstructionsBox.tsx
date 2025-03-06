import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { Box, Paper, Chip, Menu, MenuItem, Typography, Button, InputBase } from '@mui/material';
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
      console.log('InstructionsBox: Formatting path for XML tag:', path);
      
      // Extract the path from the project root directory
      // First, split the path by directory separators
      const pathParts = path.split(/[/\\]/);
      
      // In VS Code, we can identify the project root by looking for patterns in the path
      // For example: C:/Users/Matt/Documents/extension/prompt-pilot/src/file.ts
      // We want to extract: src/file.ts
      
      // First, try to find the workspace folder name in the path
      // The workspace folder is typically the last folder before the source files
      
      // Extract potential workspace folder names from the path itself
      // This makes the solution more dynamic and adaptable to different projects
      const potentialWorkspaceFolders = [];
      
      // Look for common patterns to identify workspace folders
      for (const part of pathParts) {
        // Skip system folders and very common names
        if (['c:', 'users', 'documents', 'downloads', 'desktop'].includes(part.toLowerCase())) {
          continue;
        }
        
        // Add potential workspace folders to our candidates list
        potentialWorkspaceFolders.push(part);
      }
      
      // Add some common workspace folder names as fallbacks
      const workspaceFolderCandidates = [
        ...potentialWorkspaceFolders,
        'prompt-pilot', 
        'extension', 
        'sidekick'
      ];
      
      let projectRelativePath = '';
      
      // Try to find the workspace folder in the path
      for (const candidate of workspaceFolderCandidates) {
        const index = pathParts.findIndex(part => 
          part.toLowerCase() === candidate.toLowerCase());
        
        if (index !== -1 && index < pathParts.length - 1) {
          // Found the workspace folder, extract everything after it
          projectRelativePath = pathParts.slice(index + 1).join('.');
          console.log(`InstructionsBox: Found workspace folder "${candidate}" at index ${index}`);
          break;
        }
      }
      
      // If we couldn't find a known workspace folder, use a fallback approach
      if (!projectRelativePath) {
        // Try to find common source folder patterns
        const srcIndex = pathParts.findIndex(part => 
          ['src', 'source', 'app', 'lib', 'web_ui'].includes(part.toLowerCase()));
        
        if (srcIndex !== -1) {
          // Found a source folder, extract from there
          projectRelativePath = pathParts.slice(srcIndex).join('.');
          console.log(`InstructionsBox: Found source folder at index ${srcIndex}`);
        } else {
          // Last resort: just use the filename and its parent directory
          const relevantParts = pathParts.slice(Math.max(0, pathParts.length - 2));
          projectRelativePath = relevantParts.join('.');
          console.log('InstructionsBox: Using fallback path extraction');
        }
      }
      
      console.log('InstructionsBox: Formatted path result:', projectRelativePath);
      return projectRelativePath;
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
      <Paper sx={{ 
        p: 2, 
        display: 'flex',
        flexDirection: 'column',
        height: '50%', // Take up half of the available space
        overflow: 'hidden' // Prevent the paper from scrolling
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2,
          flexShrink: 0 // Prevent this container from shrinking
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
        
        <Box sx={{ 
          flexGrow: 1, 
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Use InputBase with custom styling to match Material-UI's appearance */}
          <Box
            sx={{
              width: '100%',
              height: '100%',
              border: '1px solid rgba(0, 0, 0, 0.23)',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 0, 0, 0.06)', // More accurate Material-UI background color
              overflow: 'hidden',
              '&:hover': {
                borderColor: 'rgba(0, 0, 0, 0.87)'
              },
              '&:focus-within': {
                borderColor: '#1976d2',
                borderWidth: '2px',
                padding: '0'
              },
              padding: '1px',
              transition: 'border-color 0.2s ease-in-out'
            }}
          >
            <InputBase
              multiline
              fullWidth
              placeholder="Enter your instructions here..."
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              sx={{
                height: '100%',
                padding: '13px',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                '& .MuiInputBase-input': {
                  height: '100% !important',
                  overflow: 'auto !important',
                  flexGrow: 1
                }
              }}
              inputProps={{
                style: {
                  height: '100%',
                  overflow: 'auto'
                }
              }}
            />
          </Box>
        </Box>
      </Paper>
    );
  }
);

// Add display name for debugging
InstructionsBox.displayName = 'InstructionsBox';

export default InstructionsBox; 