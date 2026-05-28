import * as ts from "typescript";
import * as fs from "fs";

const fileContent = fs.readFileSync("src/components/BulkEditor.tsx", "utf8");

const sourceFile = ts.createSourceFile(
  "src/components/BulkEditor.tsx",
  fileContent,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

function printJsxStructure(node: ts.Node, indent: string) {
  if (ts.isJsxElement(node)) {
    const openingTagName = node.openingElement.tagName.getText();
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    console.log(`${indent}<${openingTagName}> at line ${startLine}`);
    
    // Visit children
    ts.forEachChild(node, child => printJsxStructure(child, indent + "  "));
    
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.closingElement.getEnd()).line + 1;
    console.log(`${indent}</${openingTagName}> at line ${endLine}`);
  } else if (ts.isJsxSelfClosingElement(node)) {
    const tagName = node.tagName.getText();
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    console.log(`${indent}<${tagName} /> at line ${startLine}`);
  } else if (ts.isJsxFragment(node)) {
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    console.log(`${indent}<> at line ${startLine}`);
    ts.forEachChild(node, child => printJsxStructure(child, indent + "  "));
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    console.log(`${indent}</> at line ${endLine}`);
  } else {
    ts.forEachChild(node, child => printJsxStructure(child, indent));
  }
}

// Find BulkEditor function and print its return statement JSX
function findAndPrintBulkEditor(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "BulkEditor") {
    console.log("Found BulkEditor!");
    const block = node.body;
    if (block) {
      for (const stmt of block.statements) {
        if (ts.isReturnStatement(stmt) && stmt.expression) {
          console.log("Found return statement:");
          printJsxStructure(stmt.expression, "  ");
        }
      }
    }
  }
  ts.forEachChild(node, findAndPrintBulkEditor);
}

findAndPrintBulkEditor(sourceFile);
