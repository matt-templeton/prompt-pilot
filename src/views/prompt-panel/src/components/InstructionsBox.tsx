import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { Box, Paper, Chip, Menu, MenuItem, Button, InputBase } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FileContents from './FileContents';

const DUMMY_PROMPTS = ['Template 1', 'Template 2', 'Custom Prompt'];

interface FileContent {
  path: string;
  content: string;
  id: string; // Unique identifier for each file content block
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

// Custom type for our rich content blocks
interface ContentBlock {
  type: 'text' | 'file';
  content: string;
  fileInfo?: FileContent;
}

const InstructionsBox = forwardRef<InstructionsBoxHandle, InstructionsBoxProps>(
  ({ onAddFileContent, onRemoveFile, fileContent, removedFilePath }, ref) => {
    console.log("InstructionsBox: Component rendering with ref:", !!ref);
    console.log("InstructionsBox: Received fileContent prop:", fileContent);
    console.log("InstructionsBox: Received removedFilePath prop:", removedFilePath);
    
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
    
    // Instead of a single text state, we'll use an array of content blocks
    const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([
      { type: 'text', content: '' }
    ]);
    
    // Track the current active block index where the cursor is
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    
    // Store file contents separately for reference
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fileContents, setFileContents] = useState<FileContent[]>([]);
    
    // Use refs to track processed files and prevent infinite loops
    const processedFilesRef = useRef<Set<string>>(new Set());
    const processedRemovalsRef = useRef<Set<string>>(new Set());
    const lastFileContentRef = useRef<{ path: string; content: string } | null>(null);
    
    // Ref for the text input elements
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    
    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
      setAnchorEl(null);
    };

    const handlePromptSelect = (prompt: string) => {
      setSelectedPrompts([...selectedPrompts, prompt]);
      handleMenuClose();
      
      // Insert the prompt template at the current active block
      insertTextAtActiveBlock(prompt + '\n\n');
    };

    const handlePromptDelete = (indexToDelete: number) => {
      const newPrompts = selectedPrompts.filter((_, index) => index !== indexToDelete);
      setSelectedPrompts(newPrompts);
    };
    
    // Insert text at the current active block
    const insertTextAtActiveBlock = (text: string) => {
      const newBlocks = [...contentBlocks];
      const activeBlock = newBlocks[activeBlockIndex];
      
      if (activeBlock.type === 'text') {
        activeBlock.content += text;
        setContentBlocks(newBlocks);
      }
    };
    
    // Focus the input at the specified index
    const focusInput = (index: number) => {
      setTimeout(() => {
        if (inputRefs.current[index]) {
          inputRefs.current[index]?.focus();
        }
      }, 0);
    };

    // Process fileContent prop when it changes - now just for tracking purposes
    useEffect(() => {
      if (fileContent && fileContent.path && fileContent.content) {
        // Check if we've already processed this exact file content
        const fileContentKey = `${fileContent.path}:${fileContent.content.length}`;
        
        // Just track that we've seen this file content
        if (!processedFilesRef.current.has(fileContentKey)) {
          processedFilesRef.current.add(fileContentKey);
          lastFileContentRef.current = fileContent;
          
          // Note: We don't call addFileContent here anymore
          // It's called directly via ref from the parent component (ComposeTab)
        }
      }
    }, [fileContent]);

    // Process removedFilePath prop when it changes
    useEffect(() => {
      if (removedFilePath) {
        // Check if we've already processed this removal
        if (!processedRemovalsRef.current.has(removedFilePath)) {
          processedRemovalsRef.current.add(removedFilePath);
          
          // Remove the file content
          removeFile(removedFilePath);
        }
      }
    }, [removedFilePath]);

    // Public method to add file content
    const addFileContent = (path: string, content: string) => {
      console.log('InstructionsBox: addFileContent called with path:', path);
      
      // Check if we already have this file in our content blocks
      const fileExists = contentBlocks.some(block => 
        block.type === 'file' && block.fileInfo?.path === path
      );
      
      // If the file already exists in our content blocks, don't add it again
      if (fileExists) {
        console.log('InstructionsBox: File already exists in content blocks, skipping addition:', path);
        return;
      }
      
      // Create a unique ID for this file content
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Update file contents array
      setFileContents(prev => {
        // Check if this file already exists in our array
        const existingIndex = prev.findIndex(file => file.path === path);
        if (existingIndex >= 0) {
          // Replace existing file content
          const newContents = [...prev];
          newContents[existingIndex] = { path, content, id: fileId };
          return newContents;
        } else {
          // Add new file content
          return [...prev, { path, content, id: fileId }];
        }
      });
      
      // Insert the file content at the current cursor position
      // Split the current text block into two parts and insert the file block in between
      const newBlocks = [...contentBlocks];
      const activeBlock = newBlocks[activeBlockIndex];
      
      if (activeBlock.type === 'text') {
        // Create a new file content block
        const fileBlock: ContentBlock = {
          type: 'file',
          content: '',
          fileInfo: { path, content, id: fileId }
        };
        
        // Split the current text block if needed
        if (activeBlock.content.length > 0) {
          // Insert the file block after the current block
          newBlocks.splice(activeBlockIndex + 1, 0, fileBlock);
          
          // Add an empty text block after the file block if we're not at the end
          if (activeBlockIndex === newBlocks.length - 2) {
            newBlocks.push({ type: 'text', content: '' });
          }
          
          // Set the new active block to the one after the file
          setActiveBlockIndex(activeBlockIndex + 2);
        } else {
          // Replace the empty block with the file block and add a new empty block after
          newBlocks[activeBlockIndex] = fileBlock;
          newBlocks.splice(activeBlockIndex + 1, 0, { type: 'text', content: '' });
          
          // Set the new active block to the one after the file
          setActiveBlockIndex(activeBlockIndex + 1);
        }
        
        setContentBlocks(newBlocks);
        
        // Focus the next text input
        focusInput(activeBlockIndex + 1);
      }
      
      // Call the callback if provided
      if (onAddFileContent) {
        onAddFileContent(path, content);
      }
    };

