import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';

const DUMMY_FILES = [
  'src/index.ts',
  'src/components/App.tsx',
  'src/utils/helpers.ts',
];

const FileExplorerBox = () => {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Selected Files
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {DUMMY_FILES.map((file) => (
          <Chip 
            key={file} 
            label={file} 
            onDelete={() => {}}
          />
        ))}
      </Box>
    </Paper>
  );
};

export default FileExplorerBox; 