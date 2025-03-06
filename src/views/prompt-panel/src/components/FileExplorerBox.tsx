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
    if (selectedFiles && selectedFiles.length > 0) {
      console.log("FileExplorerBox: Processing selected files:", selectedFiles);
      handleSelectedFilesUpdate(selectedFiles);
    }
  }, [selectedFiles]);

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

  // Request files on mount
  useEffect(() => {
    if (!hasRequestedFiles.current && onRequestFiles) {
      console.log("FileExplorerBox: Making initial files request");
      onRequestFiles();
      hasRequestedFiles.current = true;
    }
  }, [onRequestFiles]);

  // Handle model changes
  useEffect(() => {
    console.log("FileExplorerBox: Model changed to:", selectedModel);
    if (selectedModel && currentFiles.current.length > 0 && onModelChange) {
      console.log("FileExplorerBox: Requesting retokenization for files:", currentFiles.current);
      onModelChange(selectedModel, currentFiles.current);
    }
  }, [selectedModel, onModelChange]);

  const handleFileDelete = (fileToDelete: string) => {
    console.log("FileExplorerBox: Deleting file:", fileToDelete);
    if (onFileDelete) {
      onFileDelete(fileToDelete);
    } else {
      // Fallback to direct message if no callback provided
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