    const removeFile = (path: string) => {
      console.log('InstructionsBox: removeFile called with path:', path);
      
      // Remove file from fileContents array
      setFileContents(prev => prev.filter(file => file.path !== path));
      
      // Remove the file block from content blocks
      const newBlocks = contentBlocks.filter(block => {
        if (block.type === 'file' && block.fileInfo?.path === path) {
          return false;
        }
        return true;
      });
      
      // If we removed a block, we need to merge adjacent text blocks
      const mergedBlocks: ContentBlock[] = [];
      
      for (let i = 0; i < newBlocks.length; i++) {
        const currentBlock = newBlocks[i];
        
        if (i > 0 && 
            currentBlock.type === 'text' && 
            newBlocks[i-1].type === 'text') {
          // Merge with previous text block
          const prevBlock = mergedBlocks[mergedBlocks.length - 1];
          prevBlock.content += currentBlock.content;
        } else {
          // Add as a new block
          mergedBlocks.push(currentBlock);
        }
      }
      
      // Ensure we always have at least one text block
      if (mergedBlocks.length === 0) {
        mergedBlocks.push({ type: 'text', content: '' });
      }
      
      setContentBlocks(mergedBlocks);
      
      // Adjust active block index if needed
      if (activeBlockIndex >= mergedBlocks.length) {
        setActiveBlockIndex(Math.max(0, mergedBlocks.length - 1));
      }
      
      // Call the callback if provided
      if (onRemoveFile) {
        onRemoveFile(path);
      }
    };
    
    // Handle text input change
    const handleTextChange = (index: number, value: string) => {
      const newBlocks = [...contentBlocks];
      if (newBlocks[index].type === 'text') {
        newBlocks[index].content = value;
        setContentBlocks(newBlocks);
      }
    };
    
    // Handle focus on a text block
    const handleFocus = (index: number) => {
      setActiveBlockIndex(index);
    };
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      addFileContent,
      removeFile
    }));
    
    // Get the combined text content (for debugging or submission)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getCombinedContent = () => {
      return contentBlocks.map(block => {
        if (block.type === 'text') {
          return block.content;
        } else if (block.type === 'file') {
          return `[FILE: ${block.fileInfo?.path}]`;
        }
        return '';
      }).join('');
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleMenuClick}
            sx={{ mr: 1 }}
          >
            Add Template
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            {DUMMY_PROMPTS.map((prompt, index) => (
              <MenuItem key={index} onClick={() => handlePromptSelect(prompt)}>
                {prompt}
              </MenuItem>
            ))}
          </Menu>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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
        
        <Paper
          variant="outlined"
          sx={{
            flexGrow: 1,
            p: 1.5,
            overflowY: 'auto',
            minHeight: '200px',
            backgroundColor: 'background.paper'
          }}
        >
          {/* Render content blocks */}
          {contentBlocks.map((block, index) => (
            <React.Fragment key={index}>
              {block.type === 'text' ? (
                <InputBase
                  multiline
                  fullWidth
                  placeholder={index === 0 ? "Enter instructions here..." : ""}
                  value={block.content}
                  onChange={(e) => handleTextChange(index, e.target.value)}
                  onFocus={() => handleFocus(index)}
                  inputRef={el => inputRefs.current[index] = el}
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    width: '100%',
                    minHeight: '1.5rem'
                  }}
                />
              ) : block.type === 'file' && block.fileInfo ? (
                <Box sx={{ my: 0.5, display: 'block' }}>
                  <FileContents
                    filePath={block.fileInfo.path}
                    content={block.fileInfo.content}
                    onRemove={removeFile}
                  />
                </Box>
              ) : null}
            </React.Fragment>
          ))}
        </Paper>
      </Box>
    );
  }
);

export default InstructionsBox; 