import React, { useState, useEffect } from 'react';
import { Box, Collapse, Paper, Typography, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import { useVSCode } from '../contexts/VSCodeContext';

interface ApiSurfaceInfo {
  exists: boolean;
  useApiSurface: boolean;
  content: string;
  tokenCount: number | null;
}

interface FileContentsProps {
  filePath: string;
  content: string;
  onRemove?: (path: string) => void;
  tokenCount?: number | null;
  apiSurface?: ApiSurfaceInfo;
  onCheckApiSurface?: (path: string) => void;
}

const FileContents: React.FC<FileContentsProps> = ({ 
  filePath, 
  content, 
  onRemove, 
  tokenCount,
  apiSurface = {
    exists: false,
    useApiSurface: false,
    content: '',
    tokenCount: null
  },
  onCheckApiSurface
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const vscode = useVSCode();
  
  // Extract just the filename from the path
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  
  // Request API surface check on mount if callback is provided
  useEffect(() => {
    if (onCheckApiSurface) {
      onCheckApiSurface(filePath);
    } else {
      // Fallback to direct message if no callback provided
      vscode.postMessage({
        type: 'checkApiSurface',
        path: filePath
      });
    }
  }, [filePath, vscode, onCheckApiSurface]);
  
  // Add a listener for API surface content updates
  useEffect(() => {
    const processedMessageIds = new Set<string>();
    
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      // Skip if no message or no type
      if (!message || !message.type) {
        return;
      }
      
      // Skip if this message has already been processed (using ID if available)
      const messageId = message.id || `${message.type}:${message.path}`;
      if (processedMessageIds.has(messageId)) {
        return;
      }
      
      // Mark this message as processed
      processedMessageIds.add(messageId);
      
      // Limit the size of the processed messages set
      if (processedMessageIds.size > 100) {
        // Convert to array, remove oldest entries, convert back to set
        const messagesArray = Array.from(processedMessageIds);
        processedMessageIds.clear();
        messagesArray.slice(messagesArray.length - 50).forEach(id => processedMessageIds.add(id));
      }
      
      // Handle API surface content updates
      if (message.type === 'apiSurfaceContent' && message.path === filePath) {
        console.log(`FileContents: Received apiSurfaceContent for ${filePath}`, message);
        // This is handled by the parent component through props, but we can log it
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [filePath]);
  
  // Log when apiSurface prop changes
  useEffect(() => {
    console.log(`FileContents: apiSurface prop changed for ${fileName}:`, apiSurface);
  }, [apiSurface, fileName]);
  
  // Log when content prop changes
  useEffect(() => {
    console.log(`FileContents: content prop changed for ${fileName}, length: ${content.length}`);
  }, [content, fileName]);
  
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
  const displayTokenCount = apiSurface.useApiSurface && apiSurface.tokenCount !== null 
    ? apiSurface.tokenCount 
    : tokenCount;
  
  // Debug logging for token count display
  useEffect(() => {
    console.log(`FileContents: Display token count for ${fileName}:`, {
      useApiSurface: apiSurface.useApiSurface,
      apiSurfaceTokens: apiSurface.tokenCount,
      fullTokenCount: tokenCount,
      displayTokenCount
    });
  }, [apiSurface.useApiSurface, apiSurface.tokenCount, tokenCount, fileName, displayTokenCount]);
  
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
          {/* Token count display - Show either token count or "Calculating..." */}
          <Typography 
            variant="caption" 
            sx={{ 
              mr: 1,
              color: headerTextColor,
              opacity: 0.8,
              fontSize: '0.7rem'
            }}
          >
            {displayTokenCount !== null ? `${displayTokenCount} tokens` : 'Calculating...'}
          </Typography>
          
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