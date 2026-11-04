import {
  type ApiFeature,
  ConfigurationService,
} from '@pxweb2/pxweb2-api-client';
import { getConfig } from './config/getConfig';
import { queryTablesByKeyword } from './tableHandler';

// A table search offered by a plugin in the API. The API lists its plugins as
// features in GET /config; a feature with a `tableSearch` param is a table search.
export type TableSearchProvider = {
  // The feature id, i.e. the plugin's name.
  id: string;
  // What the start page calls this search mode.
  label: string;
  // Absolute URL of the search endpoint.
  url: string;
};

// The tables a provider found, best match first.
export type TableSearchResult = {
  tableIds: string[];
  // An optional short text from the provider, shown above the results.
  note?: string;
};

// The tables a search found. ranked: tableIds are best match first and should
// be shown in that order.
export type SearchTablesResult = TableSearchResult & { ranked: boolean };

type TableSearchResponse = {
  tables?: { id?: unknown }[];
  note?: unknown;
};

const TABLE_SEARCH_PARAM = 'tableSearch';
const LABEL_PARAM = 'label';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

// Derives the table search providers from the API's features. Features without
// a `tableSearch` param are not search providers and are ignored.
export function getTableSearchProviders(
  features: ApiFeature[] | undefined,
  apiUrl: string,
): TableSearchProvider[] {
  return (features ?? []).flatMap((feature) => {
    const params = feature.params ?? [];
    const path = params.find((p) => p.key === TABLE_SEARCH_PARAM)?.value;
    if (!path) {
      return [];
    }
    const label =
      params.find((p) => p.key === LABEL_PARAM)?.value || feature.id;
    return [{ id: feature.id, label, url: joinUrl(apiUrl, path) }];
  });
}

let providersPromise: Promise<TableSearchProvider[]> | undefined;

// Loads the table search providers once per page load. A missing or failing
// /config means no providers, so the start page behaves as without plugins.
export function loadTableSearchProviders(): Promise<TableSearchProvider[]> {
  providersPromise ??= (async () => {
    try {
      const config = await ConfigurationService.getApiConfiguration();
      return getTableSearchProviders(config.features, getConfig().apiUrl);
    } catch {
      return [];
    }
  })();

  return providersPromise;
}

// For tests: forget the providers loaded so far.
export function resetTableSearchProviders() {
  providersPromise = undefined;
}

// Searches tables with a provider. Throws when the provider fails or answers
// with something that is not a table search response, so the caller can fall
// back to the keyword search.
export async function searchTablesWithProvider(
  provider: TableSearchProvider,
  query: string,
  language: string,
): Promise<TableSearchResult> {
  const params = new URLSearchParams({ query, lang: language });
  const separator = provider.url.includes('?') ? '&' : '?';
  const response = await fetch(`${provider.url}${separator}${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Table search '${provider.id}' failed with status ${response.status}`,
    );
  }

  const body = (await response.json()) as TableSearchResponse;
  if (!Array.isArray(body?.tables)) {
    throw new TypeError(
      `Table search '${provider.id}' returned no list of tables`,
    );
  }

  return {
    tableIds: body.tables
      .map((table) => table?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    note:
      typeof body.note === 'string' && body.note.trim() !== ''
        ? body.note
        : undefined,
  };
}

// Searches tables with the provider when one is given, otherwise (and when the
// provider fails) with the API's keyword search.
export async function searchTables(
  query: string,
  language: string,
  provider?: TableSearchProvider,
): Promise<SearchTablesResult> {
  if (provider) {
    try {
      const result = await searchTablesWithProvider(provider, query, language);
      return { ...result, ranked: true };
    } catch (error) {
      console.warn(
        `Table search '${provider.id}' failed, using keyword search instead.`,
        error,
      );
    }
  }

  const tables = await queryTablesByKeyword(query, language);
  return { tableIds: tables.map((table) => table.id), ranked: false };
}
