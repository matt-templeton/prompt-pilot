import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FilePill from './FilePill';

// Get vscode API
const vscodeApi = acquireVsCodeApi();

interface FileGroup {
  directory: string;
  files: string[];
}

const FileExplorerBox = () => {
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log('FileExplorerBox: Setting up message listener');
    
    const messageHandler = (event: MessageEvent) => {
        console.log('FileExplorerBox: Received message:', event.data);
        const message = event.data;
        if (message.type === 'selectedFiles') {
            console.log('FileExplorerBox: Updating file groups with:', message.files);
            const groups = groupFilesByDirectory(message.files);
            setFileGroups(groups);
        }
    };

    window.addEventListener('message', messageHandler);

    // Use vscodeApi instead of vscode
    console.log('FileExplorerBox: Requesting initial selected files');
    vscodeApi.postMessage({ type: 'getSelectedFiles' });

    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const groupFilesByDirectory = (files: string[]): FileGroup[] => {
    const groups = new Map<string, string[]>();
    
    files.forEach(file => {
      const directory = file.split('/').slice(0, -1).join('/') || '.';
      if (!groups.has(directory)) {
        groups.set(directory, []);
      }
      groups.get(directory)!.push(file);
    });

    return Array.from(groups.entries()).map(([directory, files]) => ({
      directory,
      files
    }));
  };

  const toggleDirectory = (directory: string) => {
    console.log("toggleDirectory called!");
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
    // Use vscodeApi here too
    vscodeApi.postMessage({
      type: 'toggleFileSelection',
      file: fileToDelete
    });
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Selected Files
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {fileGroups.map(({ directory, files }) => (
          <Box key={directory}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                gap: 1,
                mb: 1
              }}
              onClick={() => toggleDirectory(directory)}
            >
              {expandedDirs.has(directory) 
                ? <KeyboardArrowDownIcon fontSize="small" />
                : <KeyboardArrowRightIcon fontSize="small" />
              }
              <Typography variant="subtitle2">
                {directory === '.' ? 'Root' : directory}
              </Typography>
            </Box>
            
            <Collapse in={expandedDirs.has(directory)}>
              <Box sx={{ 
                display: 'flex', 
                gap: 2,
                flexWrap: 'wrap',
                ml: 4,
                mb: 1,
                width: 'calc(100% - 32px)'
              }}>
                {files.map((file) => {
                  const dummyTokenCount = +(Math.random() * 1.9 + 0.1).toFixed(1);
                  const filename = file.split(/[/\\]/).pop() || '';
                  
                  return (
                    <FilePill
                      key={file}
                      filename={filename}
                      tokenCount={dummyTokenCount}
                      onDelete={() => handleFileDelete(file)}
                    />
                  );
                })}
              </Box>
            </Collapse>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default FileExplorerBox; 