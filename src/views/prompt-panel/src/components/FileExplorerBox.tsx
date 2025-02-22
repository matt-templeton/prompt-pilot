import React, { useEffect, useState, memo, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import Directory from './Directory';
import { useVSCode } from '../contexts/VSCodeContext';
import { useModel } from '../contexts/ModelContext';

type DirectoryMap = Record<string, string[]>;

interface SelectedPath {
  path: string;
  isDirectory: boolean;
  tokenCount?: number | null;
}

const FileExplorerBox: React.FC = () => {
  const vscodeApi = useVSCode();
  const { selectedModel } = useModel();
  const [directoryMap, setDirectoryMap] = useState<DirectoryMap>({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [fileTokens, setFileTokens] = useState<Map<string, number | null>>(new Map());
  const hasRequestedFiles = useRef(false);
  const currentFiles = useRef<SelectedPath[]>([]);

  const handleSelectedFilesUpdate = (files: SelectedPath[]) => {
    console.log("FileExplorerBox: Starting files update with:", files);

    // Store current files for retokenization
    currentFiles.current = files;

    // Always process the update, even if files is empty
    const newDirectoryMap: DirectoryMap = {};
    const newFileTokens = new Map<string, number | null>();
    
    if (files && files.length > 0) {
      files.forEach(({path, tokenCount}) => {
        console.log("FileExplorerBox: Processing file:", path);
        const pathParts = path.split(/[/\\]/);
        pathParts.pop();
        const dirPath = pathParts.join('/') || '.';
        
        if (!newDirectoryMap[dirPath]) {
          newDirectoryMap[dirPath] = [];
        }
        newDirectoryMap[dirPath].push(path);
        
        // Store token count if provided
        if (tokenCount !== undefined) {
          newFileTokens.set(path, tokenCount);
        }
      });
    }

    console.log("FileExplorerBox: New directory map:", newDirectoryMap);
    setDirectoryMap(newDirectoryMap);
    setFileTokens(newFileTokens);
    
    // Update expanded dirs
    const newDirs = Object.keys(newDirectoryMap);
    console.log("FileExplorerBox: Updating expanded directories:", newDirs);
    setExpandedDirs(prev => {
      const next = new Set(prev);
      newDirs.forEach(dir => next.add(dir));
      return next;
    });
  };

  // Handle file selection messages
  useEffect(() => {
    console.log("FileExplorerBox: Setting up message handler");

    const messageHandler = (event: MessageEvent) => {
      console.log("FileExplorerBox: Raw message event:", event);
      const message = event.data;
      console.log("FileExplorerBox: Parsed message:", message);
      
      if (message.type === 'selectedFiles') {
        console.log("FileExplorerBox: Handling selectedFiles message:", message.files);
        handleSelectedFilesUpdate(message.files);
      }
    };

    window.addEventListener('message', messageHandler);
    
    // Only request files once on mount
    if (!hasRequestedFiles.current) {
      console.log("FileExplorerBox: Making initial files request");
      vscodeApi.postMessage({ 
          type: 'getSelectedFiles',
          action: 'get'
      });
      hasRequestedFiles.current = true;
    }

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [vscodeApi]);

  // Handle model changes
  useEffect(() => {
    console.log("FileExplorerBox: Model changed to:", selectedModel);
    if (selectedModel && currentFiles.current.length > 0) {
        console.log("FileExplorerBox: Requesting retokenization for files:", currentFiles.current);
        vscodeApi.postMessage({
            type: 'selectedFiles',
            action: 'update',
            files: currentFiles.current,
            model: selectedModel
        });
    }
  }, [selectedModel, vscodeApi]);

  const handleFileDelete = (fileToDelete: string) => {
    vscodeApi.postMessage({
      type: 'toggleFileSelection',
      action: 'uncheck',
      file: fileToDelete
    });
  };

  const toggleDirectory = (directory: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(directory)) {
        next.delete(directory);
      } else {
        next.add(directory);
      }
      return next;
    });
  };

  // Sort directories so root comes first, then alphabetically by full path
  const sortedDirectories = Object.keys(directoryMap).sort((a, b) => {
    if (a === '.') {return -1;}
    if (b === '.') {return 1;}
    return a.localeCompare(b);
  });

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Selected Files
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sortedDirectories.map(dirPath => (
          <Directory
            key={dirPath}
            fullPath={dirPath}
            files={directoryMap[dirPath]}
            isExpanded={expandedDirs.has(dirPath)}
            onToggleExpand={() => toggleDirectory(dirPath)}
            onFileDelete={handleFileDelete}
            tokenCounts={fileTokens}
          />
        ))}
      </Box>
    </Paper>
  );
};

// Export memoized version
export default memo(FileExplorerBox); 