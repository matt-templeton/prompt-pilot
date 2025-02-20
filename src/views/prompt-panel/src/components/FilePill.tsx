import React from 'react';
import { Chip, Box, Typography } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

interface FilePillProps {
  filename: string;
  tokenCount: number;
  onDelete: () => void;
}

const FilePill: React.FC<FilePillProps> = ({ filename, tokenCount, onDelete }) => {
  return (
    <Chip
      icon={
        <InsertDriveFileIcon 
          sx={{ 
            fontSize: 16,
            ml: 1
          }} 
        />
      }
      label={
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          ml: 1,
          width: '100%' // Ensure the content takes full width
        }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontSize: '0.875rem',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {filename}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '0.75rem',
              mt: 0.5
            }}
          >
            ~{tokenCount}k tokens
          </Typography>
        </Box>
      }
      onDelete={onDelete}
      sx={{
        height: 'auto',
        width: 'calc(50% - 8px)', // Set width to 50% minus half the gap
        '& .MuiChip-label': {
          display: 'block',
          padding: '8px 4px',
          width: '100%' // Ensure the label takes full width
        },
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        }
      }}
    />
  );
};

export default FilePill; 