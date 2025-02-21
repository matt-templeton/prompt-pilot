import React, { createContext, useContext } from 'react';

console.log("HERE");

declare global {
    interface Window {
        _vscodeApi: ReturnType<typeof acquireVsCodeApi>;
    }
}

const VSCodeContext = createContext<ReturnType<typeof acquireVsCodeApi>>(window._vscodeApi);
console.log(VSCodeContext);

interface VSCodeProviderProps {
  children: React.ReactNode;
}
console.log("MAKING IT HERE?");
export function VSCodeProvider({ children }: VSCodeProviderProps) {
    console.log("IN VSCodeProvider: ", VSCodeContext);
    return (
        <VSCodeContext.Provider value={window._vscodeApi}>
            {children}
        </VSCodeContext.Provider>
    );
}

export function useVSCode() {
    console.log("useVSCode: ", VSCodeContext);
    const context = useContext(VSCodeContext);
    if (!context) {
        throw new Error('useVSCode must be used within a VSCodeProvider');
    }
    return context;
} 