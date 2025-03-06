import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef, useCallback } from 'react';
import { Box, Paper, Chip, Menu, MenuItem, Button, InputBase, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FileContents from './FileContents';
import { useVSCode } from '../contexts/VSCodeContext';
import { useModel } from '../contexts/ModelContext';

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
    const vscode = useVSCode();
    const { selectedModel } = useModel();
    
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
    const [totalTokenCount, setTotalTokenCount] = useState<number | null>(null);
    const [isCountingTokens, setIsCountingTokens] = useState(false);
    
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
    const lastTokenCountRequestRef = useRef<string>('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const previousModelRef = useRef<string>(''); // Add ref to track previous model
    
    // Ref for the text input elements
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    
    // Get the combined text content for token counting
    const getCombinedContentForTokenCount = () => {
      return contentBlocks.map(block => {
        if (block.type === 'text') {
          return block.content;
        } else if (block.type === 'file' && block.fileInfo) {
          return block.fileInfo.content;
        }
        return '';
      }).join('\n');
    };
    
    // Request token count from the extension with debouncing
    const requestTokenCount = useCallback(() => {
      
      if (!selectedModel) {
        return;
      }
      
      const combinedContent = getCombinedContentForTokenCount();
      
      // Create a hash of the content to avoid unnecessary requests
      const contentHash = `${selectedModel}:${combinedContent.length}:${contentBlocks.length}`;
      
      // Skip if we've already requested token count for this content
      if (contentHash === lastTokenCountRequestRef.current) {
        return;
      }
      
      lastTokenCountRequestRef.current = contentHash;
      setIsCountingTokens(true);
      
      vscode.postMessage({
        type: 'countInstructionsTokens',
        content: combinedContent,
        model: selectedModel
      });
    }, [contentBlocks, selectedModel, vscode]);
    
    // Debounced token count request - using useRef for the function to avoid dependency issues
    const debouncedRequestRef = useRef<() => void>(() => {});
    
    // Update the debounced request function when dependencies change
    useEffect(() => {
      debouncedRequestRef.current = () => {
        
        // Clear any existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        // Set a new timer for 2 seconds
        debounceTimerRef.current = setTimeout(() => {
          requestTokenCount();
        }, 1500);
      };
    }, [requestTokenCount]);
    
    // Listen for token count response from the extension
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        
        if (message.type === 'instructionsTokenCount') {
          setTotalTokenCount(message.tokenCount);
          setIsCountingTokens(false);
        }
      };
      
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, []);
    
    // Request token count when content changes (with debounce)
    useEffect(() => {
      if (selectedModel) {
        debouncedRequestRef.current();
      }
      
      // Cleanup on unmount
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, [contentBlocks, selectedModel]);
    
    // Request token count immediately when model changes
    useEffect(() => {
      // Only run this effect if the model has actually changed
      if (selectedModel !== previousModelRef.current) {
        console.log(`InstructionsBox: Model actually changed from ${previousModelRef.current} to ${selectedModel}, triggering immediate token count`);
        previousModelRef.current = selectedModel;
        
        if (selectedModel) {
          // Clear any existing timer
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          
          // Request token count immediately - implement logic directly to avoid dependency on requestTokenCount
          const combinedContent = getCombinedContentForTokenCount();
          console.log(`InstructionsBox: Combined content length: ${combinedContent.length}`);
          
          // Create a hash of the content to avoid unnecessary requests
          const contentHash = `${selectedModel}:${combinedContent.length}:${contentBlocks.length}`;
          
          // Skip if we've already requested token count for this content
          if (contentHash !== lastTokenCountRequestRef.current) {
            console.log(`InstructionsBox: Content changed, requesting token count for hash: ${contentHash}`);
            lastTokenCountRequestRef.current = contentHash;
            setIsCountingTokens(true);
            
            vscode.postMessage({
              type: 'countInstructionsTokens',
              content: combinedContent,
              model: selectedModel
            });
          } else {
            console.log("InstructionsBox: Content unchanged, skipping token count request");
          }
        }
      }
    }, [selectedModel, vscode]); // Remove contentBlocks from dependencies
    
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
      console.log("InstructionsBox: addFileContent called for path:", path);
      
      // Check if we already have this file in our content blocks
      const fileExists = contentBlocks.some(block => 
        block.type === 'file' && block.fileInfo?.path === path
      );
      
      console.log("InstructionsBox: File already exists in content blocks?", fileExists);
      
      // If the file already exists in our content blocks, don't add it again
      if (fileExists) {
        console.log("InstructionsBox: File already exists, not adding again");
        return;
      }
      
      // Create a unique ID for this file content
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log("InstructionsBox: Generated file ID:", fileId);
      
      // Update file contents array
      setFileContents(prev => {
        console.log("InstructionsBox: Current fileContents:", prev);
        // Check if this file already exists in our array
        const existingIndex = prev.findIndex(file => file.path === path);
        console.log("InstructionsBox: Existing file index:", existingIndex);
        
        if (existingIndex >= 0) {
          // Replace existing file content
          console.log("InstructionsBox: Replacing existing file content");
          const newContents = [...prev];
          newContents[existingIndex] = { path, content, id: fileId };
          console.log("InstructionsBox: New fileContents:", newContents);
          return newContents;
        } else {
          // Add new file content
          console.log("InstructionsBox: Adding new file content");
          const newContents = [...prev, { path, content, id: fileId }];
          console.log("InstructionsBox: New fileContents:", newContents);
          return newContents;
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
      
      // Trigger debounced token count update instead of immediate
      debouncedRequestRef.current();
    };

    const removeFile = (path: string) => {
      
      // Check if the file exists in fileContents
      const fileExists = fileContents.some(file => file.path === path);
      
      // Check if the file exists in contentBlocks
      const blockExists = contentBlocks.some(block => 
        block.type === 'file' && block.fileInfo?.path === path
      );
      
      if (!fileExists && !blockExists) {
        console.log("InstructionsBox: File not found in either fileContents or contentBlocks, nothing to remove");
        return;
      }
      
      // Remove file from fileContents array
      setFileContents(prev => {
        console.log("InstructionsBox: Current fileContents:", prev);
        const newContents = prev.filter(file => file.path !== path);
        console.log("InstructionsBox: New fileContents after removal:", newContents);
        return newContents;
      });
      
      // Remove the file block from content blocks
      console.log("InstructionsBox: Current contentBlocks:", contentBlocks);
      const newBlocks = contentBlocks.filter(block => {
        if (block.type === 'file' && block.fileInfo?.path === path) {
          console.log("InstructionsBox: Removing block for path:", path);
          return false;
        }
        return true;
      });
      console.log("InstructionsBox: New contentBlocks after removal:", newBlocks);
      
      // If we removed a block, we need to merge adjacent text blocks
      const mergedBlocks: ContentBlock[] = [];
      
      for (let i = 0; i < newBlocks.length; i++) {
        const currentBlock = newBlocks[i];
        
        if (i > 0 && 
            currentBlock.type === 'text' && 
            newBlocks[i-1].type === 'text') {
          // Merge with previous text block
          console.log("InstructionsBox: Merging text blocks");
          const prevBlock = mergedBlocks[mergedBlocks.length - 1];
          prevBlock.content += currentBlock.content;
        } else {
          // Add as a new block
          console.log("InstructionsBox: Adding block to mergedBlocks");
          mergedBlocks.push(currentBlock);
        }
      }
      
      // Ensure we always have at least one text block
      if (mergedBlocks.length === 0) {
        console.log("InstructionsBox: No blocks left, adding empty text block");
        mergedBlocks.push({ type: 'text', content: '' });
      }
      
      console.log("InstructionsBox: Final mergedBlocks:", mergedBlocks);
      setContentBlocks(mergedBlocks);
      
      // Adjust active block index if needed
      if (activeBlockIndex >= mergedBlocks.length) {
        console.log("InstructionsBox: Adjusting activeBlockIndex");
        setActiveBlockIndex(Math.max(0, mergedBlocks.length - 1));
      }
      
      // Call the callback if provided
      if (onRemoveFile) {
        console.log("InstructionsBox: Calling onRemoveFile callback");
        onRemoveFile(path);
      }
      
      // Trigger debounced token count update instead of immediate
      console.log("InstructionsBox: Triggering debounced token count after file removal");
      debouncedRequestRef.current();
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
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
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
            backgroundColor: 'background.paper',
            cursor: 'text',
            position: 'relative'
          }}
          onClick={() => {
            // When clicking anywhere in the paper, focus the last text input block
            // This allows users to click anywhere in the empty space to start typing
            const textBlockIndices = contentBlocks
              .map((block, index) => block.type === 'text' ? index : -1)
              .filter(index => index !== -1);
            
            if (textBlockIndices.length > 0) {
              // Focus the last text block for a natural writing flow
              const lastTextIndex = textBlockIndices[textBlockIndices.length - 1];
              focusInput(lastTextIndex);
              setActiveBlockIndex(lastTextIndex);
            } else {
              // If no text blocks exist (rare case), add one and focus it
              const newTextBlock: ContentBlock = { type: 'text', content: '' };
              const newBlocks = [...contentBlocks, newTextBlock];
              setContentBlocks(newBlocks);
              setActiveBlockIndex(newBlocks.length - 1);
              setTimeout(() => focusInput(newBlocks.length - 1), 0);
            }
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
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              ) : block.type === 'file' && block.fileInfo ? (
                <Box sx={{ my: 0.5, display: 'block' }}
                  onClick={(e) => {
                    // Stop propagation to prevent the Paper's onClick from firing
                    e.stopPropagation();
                  }}
                >
                  <FileContents
                    filePath={block.fileInfo.path}
                    content={block.fileInfo.content}
                    onRemove={removeFile}
                  />
                </Box>
              ) : null}
            </React.Fragment>
          ))}
          
          {/* Token count display */}
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 8, 
              right: 12, 
              display: 'flex', 
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: 1,
              px: 1,
              py: 0.5
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'monospace'
              }}
            >
              {isCountingTokens 
                ? 'Counting tokens...' 
                : totalTokenCount !== null 
                  ? `${totalTokenCount.toLocaleString()} tokens` 
                  : ''}
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }
);

export default InstructionsBox; 