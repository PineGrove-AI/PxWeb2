import type { TableSearchResponse } from '@pxweb2/pxweb2-api-client';
import {
  loadPluginCapabilities,
  type PluginCapabilityEndpoint,
} from './plugins';
import { queryTablesByKeyword } from './tableHandler';

export const TABLE_SEARCH_CAPABILITY = 'tableSearch';

// A table search offered by a plugin in the API.
export type TableSearchProvider = PluginCapabilityEndpoint;

// The tables a provider found, best match first.
export type TableSearchResult = {
  tableIds: string[];
  // An optional short text from the provider, shown above the results.
  note?: string;
};

export function loadTableSearchProviders(): Promise<TableSearchProvider[]> {
  return loadPluginCapabilities(TABLE_SEARCH_CAPABILITY);
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
      `Table search '${provider.pluginId}' failed with status ${response.status}`,
    );
  }

  const body = (await response.json()) as Partial<TableSearchResponse>;
  if (!Array.isArray(body?.tables)) {
    throw new TypeError(
      `Table search '${provider.pluginId}' returned no list of tables`,
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
): Promise<TableSearchResult> {
  if (provider) {
    try {
      return await searchTablesWithProvider(provider, query, language);
    } catch (error) {
      console.warn(
        `Table search '${provider.pluginId}' failed, using keyword search instead.`,
        error,
      );
    }
  }

  const tables = await queryTablesByKeyword(query, language);
  return { tableIds: tables.map((table) => table.id) };
}
