import React, { createContext, useContext } from 'react';


declare global {
    interface Window {
        _vscodeApi: ReturnType<typeof acquireVsCodeApi>;
    }
}

const VSCodeContext = createContext<ReturnType<typeof acquireVsCodeApi>>(window._vscodeApi);

interface VSCodeProviderProps {
  children: React.ReactNode;
}
export function VSCodeProvider({ children }: VSCodeProviderProps) {
    return (
        <VSCodeContext.Provider value={window._vscodeApi}>
            {children}
        </VSCodeContext.Provider>
    );
}

export function useVSCode() {
    const context = useContext(VSCodeContext);
    if (!context) {
        throw new Error('useVSCode must be used within a VSCodeProvider');
    }
    return context;
} 