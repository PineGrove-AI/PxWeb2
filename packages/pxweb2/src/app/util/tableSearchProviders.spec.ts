import { vi, type Mock } from 'vitest';

import {
  loadTableSearchProviders,
  searchTables,
  searchTablesWithProvider,
  type TableSearchProvider,
} from './tableSearchProviders';
import { resetPlugins } from './plugins';
import { queryTablesByKeyword } from './tableHandler';
import {
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

const provider: TableSearchProvider = {
  pluginId: 'smart-search',
  labels: [{ language: 'en', text: 'Smart search' }],
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
  resetPlugins();
});

describe('loadTableSearchProviders', () => {
  it('returns the plugins with a tableSearch capability', async () => {
    vi.mocked(ConfigurationService.getApiConfiguration).mockResolvedValue({
      plugins: [
        {
          id: 'smart-search',
          path: 'plugins/smart-search',
          labels: [{ language: 'en', text: 'Smart search' }],
          capabilities: [
            { type: 'tableSearch', path: 'plugins/smart-search/search' },
          ],
        },
        { id: 'other', path: 'plugins/other', capabilities: [] },
      ],
    } as ConfigResponse as never);

    expect(await loadTableSearchProviders()).toEqual([provider]);
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
    expect(result).toEqual({ tableIds: ['TAB1', 'TAB3'] });
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
    });
  });

  it('falls back to the keyword search when the provider fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetch({ ok: false, status: 500 });

    const result = await searchTables('q', 'en', provider);

    expect(queryTablesByKeyword).toHaveBeenCalledWith('q', 'en');
    expect(result).toEqual({ tableIds: ['TAB1', 'TAB3'] });
  });
});
