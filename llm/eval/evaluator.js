"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiSurfaceEvaluator = void 0;
const perf_hooks_1 = require("perf_hooks");
class ApiSurfaceEvaluator {
    constructor(goldenDataset, extractApiSurface) {
        this.goldenDataset = goldenDataset;
        this.extractApiSurface = extractApiSurface;
    }
    /**
     * Evaluates the API surface extraction on the entire dataset
     */
    async evaluateAll() {
        // const startTime = performance.now();
        const results = await Promise.all(this.goldenDataset.map(file => this.evaluateSingle(file)));
        return {
            overall: this.calculateOverallMetrics(results),
            detailed: results,
            summary: {
                totalFiles: this.goldenDataset.length,
                successRate: this.calculateSuccessRate(results),
                averageProcessingTime: this.calculateAverageProcessingTime(results),
                totalTokenUsage: this.calculateTotalTokenUsage(results)
            }
        };
    }
    /**
     * Evaluates a single test file
     */
    async evaluateSingle(file) {
        const startTime = perf_hooks_1.performance.now();
        try {
            // Extract API surface
            const extracted = await this.extractApiSurface(file.content);
            // Calculate metrics
            const accuracy = this.computeAccuracy(extracted, file.expected);
            const robustness = this.testRobustness(extracted, file);
            const performance = this.measurePerformance(startTime, extracted);
            return {
                accuracy,
                robustness,
                performance
            };
        }
        catch (error) {
            console.error(`Evaluation failed for file with features: ${file.metadata.features.join(', ')}`, error);
            return this.createErrorEvaluation();
        }
    }
    /**
     * Computes accuracy metrics by comparing extracted and expected API surfaces
     */
    computeAccuracy(extracted, expected) {
        console.log("computeAccuracy: ");
        console.log(extracted);
        console.log(expected);
        return {
            structural: this.computeStructuralAccuracy(extracted, expected),
            content: {
                classes: this.computeClassAccuracy(extracted.classes, expected.classes),
                methods: this.computeMethodAccuracy(extracted, expected),
                functions: this.computeFunctionAccuracy(extracted.functions, expected.functions),
                properties: this.computePropertyAccuracy(extracted, expected),
                descriptions: this.computeDescriptionAccuracy(extracted, expected)
            }
        };
    }
    /**
     * Tests robustness by analyzing edge cases and language-specific features
     */
    testRobustness(extracted, file) {
        return {
            languageSupport: { [file.language]: this.computeLanguageSupport(extracted, file) },
            edgeCaseHandling: this.computeEdgeCaseHandling(extracted, file),
            errorRate: 0 // Will be updated when we implement error tracking
        };
    }
    /**
     * Measures performance metrics
     */
    measurePerformance(startTime, extracted) {
        console.log(extracted);
        return {
            processingTime: perf_hooks_1.performance.now() - startTime,
            tokenUsage: {
                prompt: 0, // Will be implemented when we add token counting
                response: 0,
                total: 0
            },
            memoryUsage: process.memoryUsage().heapUsed
        };
    }
    /**
     * Computes structural accuracy by comparing JSON structures
     */
    computeStructuralAccuracy(extracted, expected) {
        console.log("computeStructuralAccuracy");
        const expectedKeys = this.getAllKeys(expected);
        const extractedKeys = this.getAllKeys(extracted);
        console.log("expectedKeys: ", expectedKeys, "extractedKeys: ", extractedKeys);
        const intersection = expectedKeys.filter(key => extractedKeys.includes(key));
        console.log("intersection: ", intersection);
        return intersection.length / expectedKeys.length;
    }
    /**
     * Gets all keys from an object recursively
     */
    getAllKeys(obj, prefix = '') {
        return Object.entries(obj).flatMap(([key, value]) => {
            const currentKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return [currentKey, ...this.getAllKeys(value, currentKey)];
            }
            return [currentKey];
        });
    }
    /**
     * Computes accuracy for class definitions
     */
    computeClassAccuracy(extracted, expected) {
        if (expected.length === 0) {
            return 1;
        }
        let score = 0;
        for (const expectedClass of expected) {
            const extractedClass = extracted.find(c => c.name === expectedClass.name);
            if (extractedClass) {
                score += this.computeClassSimilarity(extractedClass, expectedClass);
            }
        }
        return score / expected.length;
    }
    /**
     * Computes similarity between two class definitions
     */
    computeClassSimilarity(extracted, expected) {
        const nameMatch = extracted.name === expected.name ? 1 : 0;
        const descriptionMatch = this.computeTextSimilarity(extracted.description, expected.description);
        const methodsMatch = this.computeMethodsArraySimilarity(extracted.methods, expected.methods);
        const propertiesMatch = this.computePropertiesArraySimilarity(extracted.properties, expected.properties);
        return (nameMatch + descriptionMatch + methodsMatch + propertiesMatch) / 4;
    }
    /**
     * Computes text similarity using a simple token-based approach
     */
    computeTextSimilarity(text1, text2) {
        // If both texts are empty or undefined, they are considered identical
        if ((!text1 || text1.trim() === '') && (!text2 || text2.trim() === '')) {
            return 1;
        }
        if (!text1 || !text2) {
            return 0;
        }
        const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
        const tokens2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        return intersection.size / union.size;
    }
    /**
     * Creates an evaluation result for error cases
     */
    createErrorEvaluation() {
        return {
            accuracy: {
                structural: 0,
                content: {
                    classes: 0,
                    methods: 0,
                    functions: 0,
                    properties: 0,
                    descriptions: 0
                }
            },
            robustness: {
                languageSupport: {},
                edgeCaseHandling: 0,
                errorRate: 1
            },
            performance: {
                processingTime: 0,
                tokenUsage: {
                    prompt: 0,
                    response: 0,
                    total: 0
                },
                memoryUsage: 0
            }
        };
    }
    /**
     * Calculates overall metrics from individual results
     */
    calculateOverallMetrics(results) {
        const accuracy = results.reduce((sum, r) => sum + r.accuracy.structural, 0) / results.length;
        const robustness = results.reduce((sum, r) => sum + r.robustness.edgeCaseHandling, 0) / results.length;
        const performance = this.normalizePerformance(results);
        return {
            accuracy,
            robustness,
            performance
        };
    }
    /**
     * Normalizes performance metrics to a 0-1 scale
     */
    normalizePerformance(results) {
        const maxTime = Math.max(...results.map(r => r.performance.processingTime));
        const maxTokens = Math.max(...results.map(r => r.performance.tokenUsage.total));
        if (maxTime === 0 || maxTokens === 0) {
            return 0;
        }
        const timeScores = results.map(r => 1 - (r.performance.processingTime / maxTime));
        const tokenScores = results.map(r => 1 - (r.performance.tokenUsage.total / maxTokens));
        return (timeScores.reduce((a, b) => a + b, 0) / results.length +
            tokenScores.reduce((a, b) => a + b, 0) / results.length) / 2;
    }
    /**
     * Calculates the success rate across all evaluations
     */
    calculateSuccessRate(results) {
        const successful = results.filter(r => r.accuracy.structural > 0).length;
        return successful / results.length;
    }
    /**
     * Calculates the average processing time across all evaluations
     */
    calculateAverageProcessingTime(results) {
        return results.reduce((sum, r) => sum + r.performance.processingTime, 0) / results.length;
    }
    /**
     * Calculates the total token usage across all evaluations
     */
    calculateTotalTokenUsage(results) {
        return results.reduce((sum, r) => sum + r.performance.tokenUsage.total, 0);
    }
    /**
     * Computes accuracy for method definitions across all classes
     */
    computeMethodAccuracy(extracted, expected) {
        const allExpectedMethods = expected.classes.flatMap(c => c.methods);
        const allExtractedMethods = extracted.classes.flatMap(c => c.methods);
        if (allExpectedMethods.length === 0) {
            return 1;
        }
        let totalScore = 0;
        for (const expectedMethod of allExpectedMethods) {
            const extractedMethod = allExtractedMethods.find(m => m.name === expectedMethod.name);
            if (extractedMethod) {
                totalScore += this.computeMethodSimilarity(extractedMethod, expectedMethod);
            }
        }
        return totalScore / allExpectedMethods.length;
    }
    /**
     * Computes accuracy for standalone functions
     */
    computeFunctionAccuracy(extracted, expected) {
        if (expected.length === 0) {
            return 1;
        }
        let totalScore = 0;
        for (const expectedFunc of expected) {
            const extractedFunc = extracted.find(f => f.name === expectedFunc.name);
            if (extractedFunc) {
                totalScore += this.computeFunctionSimilarity(extractedFunc, expectedFunc);
            }
        }
        return totalScore / expected.length;
    }
    /**
     * Computes accuracy for properties across all classes
     */
    computePropertyAccuracy(extracted, expected) {
        const allExpectedProps = expected.classes.flatMap(c => c.properties);
        const allExtractedProps = extracted.classes.flatMap(c => c.properties);
        if (allExpectedProps.length === 0) {
            return 1;
        }
        let totalScore = 0;
        for (const expectedProp of allExpectedProps) {
            const extractedProp = allExtractedProps.find(p => p.name === expectedProp.name);
            if (extractedProp) {
                totalScore += this.computePropertySimilarity(extractedProp, expectedProp);
            }
        }
        return totalScore / allExpectedProps.length;
    }
    /**
     * Computes accuracy for all descriptions (classes, methods, functions, properties)
     */
    computeDescriptionAccuracy(extracted, expected) {
        const descriptions = [
            // Class descriptions
            ...expected.classes.map(ec => {
                const extractedClass = extracted.classes.find(c => c.name === ec.name);
                return [extractedClass?.description, ec.description];
            }),
            // Method descriptions
            ...expected.classes.flatMap(ec => ec.methods.map(em => {
                const extractedClass = extracted.classes.find(c => c.name === ec.name);
                const extractedMethod = extractedClass?.methods.find(m => m.name === em.name);
                return [extractedMethod?.description, em.description];
            })),
            // Function descriptions
            ...expected.functions.map(ef => {
                const extractedFunc = extracted.functions.find(f => f.name === ef.name);
                return [extractedFunc?.description, ef.description];
            }),
            // Property descriptions
            ...expected.classes.flatMap(ec => ec.properties.map(ep => {
                const extractedClass = extracted.classes.find(c => c.name === ec.name);
                const extractedProp = extractedClass?.properties.find(p => p.name === ep.name);
                return [extractedProp?.description, ep.description];
            }))
        ];
        if (descriptions.length === 0) {
            return 1;
        }
        const scores = descriptions.map(([extracted, expected]) => this.computeTextSimilarity(extracted || '', expected || ''));
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    /**
     * Computes language-specific support score based on features and edge cases
     */
    computeLanguageSupport(extracted, file) {
        // Calculate how well the extractor handles language-specific features
        const languageFeatures = this.getLanguageFeatures(file.language);
        const detectedFeatures = this.detectFeatures(extracted);
        const expectedFeatureCount = languageFeatures.length;
        if (expectedFeatureCount === 0) {
            return 1;
        }
        const detectedFeatureCount = languageFeatures.filter(f => detectedFeatures.includes(f)).length;
        return detectedFeatureCount / expectedFeatureCount;
    }
    /**
     * Computes how well the extractor handles edge cases
     */
    computeEdgeCaseHandling(extracted, file) {
        if (file.metadata.edgeCases.length === 0) {
            return 1;
        }
        // For each edge case, check if it was handled correctly
        const edgeCaseScores = file.metadata.edgeCases.map(edgeCase => {
            switch (edgeCase) {
                case 'nested-classes':
                    return this.checkNestedClassHandling(extracted);
                case 'multiple-inheritance':
                    return this.checkMultipleInheritanceHandling(extracted);
                case 'decorators':
                    return this.checkDecoratorHandling(extracted);
                case 'generics':
                    return this.checkGenericsHandling(extracted);
                default:
                    return 0;
            }
        });
        return edgeCaseScores.reduce((a, b) => a + b, 0) / edgeCaseScores.length;
    }
    /**
     * Computes similarity between arrays of method definitions
     */
    computeMethodsArraySimilarity(extracted, expected) {
        if (expected.length === 0) {
            return 1;
        }
        let totalScore = 0;
        for (const expectedMethod of expected) {
            const extractedMethod = extracted.find(m => m.name === expectedMethod.name);
            if (extractedMethod) {
                totalScore += this.computeMethodSimilarity(extractedMethod, expectedMethod);
            }
        }
        return totalScore / expected.length;
    }
    /**
     * Computes similarity between arrays of property definitions
     */
    computePropertiesArraySimilarity(extracted, expected) {
        if (expected.length === 0) {
            return 1;
        }
        let totalScore = 0;
        for (const expectedProp of expected) {
            const extractedProp = extracted.find(p => p.name === expectedProp.name);
            if (extractedProp) {
                totalScore += this.computePropertySimilarity(extractedProp, expectedProp);
            }
        }
        return totalScore / expected.length;
    }
    /**
     * Helper method to compute similarity between two method definitions
     */
    computeMethodSimilarity(extracted, expected) {
        const nameMatch = extracted.name === expected.name ? 1 : 0;
        const returnTypeMatch = extracted.return_type === expected.return_type ? 1 : 0;
        const descriptionMatch = this.computeTextSimilarity(extracted.description, expected.description);
        const argumentsMatch = this.computeArgumentsSimilarity(extracted.arguments, expected.arguments);
        return (nameMatch + returnTypeMatch + descriptionMatch + argumentsMatch) / 4;
    }
    /**
     * Helper method to compute similarity between two function definitions
     */
    computeFunctionSimilarity(extracted, expected) {
        const nameMatch = extracted.name === expected.name ? 1 : 0;
        const returnTypeMatch = extracted.return_type === expected.return_type ? 1 : 0;
        const descriptionMatch = this.computeTextSimilarity(extracted.description, expected.description);
        const argumentsMatch = this.computeArgumentsSimilarity(extracted.arguments, expected.arguments);
        return (nameMatch + returnTypeMatch + descriptionMatch + argumentsMatch) / 4;
    }
    /**
     * Helper method to compute similarity between two property definitions
     */
    computePropertySimilarity(extracted, expected) {
        const nameMatch = extracted.name === expected.name ? 1 : 0;
        const typeMatch = extracted.type === expected.type ? 1 : 0;
        const descriptionMatch = this.computeTextSimilarity(extracted.description, expected.description);
        return (nameMatch + typeMatch + descriptionMatch) / 3;
    }
    /**
     * Helper method to compute similarity between arrays of argument definitions
     */
    computeArgumentsSimilarity(extracted, expected) {
        if (expected.length === 0) {
            return 1;
        }
        let totalScore = 0;
        for (const expectedArg of expected) {
            const extractedArg = extracted.find(a => a.name === expectedArg.name);
            if (extractedArg) {
                const nameMatch = extractedArg.name === expectedArg.name ? 1 : 0;
                const typeMatch = extractedArg.type === expectedArg.type ? 1 : 0;
                totalScore += (nameMatch + typeMatch) / 2;
            }
        }
        return totalScore / expected.length;
    }
    /**
     * Helper method to get language-specific features
     */
    getLanguageFeatures(language) {
        switch (language.toLowerCase()) {
            case 'typescript':
                return ['interfaces', 'decorators', 'type-annotations', 'generics', 'enums'];
            case 'python':
                return ['decorators', 'type-hints', 'docstrings', 'dataclasses', 'async-await'];
            case 'javascript':
                return ['classes', 'async-await', 'jsdoc', 'static-methods', 'getters-setters'];
            default:
                return [];
        }
    }
    /**
     * Helper method to detect features in extracted API surface
     */
    detectFeatures(surface) {
        const features = new Set();
        // Analyze classes
        for (const cls of surface.classes) {
            if (cls.description?.includes('@decorator')) {
                features.add('decorators');
            }
            if (cls.methods.some(m => m.name.startsWith('get') || m.name.startsWith('set'))) {
                features.add('getters-setters');
            }
            if (cls.methods.some(m => m.name.includes('static'))) {
                features.add('static-methods');
            }
            if (cls.description?.includes('@dataclass')) {
                features.add('dataclasses');
            }
        }
        // Analyze types
        const allTypes = [
            ...surface.functions.flatMap(f => [f.return_type, ...f.arguments.map(a => a.type)]),
            ...surface.classes.flatMap(c => [
                ...c.methods.flatMap(m => [m.return_type, ...m.arguments.map(a => a.type)]),
                ...c.properties.map(p => p.type)
            ])
        ];
        if (allTypes.some(t => t.includes('<') && t.includes('>'))) {
            features.add('generics');
        }
        if (allTypes.some(t => t !== 'any' && t !== 'unknown')) {
            features.add('type-annotations');
        }
        if (allTypes.some(t => t.startsWith('Promise<'))) {
            features.add('async-await');
        }
        return Array.from(features);
    }
    /**
     * Helper methods for edge case detection
     */
    checkNestedClassHandling(_surface) {
        // Implementation would check for proper nested class extraction
        return 0;
    }
    checkMultipleInheritanceHandling(_surface) {
        // Implementation would check for proper inheritance chain extraction
        return 0;
    }
    checkDecoratorHandling(_surface) {
        // Implementation would check for proper decorator extraction
        return 0;
    }
    checkGenericsHandling(_surface) {
        // Implementation would check for proper generic type extraction
        return 0;
    }
}
exports.ApiSurfaceEvaluator = ApiSurfaceEvaluator;
//# sourceMappingURL=evaluator.js.map