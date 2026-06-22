import type { PackageUsage, ScanResult } from '../types';

/** Summarize how a single package is imported across the scanned files. */
export function aggregatePackageUsage(scan: ScanResult, packageName: string): PackageUsage {
  const importers: string[] = [];
  const usedExports = new Set<string>();
  let usesDefault = false;
  let usesNamespace = false;

  for (const fileImports of scan.files) {
    let matched = false;
    for (const ref of fileImports.imports) {
      if (ref.packageName !== packageName) continue;
      matched = true;
      for (const name of ref.named) usedExports.add(name);
      if (ref.hasDefault) usesDefault = true;
      if (ref.hasNamespace) usesNamespace = true;
    }
    if (matched) importers.push(fileImports.file);
  }

  return {
    packageName,
    importers: importers.sort(),
    usedExports: [...usedExports].sort(),
    usesDefault,
    usesNamespace,
  };
}

/** Every distinct bare package name imported anywhere in the project. */
export function collectImportedPackageNames(scan: ScanResult): Set<string> {
  const names = new Set<string>();
  for (const fileImports of scan.files) {
    for (const ref of fileImports.imports) {
      if (ref.packageName) names.add(ref.packageName);
    }
  }
  return names;
}
