import { vi, type Mock } from 'vitest';

import {
  getTableSearchProviders,
  loadTableSearchProviders,
  resetTableSearchProviders,
  searchTables,
  searchTablesWithProvider,
  type TableSearchProvider,
} from './tableSearchProviders';
import { queryTablesByKeyword } from './tableHandler';
import {
  type ApiFeature,
  type ConfigResponse,
  ConfigurationService,
  type Table,
} from '@pxweb2/pxweb2-api-client';

vi.mock('@pxweb2/pxweb2-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@pxweb2/pxweb2-api-client')>();
  return {
    ...actual,
    ConfigurationService: { getApiConfiguration: vi.fn() },
  };
});

vi.mock('./tableHandler', () => ({
  queryTablesByKeyword: vi.fn(),
}));

vi.mock('./config/getConfig', () => ({
  getConfig: () => ({ apiUrl: 'https://api.example.com/api/v2/' }),
}));

const pluginFeature: ApiFeature = {
  id: 'smart-search',
  params: [
    { key: 'plugin', value: 'true' },
    { key: 'path', value: 'plugins/smart-search' },
    { key: 'tableSearch', value: 'plugins/smart-search/search' },
    { key: 'label', value: 'Smart search' },
  ],
};

const provider: TableSearchProvider = {
  id: 'smart-search',
  label: 'Smart search',
  url: 'https://api.example.com/api/v2/plugins/smart-search/search',
};

function mockFetch(response: Partial<Response>) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetTableSearchProviders();
});

describe('getTableSearchProviders', () => {
  it('returns the features that have a table search, with absolute URLs', () => {
    const providers = getTableSearchProviders(
      [{ id: 'other-feature', params: [] }, pluginFeature],
      'https://api.example.com/api/v2/',
    );

    expect(providers).toEqual([provider]);
  });

  it('uses the feature id when there is no label', () => {
    const providers = getTableSearchProviders(
      [{ id: 'nameless', params: [{ key: 'tableSearch', value: '/search' }] }],
      '//api.example.com/api/v2',
    );

    expect(providers).toEqual([
      {
        id: 'nameless',
        label: 'nameless',
        url: '//api.example.com/api/v2/search',
      },
    ]);
  });

  it('returns no providers when there are no features', () => {
    expect(getTableSearchProviders(undefined, 'https://x')).toEqual([]);
    expect(getTableSearchProviders([], 'https://x')).toEqual([]);
  });
});

describe('loadTableSearchProviders', () => {
  it('loads the providers from the API configuration once', async () => {
    const configSpy = vi
      .mocked(ConfigurationService.getApiConfiguration)
      .mockResolvedValue({
        features: [pluginFeature],
      } as ConfigResponse as never);

    expect(await loadTableSearchProviders()).toEqual([provider]);
    expect(await loadTableSearchProviders()).toEqual([provider]);
    expect(configSpy).toHaveBeenCalledTimes(1);
  });

  it('returns no providers when the API configuration cannot be loaded', async () => {
    vi.mocked(ConfigurationService.getApiConfiguration).mockRejectedValue(
      new Error('Network error') as never,
    );

    expect(await loadTableSearchProviders()).toEqual([]);
  });
});

describe('searchTablesWithProvider', () => {
  it('sends the query and language and returns the ranked table ids', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          tables: [
            { id: 'TAB2', score: 0.9 },
            { id: 'TAB1', score: 0.4 },
          ],
          note: 'Searched for population by region',
        }),
    });

    const result = await searchTablesWithProvider(
      provider,
      'how many people',
      'en',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${provider.url}?query=how+many+people&lang=en`,
      expect.anything(),
    );
    expect(result).toEqual({
      tableIds: ['TAB2', 'TAB1'],
      note: 'Searched for population by region',
    });
  });

  it('throws when the provider fails', async () => {
    mockFetch({ ok: false, status: 502 });

    await expect(searchTablesWithProvider(provider, 'q', 'en')).rejects.toThrow(
      '502',
    );
  });

  it('throws when the response has no list of tables', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({ results: [] }) });

    await expect(
      searchTablesWithProvider(provider, 'q', 'en'),
    ).rejects.toThrow();
  });
});

describe('searchTables', () => {
  beforeEach(() => {
    (queryTablesByKeyword as Mock).mockResolvedValue([
      { id: 'TAB1' } as Table,
      { id: 'TAB3' } as Table,
    ]);
  });

  it('uses the keyword search without a provider', async () => {
    const result = await searchTables('q', 'en');

    expect(queryTablesByKeyword).toHaveBeenCalledWith('q', 'en');
    expect(result).toEqual({ tableIds: ['TAB1', 'TAB3'], ranked: false });
  });

  it('uses the provider when one is given', async () => {
    mockFetch({
      ok: true,
      json: () => Promise.resolve({ tables: [{ id: 'TAB3' }] }),
    });

    const result = await searchTables('q', 'en', provider);

    expect(queryTablesByKeyword).not.toHaveBeenCalled();
    expect(result).toEqual({
      tableIds: ['TAB3'],
      note: undefined,
      ranked: true,
    });
  });

  it('falls back to the keyword search when the provider fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetch({ ok: false, status: 500 });

    const result = await searchTables('q', 'en', provider);

    expect(queryTablesByKeyword).toHaveBeenCalledWith('q', 'en');
    expect(result).toEqual({ tableIds: ['TAB1', 'TAB3'], ranked: false });
  });
});
