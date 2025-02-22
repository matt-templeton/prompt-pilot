export interface ApiSurface {
  classes: ClassDefinition[];
  functions: FunctionDefinition[];
}

export interface ClassDefinition {
  name: string;
  description: string;
  methods: MethodDefinition[];
  properties: PropertyDefinition[];
}

export interface MethodDefinition {
  name: string;
  arguments: ArgumentDefinition[];
  return_type: string;
  description: string;
}

export interface FunctionDefinition {
  name: string;
  arguments: ArgumentDefinition[];
  return_type: string;
  description: string;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  description: string;
}

export interface ArgumentDefinition {
  name: string;
  type: string;
}

export interface SingleEvaluation {
  accuracy: AccuracyMetrics;
  robustness: RobustnessMetrics;
  performance: PerformanceMetrics;
}

export interface AccuracyMetrics {
  structural: number;  // 0-1 score
  content: {
    classes: number;
    methods: number;
    functions: number;
    properties: number;
    descriptions: number;
  };
}

export interface RobustnessMetrics {
  languageSupport: Record<string, number>;
  edgeCaseHandling: number;
  errorRate: number;
}

export interface PerformanceMetrics {
  processingTime: number;  // milliseconds
  tokenUsage: {
    prompt: number;
    response: number;
    total: number;
  };
  memoryUsage: number;  // bytes
}

export interface EvaluationResult {
  overall: {
    accuracy: number;
    robustness: number;
    performance: number;
  };
  detailed: SingleEvaluation[];
  summary: {
    totalFiles: number;
    successRate: number;
    averageProcessingTime: number;
    totalTokenUsage: number;
  };
}

export interface TestFile {
  content: string;
  expected: ApiSurface;
  language: string;
  complexity: 'simple' | 'medium' | 'complex';
  metadata: {
    source?: string;
    features: string[];
    edgeCases: string[];
  };
} 