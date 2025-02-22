import { ApiSurfaceEvaluator } from './src/evaluator';
import { TestFile, ApiSurface } from './src/types';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

describe('ApiSurfaceEvaluator', () => {
  let evaluator: ApiSurfaceEvaluator;
  let mockExtractor: jest.MockedFunction<(content: string) => Promise<ApiSurface>>;
  let testDataset: TestFile[];

  beforeEach(() => {
    // Create a simple test dataset
    testDataset = [
      {
        content: `
          class TestClass {
            constructor(private x: number) {}
            public method(y: string): boolean {
              return true;
            }
          }
        `,
        expected: {
          classes: [{
            name: 'TestClass',
            description: '',
            methods: [{
              name: 'method',
              arguments: [{ name: 'y', type: 'string' }],
              return_type: 'boolean',
              description: ''
            }],
            properties: [{
              name: 'x',
              type: 'number',
              description: ''
            }]
          }],
          functions: []
        },
        language: 'typescript',
        complexity: 'simple',
        metadata: {
          features: ['class', 'method', 'property'],
          edgeCases: []
        }
      }
    ];

    // Create a mock extractor that returns the expected output
    mockExtractor = jest.fn<(content: string) => Promise<ApiSurface>>((content: string) => {
      const testFile = testDataset.find(file => file.content === content);
      return Promise.resolve(testFile?.expected || { classes: [], functions: [] });
    });

    evaluator = new ApiSurfaceEvaluator(testDataset, mockExtractor);
  });

  describe('evaluateAll', () => {
    it('should evaluate all files in the dataset', async () => {
      const result = await evaluator.evaluateAll();
      
      expect(result).toBeDefined();
      expect(result.summary.totalFiles).toBe(testDataset.length);
      expect(result.summary.successRate).toBe(1);
      expect(result.detailed).toHaveLength(testDataset.length);
    });

    it('should handle extraction failures gracefully', async () => {
      mockExtractor.mockRejectedValueOnce(new Error('Extraction failed'));
      
      const result = await evaluator.evaluateAll();
      
      expect(result.summary.successRate).toBe(0);
      expect(result.detailed[0].accuracy.structural).toBe(0);
    });
  });

  describe('structural accuracy', () => {
    it('should compute perfect accuracy for identical structures', async () => {
      const result = await evaluator.evaluateAll();
      
      expect(result.detailed[0].accuracy.structural).toBe(1);
    });

    it('should reflect missing content in accuracy scores', async () => {
      mockExtractor.mockImplementationOnce(async () => ({
        classes: [{
          name: 'TestClass',
          description: '',
          methods: [],  // Missing methods
          properties: []  // Missing properties
        }],
        functions: []
      }));

      const result = await evaluator.evaluateAll();
      
      // The structural accuracy should still be 1 since all required keys are present
      expect(result.detailed[0].accuracy.structural).toBe(1);
      
      // But the content accuracy scores should reflect the missing methods and properties
      expect(result.detailed[0].accuracy.content.methods).toBe(0);
      expect(result.detailed[0].accuracy.content.properties).toBe(0);
    });
  });

  describe('performance metrics', () => {
    it('should track processing time', async () => {
      const result = await evaluator.evaluateAll();
      
      expect(result.detailed[0].performance.processingTime).toBeGreaterThan(0);
    });

    it('should track memory usage', async () => {
      const result = await evaluator.evaluateAll();
      
      expect(result.detailed[0].performance.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('method accuracy', () => {
    it('should compute perfect accuracy for identical methods', async () => {
      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].accuracy.content.methods).toBe(1);
    });

    it('should handle missing methods', async () => {
      mockExtractor.mockImplementationOnce(async () => ({
        classes: [{
          name: 'TestClass',
          description: '',
          methods: [],
          properties: [{
            name: 'x',
            type: 'number',
            description: ''
          }]
        }],
        functions: []
      }));

      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].accuracy.content.methods).toBe(0);
    });

    it('should handle method signature mismatches', async () => {
      mockExtractor.mockImplementationOnce(async () => ({
        classes: [{
          name: 'TestClass',
          description: '',
          methods: [{
            name: 'method',
            arguments: [{ name: 'y', type: 'number' }], // Wrong type
            return_type: 'string', // Wrong return type
            description: ''
          }],
          properties: [{
            name: 'x',
            type: 'number',
            description: ''
          }]
        }],
        functions: []
      }));

      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].accuracy.content.methods).toBeLessThan(1);
      expect(result.detailed[0].accuracy.content.methods).toBeGreaterThan(0);
    });
  });

  describe('property accuracy', () => {
    it('should compute perfect accuracy for identical properties', async () => {
      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].accuracy.content.properties).toBe(1);
    });

    it('should handle missing properties', async () => {
      mockExtractor.mockImplementationOnce(async () => ({
        classes: [{
          name: 'TestClass',
          description: '',
          methods: [{
            name: 'method',
            arguments: [{ name: 'y', type: 'string' }],
            return_type: 'boolean',
            description: ''
          }],
          properties: []
        }],
        functions: []
      }));

      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].accuracy.content.properties).toBe(0);
    });

    it('should handle property type mismatches', async () => {
      mockExtractor.mockImplementationOnce(async () => ({
        classes: [{
          name: 'TestClass',
          description: '',
          methods: [{
            name: 'method',
            arguments: [{ name: 'y', type: 'string' }],
            return_type: 'boolean',
            description: ''
          }],
          properties: [{
            name: 'x',
            type: 'string', // Wrong type
            description: ''
          }]
        }],
        functions: []
      }));

      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].accuracy.content.properties).toBeLessThan(1);
      expect(result.detailed[0].accuracy.content.properties).toBeGreaterThan(0);
    });
  });

  describe('description accuracy', () => {
    it('should compute perfect accuracy for identical descriptions', async () => {
      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].accuracy.content.descriptions).toBe(1);
    });

    it('should handle missing descriptions', async () => {
      const testDatasetWithDesc = [{
        ...testDataset[0],
        expected: {
          classes: [{
            name: 'TestClass',
            description: 'A test class', // Added description
            methods: [{
              name: 'method',
              arguments: [{ name: 'y', type: 'string' }],
              return_type: 'boolean',
              description: 'A test method' // Added description
            }],
            properties: [{
              name: 'x',
              type: 'number',
              description: 'A test property' // Added description
            }]
          }],
          functions: []
        }
      }];

      const evaluatorWithDesc = new ApiSurfaceEvaluator(testDatasetWithDesc, mockExtractor);
      const result = await evaluatorWithDesc.evaluateAll();
      expect(result.detailed[0].accuracy.content.descriptions).toBeLessThan(1);
    });

    it('should handle similar but not identical descriptions', async () => {
      const testDatasetWithDesc = [{
        ...testDataset[0],
        expected: {
          classes: [{
            name: 'TestClass',
            description: 'A test class',
            methods: [{
              name: 'method',
              arguments: [{ name: 'y', type: 'string' }],
              return_type: 'boolean',
              description: 'A test method'
            }],
            properties: [{
              name: 'x',
              type: 'number',
              description: 'A test property'
            }]
          }],
          functions: []
        }
      }];

      mockExtractor.mockImplementationOnce(async () => ({
        classes: [{
          name: 'TestClass',
          description: 'A class for testing', // Similar but different
          methods: [{
            name: 'method',
            arguments: [{ name: 'y', type: 'string' }],
            return_type: 'boolean',
            description: 'Method for testing' // Similar but different
          }],
          properties: [{
            name: 'x',
            type: 'number',
            description: 'Property for testing' // Similar but different
          }]
        }],
        functions: []
      }));

      const evaluatorWithDesc = new ApiSurfaceEvaluator(testDatasetWithDesc, mockExtractor);
      const result = await evaluatorWithDesc.evaluateAll();
      expect(result.detailed[0].accuracy.content.descriptions).toBeLessThan(1);
      expect(result.detailed[0].accuracy.content.descriptions).toBeGreaterThan(0);
    });
  });

  describe('language support', () => {
    it('should detect TypeScript features', async () => {
      mockExtractor.mockImplementationOnce(async () => ({
        classes: [{
          name: 'TestClass',
          description: '@decorator\nA test class',
          methods: [{
            name: 'method',
            arguments: [{ name: 'y', type: 'Array<string>' }],
            return_type: 'Promise<boolean>',
            description: ''
          }],
          properties: [{
            name: 'x',
            type: 'number',
            description: ''
          }]
        }],
        functions: []
      }));

      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].robustness.languageSupport['typescript']).toBeGreaterThan(0);
    });
  });

  describe('edge case handling', () => {
    it('should evaluate edge cases when present', async () => {
      const testDatasetWithEdgeCases = [{
        ...testDataset[0],
        metadata: {
          features: ['class', 'method', 'property'],
          edgeCases: ['nested-classes', 'decorators']
        }
      }];

      const evaluatorWithEdgeCases = new ApiSurfaceEvaluator(testDatasetWithEdgeCases, mockExtractor);
      const result = await evaluatorWithEdgeCases.evaluateAll();
      expect(result.detailed[0].robustness.edgeCaseHandling).toBeDefined();
    });

    it('should return perfect score when no edge cases are specified', async () => {
      const result = await evaluator.evaluateAll();
      expect(result.detailed[0].robustness.edgeCaseHandling).toBe(1);
    });
  });
}); 