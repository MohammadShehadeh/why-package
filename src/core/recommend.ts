import type { BundleInfo, PackageUsage, Recommendation } from '../types';

/** Curated, conservative suggestions for commonly-replaced packages. */
const ALTERNATIVES: Record<string, { alt: string; note: string }> = {
  moment: { alt: 'dayjs or date-fns', note: 'moment is large and in maintenance mode' },
  lodash: { alt: 'lodash-es or native ES methods', note: 'enables tree-shaking' },
  underscore: { alt: 'native ES array/object methods', note: '' },
  'react-query': { alt: '@tanstack/react-query', note: 'react-query was renamed' },
  request: { alt: 'undici or the native fetch API', note: 'request is deprecated' },
  axios: { alt: 'the native fetch API', note: 'fetch is built in on Node 18+' },
  'node-fetch': { alt: 'the native fetch API', note: 'fetch is built in on Node 18+' },
  'left-pad': { alt: 'String.prototype.padStart', note: 'native since ES2017' },
  querystring: { alt: 'URLSearchParams', note: 'native and standardized' },
  rimraf: { alt: 'fs.rm({ recursive: true })', note: 'native since Node 14' },
  mkdirp: { alt: 'fs.mkdir({ recursive: true })', note: 'native since Node 10' },
  uuid: { alt: 'crypto.randomUUID()', note: 'native since Node 16' },
  chalk: { alt: 'picocolors', note: 'much smaller, if you only need basic colors' },
  classnames: { alt: 'clsx', note: 'smaller drop-in replacement' },
};

const LARGE_GZIP_BYTES = 50 * 1024;

export interface RecommendationInput {
  packageName: string;
  usage: PackageUsage;
  /** Total named exports detected for the package, or null if unknown. */
  totalExports: number | null;
  bundle?: BundleInfo | null;
  isDeclared: boolean;
}

/** Produce a short, honest recommendation about a dependency. */
export function buildRecommendation(input: RecommendationInput): Recommendation {
  const { packageName, usage, totalExports, bundle, isDeclared } = input;
  const lines: string[] = [];
  const importerCount = usage.importers.length;
  const usedCount = usage.usedExports.length;

  if (importerCount === 0) {
    lines.push(`No imports of "${packageName}" were found in your source files.`);
    if (isDeclared) {
      lines.push('If nothing else needs it at build or run time, it may be safe to remove.');
    }
  } else {
    const fewThreshold = Math.max(2, Math.ceil((totalExports ?? 0) * 0.25));
    const usesWholeModule = usage.usesDefault || usage.usesNamespace;
    if (totalExports && usedCount > 0 && usedCount <= fewThreshold && !usesWholeModule) {
      lines.push(`Only ${usedCount} of ${totalExports} exports are used.`);
      lines.push('Selective imports or a lighter alternative could reduce footprint.');
    } else {
      lines.push(`Used by ${importerCount} file${importerCount === 1 ? '' : 's'}.`);
    }
  }

  const known = ALTERNATIVES[packageName];
  if (known) {
    lines.push(`Potential alternative: ${known.alt}${known.note ? ` — ${known.note}` : ''}.`);
  }

  if (bundle?.gzip && bundle.gzip > LARGE_GZIP_BYTES) {
    const kb = Math.round(bundle.gzip / 1024);
    lines.push(`At ~${kb} KB gzipped, weigh this dependency against the value it adds.`);
  }

  if (lines.length === 0) lines.push('This dependency looks reasonable.');

  return { lines, alternative: known?.alt };
}
