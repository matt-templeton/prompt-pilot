import React, { useState, useEffect } from 'react';
import { Box, Tab, Tabs, ThemeProvider, createTheme } from '@mui/material';
import './App.css';
import ComposeTab from './components/ComposeTab';
import SettingsTab from './components/SettingsTab';
import { VSCodeProvider, useVSCode } from './contexts/VSCodeContext';
import { ModelProvider } from './contexts/ModelContext';
// import PlanTab from './components/PlanTab';

// Create theme that uses VSCode colors
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      // Use a fallback color in case the CSS variable isn't available
      main: '#0098ff', // Default blue color
    },
    background: {
      default: '#1e1e1e', // Default dark background
      paper: '#252526', // Default dark paper background
    },
    text: {
      primary: '#ffffff', // Default white text
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          '&:hover': {
            backgroundColor: 'var(--vscode-button-hoverBackground)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-editor-foreground)',
        },
      },
    },
  },
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

function App() {
  console.log("App: Component mounting");
  const [tabValue, setTabValue] = useState(0);
  const vscodeApi = useVSCode();

  useEffect(() => {
    console.log("App: Initial mount effect");
    
    // Send a message to the extension that the webview is ready
    console.log("App: Sending webviewReady message");
    vscodeApi.postMessage({ type: 'webviewReady' });
  }, [vscodeApi]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <ModelProvider>
      <VSCodeProvider>
        <ThemeProvider theme={theme}>
          <Box className="App">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Compose" />
                <Tab label="Plan" />
                <Tab label="Settings" />
              </Tabs>
            </Box>
            
            <TabPanel value={tabValue} index={0}>
              <ComposeTab />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              {/* <PlanTab /> */}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <SettingsTab />
            </TabPanel>
          </Box>
        </ThemeProvider>
      </VSCodeProvider>
    </ModelProvider>
  );
}

export default App;
