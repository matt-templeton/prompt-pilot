import React, { useState } from 'react';
import { Box, Tab, Tabs, ThemeProvider, createTheme } from '@mui/material';
import './App.css';
import ComposeTab from './components/ComposeTab';
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
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box className="App">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Compose" />
            <Tab label="Plan" />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <ComposeTab />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {/* <PlanTab /> */}
        </TabPanel>
      </Box>
    </ThemeProvider>
  );
}

export default App;
