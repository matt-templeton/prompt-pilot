import React from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FilePill from './FilePill';

interface DirectoryProps {
  fullPath: string;
  files: string[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onFileDelete: (file: string) => void;
  tokenCounts: Map<string, number | null>;
}

const Directory: React.FC<DirectoryProps> = ({
  fullPath,
  files,
  isExpanded,
  onToggleExpand,
  onFileDelete,
  tokenCounts
}) => {
  // Get just the last part of the path for display
  const displayName = fullPath === '.' 
    ? 'Root' 
    : fullPath.split(/[/\\]/).pop() || fullPath;

  return (
    <Box>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          gap: 1,
          mb: 1
        }}
        onClick={onToggleExpand}
      >
        {isExpanded 
          ? <KeyboardArrowDownIcon fontSize="small" />
          : <KeyboardArrowRightIcon fontSize="small" />
        }
        <Typography variant="subtitle2">
          {displayName}
        </Typography>
      </Box>
      
      <Collapse in={isExpanded}>
        <Box sx={{ 
          display: 'flex', 
          gap: 2,
          flexWrap: 'wrap',
          ml: 4,
          mb: 1,
          width: 'calc(100% - 32px)'
        }}>
          {files.map((file) => {
            const filename = file.split(/[/\\]/).pop() || '';
            const tokenCount = tokenCounts.get(file) ?? null;
            return (
              <FilePill
                key={file}
                filename={filename}
                directory={fullPath}
                tokenCount={tokenCount}
                onDelete={() => onFileDelete(file)}
              />
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default Directory; 