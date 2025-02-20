import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import InstructionsBox from './InstructionsBox';
import FileExplorerBox from './FileExplorerBox';

const ComposeTab = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100vh' }}>
      <InstructionsBox />
      <FileExplorerBox />
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1 }}>
        <Button variant="contained" color="primary">
          Copy
        </Button>
        <Typography variant="body2">
          Tokens: 0/2000
        </Typography>
      </Box>
    </Box>
  );
};

export default ComposeTab; 