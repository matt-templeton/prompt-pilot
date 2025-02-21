import React, { memo } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FilePill from './FilePill';

interface DirectoryProps {
  fullPath: string;
  files: string[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onFileDelete: (path: string) => void;
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
            // const filename = file.split(/[/\\]/).pop() || '';
            const tokenCount = tokenCounts.get(file) ?? null;
            return (
              <FilePill
                key={file}
                path={file}
                tokenCount={tokenCount}
                onDelete={onFileDelete}
              />
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

// Export memoized version with custom comparison
export default memo(Directory, (prevProps, nextProps) => {
  return (
    prevProps.fullPath === nextProps.fullPath &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.onToggleExpand === nextProps.onToggleExpand &&
    prevProps.onFileDelete === nextProps.onFileDelete &&
    prevProps.files.length === nextProps.files.length &&
    prevProps.files.every((file, i) => file === nextProps.files[i]) &&
    areMapsEqual(prevProps.tokenCounts, nextProps.tokenCounts)
  );
});

// Helper function to compare Maps
function areMapsEqual(map1: Map<string, number | null>, map2: Map<string, number | null>): boolean {
  if (map1.size !== map2.size) {
    return false;
  }
  
  return Array.from(map1.entries()).every(([key, value]) => 
    map2.get(key) === value
  );
} 