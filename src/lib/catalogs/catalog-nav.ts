/**
 * Persist studio / products catalog drill-down (brand + series + filter)
 * so zone switches and mobile sheet remounts keep the same folder open.
 */

export interface CatalogNavState {
  browsingFolders: boolean;
  openSeriesId: string | null;
  filter: string;
  catalogId?: string | null;
}

const STUDIO_KEY = "studio-catalog-nav";
const PRODUCTS_KEY = "products-catalog-nav";

const studioListeners = new Set<() => void>();
const productsListeners = new Set<() => void>();

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadStudioCatalogNav(): CatalogNavState | null {
  return readJson<CatalogNavState>(STUDIO_KEY);
}

export function saveStudioCatalogNav(state: CatalogNavState) {
  writeJson(STUDIO_KEY, state);
  studioListeners.forEach((l) => l());
}

export function subscribeStudioCatalogNav(onStoreChange: () => void) {
  studioListeners.add(onStoreChange);
  return () => {
    studioListeners.delete(onStoreChange);
  };
}

export function getStudioCatalogNavSnapshot(): CatalogNavState {
  return (
    loadStudioCatalogNav() ?? {
      browsingFolders: true,
      openSeriesId: null,
      filter: "",
      catalogId: null,
    }
  );
}

export function getServerStudioCatalogNavSnapshot(): CatalogNavState {
  return {
    browsingFolders: true,
    openSeriesId: null,
    filter: "",
    catalogId: null,
  };
}

export function loadProductsCatalogNav(): CatalogNavState | null {
  return readJson<CatalogNavState>(PRODUCTS_KEY);
}

export function saveProductsCatalogNav(state: CatalogNavState) {
  writeJson(PRODUCTS_KEY, state);
  productsListeners.forEach((l) => l());
}

export function subscribeProductsCatalogNav(onStoreChange: () => void) {
  productsListeners.add(onStoreChange);
  return () => {
    productsListeners.delete(onStoreChange);
  };
}

export function getProductsCatalogNavSnapshot(): CatalogNavState {
  return (
    loadProductsCatalogNav() ?? {
      browsingFolders: true,
      openSeriesId: null,
      filter: "",
      catalogId: null,
    }
  );
}

export function getServerProductsCatalogNavSnapshot(): CatalogNavState {
  return {
    browsingFolders: true,
    openSeriesId: null,
    filter: "",
    catalogId: null,
  };
}
