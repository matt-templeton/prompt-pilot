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
        setApiSurface(prev => ({
          ...prev,
          useApiSurface: message.useApiSurface,
          // Update token count if provided
          apiSurfaceTokens: message.tokens !== undefined ? message.tokens : prev.apiSurfaceTokens
        }));
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [path]);

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
    
    setApiSurface(prev => ({ ...prev, useApiSurface }));
    
    vscode.postMessage({
      type: 'toggleApiSurfaceUsage',
      path,
      useApiSurface
    });
  };

  // Get filename from path
  const filename = path.split(/[/\\]/).pop() || path;
  
  // Determine which token count to show
  const displayTokenCount = apiSurface.useApiSurface ? apiSurface.apiSurfaceTokens : tokenCount;
  
  // Debug logging for token count display
  React.useEffect(() => {
    console.log(`FilePill: Display token count for ${filename}:`, {
      useApiSurface: apiSurface.useApiSurface,
      apiSurfaceTokens: apiSurface.apiSurfaceTokens,
      fullTokenCount: tokenCount,
      displayTokenCount
    });
  }, [apiSurface.useApiSurface, apiSurface.apiSurfaceTokens, tokenCount, filename]);

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