import React, { useEffect, useState, memo } from 'react';
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
  const [initialized, setInitialized] = useState(false);

  const handleSelectedFilesUpdate = (files: SelectedPath[]) => {
    const newDirectoryMap: DirectoryMap = {};
    const newFileTokens = new Map<string, number | null>();
    
    files.forEach(({path, tokenCount}) => {
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

    setDirectoryMap(newDirectoryMap);
    setFileTokens(newFileTokens);
    
    // Update expanded dirs
    const newDirs = Object.keys(newDirectoryMap);
    setExpandedDirs(prev => {
      const next = new Set(prev);
      newDirs.forEach(dir => next.add(dir));
      return next;
    });
  };

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log("=== FILEEXPLORERBOX MESSAGE ===", message);
      
      if (message.type === 'selectedFiles') {
        console.log("Handling selectedFiles message:", message.files);
        handleSelectedFilesUpdate(message.files);
        setInitialized(true);
      }
    };

    window.addEventListener('message', messageHandler);
    console.log("=== FILEEXPLORERBOX MOUNTED ===");
    
    // Only request files if we haven't received any yet
    if (!initialized && Object.keys(directoryMap).length === 0) {
      vscodeApi.postMessage({ type: 'getSelectedFiles' });
    }

    return () => {
      console.log("=== FILEEXPLORERBOX UNMOUNTED ===");
      window.removeEventListener('message', messageHandler);
    };
  }, [vscodeApi, initialized, directoryMap, selectedModel]);

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
export default memo(FileExplorerBox, (prevProps, nextProps) => {
  // Since we currently have no props, return true to only update on state changes
  console.log(prevProps, nextProps);
  return true;
}); 