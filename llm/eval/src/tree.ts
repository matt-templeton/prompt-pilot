import dotenv from 'dotenv';
import Parser from 'tree-sitter';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function loadLanguage(language: string) {
    const langModule = await import(`tree-sitter-${language}`);
    return langModule;
}

// Load parser for a specific language
async function loadParser(language: string) {
    const parser = new Parser();
    const langModule = await loadLanguage(language);
    console.log(langModule);
    if (language == 'typescript') {
      parser.setLanguage(langModule.default.typescript);
    } else {
      parser.setLanguage(langModule.default);
    }
    return parser;
  }

// Function to find all nodes of a specific type
function findNodesByType(node: Parser.SyntaxNode, nodeType: string): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];
    
    // Check if the current node is of the specified type
    if (node.type === nodeType) {
        results.push(node);
    }
    
    // Recursively search through all children
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
            results.push(...findNodesByType(child, nodeType));
        }
    }
    
    return results;
}

async function main() {
    try {
        // Load the Python parser
        const parser = await loadParser("python");
        
        // Read the shape.py file
        const filePath = path.join(__dirname, '..', 'datasets', 'refactored', 'python', 'shape.py');
        const sourceCode = fs.readFileSync(filePath, 'utf8');
        
        // Parse the source code into a tree
        const tree = parser.parse(sourceCode);
        
        // Print the root node to see the structure
        console.log("Root node type:", tree.rootNode.type);
        console.log("Number of children:", tree.rootNode.childCount);
        
        // Find all 'dotted_name' nodes in the tree
        console.log("\n=== Finding all 'dotted_name' nodes ===");
        const dottedNameNodes = findNodesByType(tree.rootNode, 'dotted_name');
        
        if (dottedNameNodes.length > 0) {
            console.log(`Found ${dottedNameNodes.length} 'dotted_name' nodes`);
            
            // Print detailed information about each found node
            dottedNameNodes.forEach((node, index) => {
                console.log(`\n--- 'dotted_name' Node ${index + 1} ---`);
                console.log(`Text: "${node.text}"`);
                console.log(`Position: (${node.startPosition.row},${node.startPosition.column}) - (${node.endPosition.row},${node.endPosition.column})`);
                
                // Print parent for context
                if (node.parent) {
                    console.log(`Parent Type: ${node.parent.type}`);
                    console.log(`Parent Text: "${node.parent.text.substring(0, 50)}${node.parent.text.length > 50 ? '...' : ''}"`);
                }
                
                // Print children
                if (node.childCount > 0) {
                    console.log("\nChildren:");
                    for (let i = 0; i < node.childCount; i++) {
                        const child = node.child(i);
                        if (child) {
                            console.log(`  Child ${i + 1}: ${child.type} - "${child.text}"`);
                        }
                    }
                }
                
                console.log("-----------------------------------");
            });
        } else {
            console.log("No 'dotted_name' nodes found");
        }
        
        // Save the tree to a JSON file for inspection
        const treeJson = JSON.stringify(serializeNode(tree.rootNode), null, 2);
        const outputPath = path.join(__dirname, 'python_ast.json');
        fs.writeFileSync(outputPath, treeJson);
        console.log(`\nFull AST saved to: ${outputPath}`);
    } catch (error) {
        console.error("Error parsing Python file:", error);
    }
}

// Helper function to serialize a node to a JSON-friendly object
interface SerializedNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    children: SerializedNode[];
}

function serializeNode(node: Parser.SyntaxNode): SerializedNode {
    const result: SerializedNode = {
        type: node.type,
        text: node.text.length > 100 ? node.text.substring(0, 100) + '...' : node.text,
        startPosition: { row: node.startPosition.row, column: node.startPosition.column },
        endPosition: { row: node.endPosition.row, column: node.endPosition.column },
        children: []
    };
    
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
            result.children.push(serializeNode(child));
        }
    }
    
    return result;
}

main();