import React, { useState } from 'react';
import { Box, Collapse, Paper, Typography, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';

interface FileContentsProps {
  filePath: string;
  content: string;
  onRemove?: (path: string) => void;
}

const FileContents: React.FC<FileContentsProps> = ({ filePath, content, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Extract just the filename from the path
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  
  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };
  
  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onRemove) {
      onRemove(filePath);
    }
  };
  
  // Determine styles based on expanded state
  const headerBgColor = expanded ? 'primary.light' : 'action.hover';
  const headerTextColor = expanded ? 'common.white' : 'text.primary';
  const iconColor = expanded ? 'common.white' : 'text.secondary';
  const buttonColor = expanded ? 'common.white' : 'inherit';
  const borderColor = expanded ? 'primary.light' : 'divider';
  
  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        border: '1px solid',
        borderColor: borderColor,
        mb: 0.5,
        mt: 0.5,
        display: 'inline-block',
        width: '100%',
        '&:hover': {
          borderColor: 'primary.main',
        }
      }}
    >
      {/* Header - Always visible */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          py: 0.5,
          px: 0.75,
          backgroundColor: headerBgColor,
          cursor: 'pointer',
        }}
        onClick={handleToggleExpand}
      >
        <CodeIcon sx={{ mr: 0.5, fontSize: '0.9rem', color: iconColor }} />
        <Typography 
          variant="body2" 
          sx={{ 
            flexGrow: 1,
            fontWeight: 'medium',
            color: headerTextColor,
            fontFamily: 'monospace',
            fontSize: '0.8rem'
          }}
        >
          {fileName}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {onRemove && (
            <IconButton 
              size="small" 
              onClick={handleRemove}
              sx={{ 
                p: 0.25,
                mr: 0.25,
                color: buttonColor,
                '& svg': {
                  fontSize: '0.9rem'
                }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton 
            size="small"
            sx={{ 
              p: 0.25,
              color: buttonColor,
              '& svg': {
                fontSize: '0.9rem'
              }
            }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>
      
      {/* Collapsible content */}
      <Collapse in={expanded}>
        <Box 
          sx={{ 
            p: 1,
            backgroundColor: 'background.paper',
            maxHeight: '200px',
            overflow: 'auto',
            borderTop: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography 
            variant="body2" 
            component="pre"
            sx={{ 
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              m: 0,
              fontSize: '0.75rem'
            }}
          >
            {content}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default FileContents; 