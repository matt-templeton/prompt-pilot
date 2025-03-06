import React, { createContext, useContext, useState } from 'react';

interface ModelContextType {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [selectedModel, setSelectedModel] = useState('');
  
  console.log("DEBUG: ModelProvider rendered");
  
  // Add a custom setter that logs when the model changes
  const setSelectedModelWithLogging = (model: string) => {
    console.log("DEBUG: setSelectedModel called with:", model);
    setSelectedModel(model);
  };

  return (
    <ModelContext.Provider value={{ selectedModel, setSelectedModel: setSelectedModelWithLogging }}>
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = () => {
  console.log("DEBUG: useModel hook called");
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}; 