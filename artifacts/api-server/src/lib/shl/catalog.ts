import { readFileSync } from "fs";
import { join } from "path";

export interface CatalogItem {
  name: string;
  url: string;
  test_type: string;
  category: string;
  description: string;
  keywords: string[];
}

let _catalog: CatalogItem[] | null = null;

export function getCatalog(): CatalogItem[] {
  if (_catalog) return _catalog;

  const catalogPath = join(
    process.cwd(),
    "artifacts",
    "api-server",
    "src",
    "data",
    "catalog.json"
  );

  const raw = readFileSync(catalogPath, "utf-8");

  _catalog = JSON.parse(raw) as CatalogItem[];

  return _catalog;
}

export function getAssessmentByName(name: string): CatalogItem | undefined {
  const catalog = getCatalog();

  const lower = name.toLowerCase();

  return catalog.find(
    (item) =>
      item.name.toLowerCase().includes(lower) ||
      lower.includes(item.name.toLowerCase())
  );
}

export function getAssessmentsByNames(names: string[]): CatalogItem[] {
  return names
    .map((n) => getAssessmentByName(n))
    .filter((item): item is CatalogItem => item !== undefined);
}