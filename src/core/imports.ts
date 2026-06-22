import path from 'node:path';
import { type CallExpression, Node, Project, type SourceFile, SyntaxKind } from 'ts-morph';
import { packageNameFromSpecifier } from '../utils/specifier';
import type { ImportRef } from '../types';

let sharedProject: Project | null = null;

/**
 * A single in-memory ts-morph project, reused across files. Source files are
 * added and removed per call so memory stays bounded even on huge repos.
 */
function getProject(): Project {
  if (!sharedProject) {
    sharedProject = new Project({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      compilerOptions: { allowJs: true, noLib: true },
    });
  }
  return sharedProject;
}

/** Quick rejection: no module keywords means nothing to parse. */
const MODULE_KEYWORDS = /\b(?:import|require|export)\b/;

/**
 * Extract every import / re-export / require / dynamic-import reference from a
 * file's source. Synchronous by design: the shared ts-morph project is mutated
 * and restored within a single call, so concurrent callers never interleave.
 */
export function extractImports(filePath: string, content: string): ImportRef[] {
  if (!MODULE_KEYWORDS.test(content)) return [];

  const project = getProject();
  const ext = path.extname(filePath) || '.ts';
  // Stable virtual path per extension preserves the right script kind (jsx/tsx).
  const virtualPath = `/__why_package_scan__/file${ext}`;
  const sourceFile = project.createSourceFile(virtualPath, content, { overwrite: true });

  try {
    const mayHaveCalls = content.includes('require(') || content.includes('import(');
    return collect(sourceFile, mayHaveCalls);
  } finally {
    project.removeSourceFile(sourceFile);
  }
}

function collect(sourceFile: SourceFile, mayHaveCalls: boolean): ImportRef[] {
  const refs: ImportRef[] = [];

  // import ... from '...'
  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (!specifier) continue;
    refs.push({
      specifier,
      packageName: packageNameFromSpecifier(specifier),
      named: decl.getNamedImports().map((n) => n.getName()),
      hasDefault: decl.getDefaultImport() != null,
      hasNamespace: decl.getNamespaceImport() != null,
      kind: 'import',
    });
  }

  // export { x } from '...' / export * from '...' / export * as ns from '...'
  for (const decl of sourceFile.getExportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (!specifier) continue; // local export, not a re-export
    const named = decl.getNamedExports().map((n) => n.getName());
    const isStar = named.length === 0 && decl.getNamespaceExport() == null;
    refs.push({
      specifier,
      packageName: packageNameFromSpecifier(specifier),
      named,
      hasDefault: false,
      hasNamespace: isStar || decl.getNamespaceExport() != null,
      kind: 'export',
    });
  }

  if (mayHaveCalls) {
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const ref = fromCall(call);
      if (ref) refs.push(ref);
    }
  }

  return refs;
}

/** Handle `require('x')` and dynamic `import('x')` calls. */
function fromCall(call: CallExpression): ImportRef | null {
  const expr = call.getExpression();
  const arg = call.getArguments()[0];
  if (!arg || !Node.isStringLiteral(arg)) return null;
  const specifier = arg.getLiteralText();
  if (!specifier) return null;

  if (expr.getKind() === SyntaxKind.ImportKeyword) {
    return {
      specifier,
      packageName: packageNameFromSpecifier(specifier),
      named: [],
      hasDefault: false,
      hasNamespace: true, // whole-module access
      kind: 'dynamic',
    };
  }

  if (Node.isIdentifier(expr) && expr.getText() === 'require') {
    const { named, hasDefault } = requireBindings(call);
    return {
      specifier,
      packageName: packageNameFromSpecifier(specifier),
      named,
      hasDefault,
      hasNamespace: false,
      kind: 'require',
    };
  }

  return null;
}

/** Recover named bindings from `const { a, b } = require('x')`. */
function requireBindings(call: CallExpression): { named: string[]; hasDefault: boolean } {
  const parent = call.getParent();
  if (parent && Node.isVariableDeclaration(parent)) {
    const nameNode = parent.getNameNode();
    if (Node.isObjectBindingPattern(nameNode)) {
      const named = nameNode.getElements().map((el) => {
        const propertyName = el.getPropertyNameNode();
        return propertyName?.getText() ?? el.getName();
      });
      return { named, hasDefault: false };
    }
  }
  return { named: [], hasDefault: true };
}
