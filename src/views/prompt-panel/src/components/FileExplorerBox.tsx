import React, { useState, memo, useRef, useEffect } from 'react';
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

interface FileExplorerBoxProps {
  selectedFiles?: SelectedPath[];
  onFileDelete?: (path: string) => void;
  onRequestFiles?: () => void;
  onModelChange?: (model: string, files: SelectedPath[]) => void;
}

const FileExplorerBox: React.FC<FileExplorerBoxProps> = ({ 
  selectedFiles = [], 
  onFileDelete,
  onRequestFiles,
  onModelChange
}) => {
  const vscodeApi = useVSCode();
  const { selectedModel } = useModel();
  const [directoryMap, setDirectoryMap] = useState<DirectoryMap>({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [fileTokens, setFileTokens] = useState<Map<string, number | null>>(new Map());
  const hasRequestedFiles = useRef(false);
  const currentFiles = useRef<SelectedPath[]>([]);

  // Process selected files when they change
  useEffect(() => {
    console.log("FileExplorerBox: selectedFiles changed:", selectedFiles);
    
    // Update our internal state
    currentFiles.current = selectedFiles;
    
    // Process files into directory structure
    const dirMap: DirectoryMap = {};
    const tokenCountsMap = new Map<string, number | null>();
    
    selectedFiles.forEach(file => {
      // Extract directory path using string manipulation
      const pathParts = file.path.split(/[/\\]/);
      pathParts.pop(); // Remove the filename
      const dirPath = pathParts.join('/') || '.';
      
      if (!dirMap[dirPath]) {
        dirMap[dirPath] = [];
      }
      dirMap[dirPath].push(file.path);
      
      // Store token count
      tokenCountsMap.set(file.path, file.tokenCount || null);
    });
    
    console.log("FileExplorerBox: Processed directory map:", dirMap);
    console.log("FileExplorerBox: Token counts map:", tokenCountsMap);
    
    setDirectoryMap(dirMap);
    setFileTokens(tokenCountsMap);
    
    // Expand directories that have files
    const dirsToExpand = new Set(Object.keys(dirMap));
    console.log("FileExplorerBox: Directories to expand:", dirsToExpand);
    setExpandedDirs(dirsToExpand);
  }, [selectedFiles]);

  // Request files on mount
  useEffect(() => {
    if (!hasRequestedFiles.current && onRequestFiles) {
      onRequestFiles();
      hasRequestedFiles.current = true;
    }
  }, [onRequestFiles]);

  // Handle model changes
  useEffect(() => {
    if (selectedModel && currentFiles.current.length > 0 && onModelChange) {
      onModelChange(selectedModel, currentFiles.current);
    }
  }, [selectedModel, onModelChange]);

  const handleFileDelete = (fileToDelete: string) => {
    console.log("FileExplorerBox: handleFileDelete called for:", fileToDelete);
    
    if (onFileDelete) {
      console.log("FileExplorerBox: Calling onFileDelete callback");
      onFileDelete(fileToDelete);
    } else {
      // Fallback to direct message if no callback provided
      console.log("FileExplorerBox: No onFileDelete callback, sending message directly");
      vscodeApi.postMessage({
        type: 'toggleFileSelection',
        action: 'uncheck',
        file: fileToDelete
      });
    }
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
    <Paper sx={{ 
      p: 2,
      display: 'flex',
      flexDirection: 'column',
      height: '50%', // Take up half of the available space
      overflow: 'hidden' // Prevent the paper from scrolling
    }}>
      <Typography variant="h6" sx={{ mb: 2, flexShrink: 0 }}>
        Selected Files
      </Typography>
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 1,
        flexGrow: 1,
        overflow: 'auto' // Make this container scrollable
      }}>
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