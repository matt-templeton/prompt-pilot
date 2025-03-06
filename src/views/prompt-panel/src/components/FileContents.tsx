import React, { useState, useEffect, useRef } from 'react';
import { Box, Collapse, Paper, Typography, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import { useVSCode } from '../contexts/VSCodeContext';

interface FileContentsProps {
  filePath: string;
  content: string;
  onRemove?: (path: string) => void;
  tokenCount?: number | null;
}

const FileContents: React.FC<FileContentsProps> = ({ filePath, content, onRemove, tokenCount }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const vscode = useVSCode();
  const [apiSurface, setApiSurface] = useState({
    exists: false,
    useApiSurface: false,
    content: '',
    tokenCount: null as number | null
  });
  
  // Add a ref to track processed message IDs
  const processedMessageIds = useRef<Set<string>>(new Set());
  
  // Extract just the filename from the path
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      
      // Skip if no message ID or we've already processed this message
      if (!message.id) {
        // For messages without IDs, generate one based on content
        message.id = `${message.type}:${message.path}:${Date.now()}`;
      }
      
      if (processedMessageIds.current.has(message.id)) {
        return;
      }
      
      // Mark this message as processed
      processedMessageIds.current.add(message.id);
      
      // Limit the size of the processed messages set
      if (processedMessageIds.current.size > 100) {
        // Convert to array, remove oldest entries, convert back to set
        const messagesArray = Array.from(processedMessageIds.current);
        processedMessageIds.current = new Set(messagesArray.slice(messagesArray.length - 50));
      }
      
      if (message.type === 'apiSurfaceStatus' && message.path === filePath) {
        setApiSurface(prev => ({
          ...prev,
          exists: message.exists,
          tokenCount: message.tokens || null
        }));
        
        // If API surface exists, request its content
        if (message.exists) {
          vscode.postMessage({
            type: 'getApiSurfaceContent',
            path: filePath
          });
        }
      } else if (message.type === 'apiSurfaceContent' && message.path === filePath) {
        setApiSurface(prev => ({
          ...prev,
          content: message.content
        }));
      } else if (message.type === 'apiSurfaceUsageChanged' && message.path === filePath) {
        console.log(`FileContents: Received apiSurfaceUsageChanged for ${filePath}`, message);
        setApiSurface(prev => ({
          ...prev,
          useApiSurface: message.useApiSurface,
          // Update token count if provided
          tokenCount: message.tokens !== undefined ? message.tokens : prev.tokenCount
        }));
      }
    };

    window.addEventListener('message', handler);
    
    // Check if API surface exists on mount
    vscode.postMessage({
      type: 'checkApiSurface',
      path: filePath
    });
    
    return () => window.removeEventListener('message', handler);
  }, [filePath, vscode]);
  
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onRemove) {
      onRemove(filePath);
    }
  };
  
  // Determine styles based on expanded state
  const headerBgColor = isExpanded ? 'primary.light' : 'action.hover';
  const headerTextColor = isExpanded ? 'common.white' : 'text.primary';
  const iconColor = isExpanded ? 'common.white' : 'text.secondary';
  const buttonColor = isExpanded ? 'common.white' : 'inherit';
  const borderColor = isExpanded ? 'primary.light' : 'divider';
  
  // Determine which content and token count to display
  const displayContent = apiSurface.useApiSurface && apiSurface.content ? apiSurface.content : content;
  const displayTokenCount = apiSurface.useApiSurface ? apiSurface.tokenCount : tokenCount;
  
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
          {/* Token count display */}
          {displayTokenCount !== null && (
            <Typography 
              variant="caption" 
              sx={{ 
                mr: 1,
                color: headerTextColor,
                opacity: 0.8,
                fontSize: '0.7rem'
              }}
            >
              {displayTokenCount} tokens
            </Typography>
          )}
          
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
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>
      
      {/* Collapsible content */}
      <Collapse in={isExpanded}>
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
            {displayContent}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default FileContents; 