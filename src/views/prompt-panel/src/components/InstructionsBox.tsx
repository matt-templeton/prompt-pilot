import React, { useState } from 'react';
import { Box, Paper, Chip, Menu, MenuItem, TextField, Typography, Button } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

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

  const handlePromptDelete = (indexToDelete: number) => {
    const newPrompts = selectedPrompts.filter((_, index) => index !== indexToDelete);
    setSelectedPrompts(newPrompts);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">Instructions</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {selectedPrompts.map((prompt, index) => (
              <Chip 
                key={index} 
                label={prompt} 
                onDelete={() => handlePromptDelete(index)}
                size="small"
              />
            ))}
          </Box>
        </Box>
        
        <Button
          onClick={handleMenuClick}
          endIcon={<KeyboardArrowDownIcon />}
          variant="outlined"
          size="small"
        >
          Prompts
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {DUMMY_PROMPTS.map((prompt) => (
            <MenuItem 
              key={prompt} 
              onClick={() => handlePromptSelect(prompt)}
            >
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