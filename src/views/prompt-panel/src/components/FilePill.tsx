import React from 'react';
import { Chip, Box, Typography, Tooltip, IconButton, Checkbox, CircularProgress } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExtractIcon from '@mui/icons-material/AccountTree'; // This icon suggests structure/extraction
import { useVSCode } from '../contexts/VSCodeContext';

interface FilePillProps {
  path: string;
  onDelete: (path: string) => void;
  tokenCount: number | null;
}

interface ApiSurfaceState {
  exists: boolean;
  useApiSurface: boolean;
  apiSurfaceTokens: number | null;
  isExtracting: boolean;
}

const FilePill: React.FC<FilePillProps> = ({ path, onDelete, tokenCount }) => {
  const vscode = useVSCode();
  const [apiSurface, setApiSurface] = React.useState<ApiSurfaceState>({
    exists: false,
    useApiSurface: false,
    apiSurfaceTokens: null,
    isExtracting: false
  });
  
  // Add a ref to track processed message IDs
  const processedMessageIds = React.useRef<Set<string>>(new Set());
  
  // Check if API surface exists on mount
  React.useEffect(() => {
    vscode.postMessage({
      type: 'checkApiSurface',
      path
    });
  }, [path, vscode]);

  // Listen for API surface status updates
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      
      // Skip if no message or no type
      if (!message || !message.type) {
        return;
      }
      
      // Skip if this message has already been processed (using ID if available)
      const messageId = message.id || `${message.type}:${message.path}`;
      if (processedMessageIds.current.has(messageId)) {
        return;
      }
      
      // Mark this message as processed
      processedMessageIds.current.add(messageId);
      
      // Limit the size of the processed messages set
      if (processedMessageIds.current.size > 100) {
        // Convert to array, remove oldest entries, convert back to set
        const messagesArray = Array.from(processedMessageIds.current);
        processedMessageIds.current = new Set(messagesArray.slice(messagesArray.length - 50));
      }
      
      // Handle API surface status updates
      if (message.type === 'apiSurfaceStatus' && message.path === path) {
        console.log(`FilePill: Received apiSurfaceStatus for ${path}`, message);
        setApiSurface(prev => ({
          ...prev,
          exists: message.exists,
          apiSurfaceTokens: message.tokens !== undefined ? message.tokens : prev.apiSurfaceTokens,
          isExtracting: false
        }));
      }
      
      // Handle API surface usage changes
      else if (message.type === 'apiSurfaceUsageChanged' && message.path === path) {
        console.log(`FilePill: Received apiSurfaceUsageChanged for ${path}`, message);
        
        // Log the current state before update
        console.log(`FilePill: Before update - useApiSurface: ${apiSurface.useApiSurface}, tokens: ${message.tokens}`);
        
        setApiSurface(prev => {
          // IMPORTANT: Don't update apiSurfaceTokens if tokens is null and we already have a value
          const newState = {
            ...prev,
            useApiSurface: message.useApiSurface,
            // Only update token count if provided and not null, otherwise keep existing value
            apiSurfaceTokens: (message.tokens !== undefined && message.tokens !== null) 
              ? message.tokens 
              : prev.apiSurfaceTokens
          };
          
          console.log(`FilePill: After update - useApiSurface: ${newState.useApiSurface}, tokens: ${newState.apiSurfaceTokens}`);
          return newState;
        });
      }
      
      // Handle file token count updates
      else if (message.type === 'fileTokenCount' && message.path === path) {
        console.log(`FilePill: Received fileTokenCount for ${path}`, message);
        // This is handled by the parent component through props, but we can log it
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [path]);

  // Add a useEffect to log when tokenCount prop changes
  React.useEffect(() => {
    console.log(`FilePill: tokenCount prop changed for ${path}:`, tokenCount);
  }, [tokenCount, path]);

  // Add a useEffect to log when apiSurface state changes
  React.useEffect(() => {
    console.log(`FilePill: apiSurface state changed for ${path}:`, apiSurface);
  }, [apiSurface, path]);

  const handleExtractClick = () => {
    setApiSurface(prev => ({ ...prev, isExtracting: true }));
    vscode.postMessage({
      type: 'extractApiSurface',
      path
    });
  };

  const handleSurfaceToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const useApiSurface = event.target.checked;
    console.log(`FilePill: Toggle API surface usage for ${path} to ${useApiSurface}`);
    console.log(`FilePill: Current token counts - Full: ${tokenCount}, API Surface: ${apiSurface.apiSurfaceTokens}`);
    
    // Update local state immediately for responsive UI
    setApiSurface(prev => {
      // When toggling, make sure we have the correct token counts
      const newState = { 
        ...prev, 
        useApiSurface,
        // Make sure we preserve the API surface token count
        apiSurfaceTokens: prev.apiSurfaceTokens !== null ? prev.apiSurfaceTokens : tokenCount
      };
      
      console.log(`FilePill: Immediately updating local state - useApiSurface: ${newState.useApiSurface}, apiSurfaceTokens: ${newState.apiSurfaceTokens}`);
      return newState;
    });
    
    // Send message to backend
    vscode.postMessage({
      type: 'toggleApiSurfaceUsage',
      path,
      useApiSurface
    });
  };

  // Get filename from path
  const filename = path.split(/[/\\]/).pop() || path;
  
  // Determine which token count to show
  const displayTokenCount = apiSurface.useApiSurface && apiSurface.apiSurfaceTokens !== null 
    ? apiSurface.apiSurfaceTokens 
    : tokenCount;
  
  // Debug logging for token count display
  React.useEffect(() => {
    console.log(`FilePill: Display token count for ${filename}:`, {
      useApiSurface: apiSurface.useApiSurface,
      apiSurfaceTokens: apiSurface.apiSurfaceTokens,
      fullTokenCount: tokenCount,
      displayTokenCount
    });
  }, [apiSurface.useApiSurface, apiSurface.apiSurfaceTokens, tokenCount, filename, displayTokenCount]);

  return (
    <Chip
      icon={
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
          <InsertDriveFileIcon sx={{ fontSize: 16 }} />
          {apiSurface.exists && (
            <Checkbox
              size="small"
              checked={apiSurface.useApiSurface}
              onChange={handleSurfaceToggle}
              onClick={e => e.stopPropagation()}
              sx={{ ml: 0.5 }}
            />
          )}
        </Box>
      }
      label={
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          ml: 1,
          width: '100%'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 1
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
            {apiSurface.isExtracting ? (
              <CircularProgress size={16} />
            ) : (
              <Tooltip title="Extract API Surface">
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExtractClick();
                  }}
                >
                  <ExtractIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '0.75rem',
              mt: 0.5
            }}
          >
            {displayTokenCount !== null ? `${displayTokenCount} tokens` : 'Calculating...'}
          </Typography>
        </Box>
      }
      onDelete={() => onDelete(path)}
      sx={{
        height: 'auto',
        width: 'calc(50% - 8px)',
        '& .MuiChip-label': {
          display: 'block',
          padding: '8px 4px',
          width: '100%'
        },
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        }
      }}
    />
  );
};

export default React.memo(FilePill); 