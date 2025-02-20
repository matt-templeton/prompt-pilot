import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import Directory from './Directory';

// Get vscode API
const vscodeApi = acquireVsCodeApi();

interface DirectoryMap {
  [fullPath: string]: string[];
}

const FileExplorerBox = () => {
  const [directoryMap, setDirectoryMap] = useState<DirectoryMap>({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log('FileExplorerBox: Setting up message listener');
    
    const messageHandler = (event: MessageEvent) => {
      console.log('FileExplorerBox: Received message:', event.data);
      const message = event.data;
      
      if (message.type === 'selectedFiles') {
        handleSelectedFilesUpdate(message.files);
      }
    };

    window.addEventListener('message', messageHandler);
    vscodeApi.postMessage({ type: 'getSelectedFiles' });

    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const handleSelectedFilesUpdate = (files: string[]) => {
    // Create new directory map
    const newDirectoryMap: DirectoryMap = {};
    
    files.forEach(file => {
      const pathParts = file.split(/[/\\]/);
      pathParts.pop(); // Remove filename
      const dirPath = pathParts.join('/') || '.';
      
      if (!newDirectoryMap[dirPath]) {
        newDirectoryMap[dirPath] = [];
      }
      newDirectoryMap[dirPath].push(file);
    });

    setDirectoryMap(newDirectoryMap);
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

  const handleFileDelete = (fileToDelete: string) => {
    vscodeApi.postMessage({
      type: 'toggleFileSelection',
      file: fileToDelete
    });
  };

  // Sort directories so root comes first, then alphabetically by full path
  const sortedDirectories = Object.keys(directoryMap).sort((a, b) => {
    if (a === '.') return -1;
    if (b === '.') return 1;
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
          />
        ))}
      </Box>
    </Paper>
  );
};

export default FileExplorerBox; 