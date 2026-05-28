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

function traverse(node: ts.Node, depth: number) {
  if (node.kind === ts.SyntaxKind.JsxElement || node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
    const text = node.getText().substring(0, 50).replace(/\n/g, "");
    // console.log("  ".repeat(depth) + ts.SyntaxKind[node.kind] + ": " + text);
  }
  
  ts.forEachChild(node, (child) => traverse(child, depth + 1));
}

traverse(sourceFile, 0);

// Print diagnostics
const diagnostics = (sourceFile as any).parseDiagnostics;
if (diagnostics && diagnostics.length > 0) {
    for (const d of diagnostics) {
        const start = d.start;
        const pos = sourceFile.getLineAndCharacterOfPosition(start);
        console.log(`Error at line ${pos.line + 1}: ${d.messageText}`);
    }
} else {
    console.log("No syntax errors found by internal parser!");
}
