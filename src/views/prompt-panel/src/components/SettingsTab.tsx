import React, { useState, useEffect } from 'react';
import { 
    Box, 
    TextField, 
    Typography, 
    Button,
    InputAdornment,
    IconButton
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useVSCode } from '../contexts/VSCodeContext';

interface ApiKeys {
    openaiApiKey: string;
    anthropicApiKey: string;
}

// Update to use the WebviewMessage interface
// interface SettingsMessage extends WebviewMessage {
//     type: 'settings';
//     settings: {
//         openaiApiKey?: string;
//         anthropicApiKey?: string;
//     };
// }

const SettingsTab = () => {
    const vscodeApi = useVSCode();
    const [apiKeys, setApiKeys] = useState<ApiKeys>({
        openaiApiKey: '',
        anthropicApiKey: ''
    });
    const [showOpenAI, setShowOpenAI] = useState(false);
    const [showAnthropic, setShowAnthropic] = useState(false);

    useEffect(() => {
        vscodeApi.postMessage({ type: 'getSettings' });
    }, [vscodeApi]);

    useEffect(() => {
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'settings':
                    setApiKeys({
                        openaiApiKey: message.settings.openaiApiKey || '',
                        anthropicApiKey: message.settings.anthropicApiKey || ''
                    });
                    break;
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, [vscodeApi]);

    const handleSave = () => {
        vscodeApi.postMessage({
            type: 'updateSettings',
            settings: apiKeys
        });
    };

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6">API Settings</Typography>
            
            <TextField
                label="OpenAI API Key"
                fullWidth
                type={showOpenAI ? 'text' : 'password'}
                value={apiKeys.openaiApiKey}
                onChange={(e) => setApiKeys({
                    ...apiKeys,
                    openaiApiKey: e.target.value
                })}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                onClick={() => setShowOpenAI(!showOpenAI)}
                                edge="end"
                            >
                                {showOpenAI ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
            />

            <TextField
                label="Anthropic API Key"
                fullWidth
                type={showAnthropic ? 'text' : 'password'}
                value={apiKeys.anthropicApiKey}
                onChange={(e) => setApiKeys({
                    ...apiKeys,
                    anthropicApiKey: e.target.value
                })}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                onClick={() => setShowAnthropic(!showAnthropic)}
                                edge="end"
                            >
                                {showAnthropic ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
            />

            <Button 
                variant="contained" 
                color="primary"
                onClick={handleSave}
            >
                Save Settings
            </Button>
        </Box>
    );
};

export default SettingsTab; 