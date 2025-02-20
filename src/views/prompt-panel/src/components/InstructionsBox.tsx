import React, { useState } from 'react';
import { Box, Paper, Chip, IconButton, Menu, MenuItem, TextField } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const DUMMY_PROMPTS = ['Template 1', 'Template 2', 'Custom Prompt'];

const InstructionsBox = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handlePromptSelect = (prompt: string) => {
    setSelectedPrompts([...selectedPrompts, prompt]);
    handleMenuClose();
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {selectedPrompts.map((prompt, index) => (
            <Chip 
              key={index} 
              label={prompt} 
              onDelete={() => {
                const newPrompts = selectedPrompts.filter((_, i) => i !== index);
                setSelectedPrompts(newPrompts);
              }}
            />
          ))}
        </Box>
        <IconButton onClick={handleMenuClick}>
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {DUMMY_PROMPTS.map((prompt) => (
            <MenuItem key={prompt} onClick={() => handlePromptSelect(prompt)}>
              {prompt}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      
      <TextField
        multiline
        fullWidth
        minRows={10}
        placeholder="Enter your instructions here..."
        variant="outlined"
      />
    </Paper>
  );
};

export default InstructionsBox; 