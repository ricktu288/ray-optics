import fs from 'node:fs';
import path from 'node:path';

const DENSITY_RESPONSIVE_SOURCE_TYPES = new Set([
  'AngleSource',
  'Beam',
  'PointSource',
]);

/**
 * Build the authored-scene population used by the browser engine benchmark.
 * Gallery ordering follows galleryList.json; any unlisted JSON files are
 * appended so "all gallery scenes" remains literal as the gallery evolves.
 */
export function buildSceneEngineBenchmarkManifest(repoRoot) {
  const galleryDirectory = path.join(repoRoot, 'data/galleryScenes');
  const moduleDirectory = path.join(repoRoot, 'data/moduleScenes');
  const sphericalLensDirectory = path.join(
    repoRoot, 'test/scenes/glass/SphericalLens'
  );
  const galleryList = readJson(path.join(repoRoot, 'data/galleryList.json'));
  const galleryCategories = new Map(galleryList.flatMap(category =>
    category.content.map(item => [item.id, category.id])
  ));
  const galleryIds = [
    ...galleryList.flatMap(category => category.content.map(item => item.id)),
    ...listJsonIds(galleryDirectory).filter(id => !galleryCategories.has(id)),
  ];

  const entries = [
    ...galleryIds.map(id => ({
      id,
      group: 'gallery',
      category: galleryCategories.get(id) ?? 'unlisted',
      filePath: path.join(galleryDirectory, `${id}.json`),
    })),
    ...listJsonIds(moduleDirectory).map(id => ({
      id,
      group: 'module',
      category: 'module',
      filePath: path.join(moduleDirectory, `${id}.json`),
    })),
    ...listJsonIds(sphericalLensDirectory).map(id => ({
      id,
      group: 'sphericalLens',
      category: 'SphericalLens',
      filePath: path.join(sphericalLensDirectory, `${id}.json`),
    })),
  ];

  return entries.map((entry, index) => {
    if (!fs.existsSync(entry.filePath)) {
      throw new Error(`Benchmark scene is missing: ${entry.filePath}`);
    }
    const sceneJson = readJson(entry.filePath);
    return {
      index,
      id: entry.id,
      group: entry.group,
      category: entry.category,
      url: `/benchmark-scene/${index}.json`,
      hasDensityResponsiveSource:
        containsDensityResponsiveSource(sceneJson),
      authoredMode: sceneJson.mode ?? 'rays',
      authoredColorMode: sceneJson.colorMode ?? 'default',
      authoredWidth: finitePositiveOr(sceneJson.width, 1500),
      authoredHeight: finitePositiveOr(sceneJson.height, 900),
      filePath: entry.filePath,
    };
  });
}

export function containsDensityResponsiveSource(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some(item => containsDensityResponsiveSource(item));
  }
  if (DENSITY_RESPONSIVE_SOURCE_TYPES.has(value.type)) return true;
  return Object.values(value).some(item =>
    containsDensityResponsiveSource(item)
  );
}

function listJsonIds(directory) {
  return fs.readdirSync(directory)
    .filter(file => file.endsWith('.json'))
    .map(file => file.slice(0, -'.json'.length))
    .sort((a, b) => a.localeCompare(b));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function finitePositiveOr(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

