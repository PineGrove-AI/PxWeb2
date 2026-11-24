import { vi } from 'vitest';

import {
  getPluginCapabilities,
  getPluginLabel,
  loadPluginCapabilities,
  resetPlugins,
} from './plugins';
import {
  type ConfigResponse,
  ConfigurationService,
  type Plugin,
} from '@pxweb2/pxweb2-api-client';

vi.mock('@pxweb2/pxweb2-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@pxweb2/pxweb2-api-client')>();
  return {
    ...actual,
    ConfigurationService: { getApiConfiguration: vi.fn() },
  };
});

vi.mock('./config/getConfig', () => ({
  getConfig: () => ({ apiUrl: 'https://api.example.com/api/v2/' }),
}));

const smartSearch: Plugin = {
  id: 'smart-search',
  path: 'plugins/smart-search',
  labels: [{ language: 'en', text: 'Smart search' }],
  capabilities: [
    { type: 'tableSearch', path: 'plugins/smart-search/search' },
    { type: 'somethingNew', path: 'plugins/smart-search/new' },
  ],
};

const other: Plugin = {
  id: 'other',
  path: 'plugins/other',
  capabilities: [{ type: 'somethingNew', path: 'plugins/other/new' }],
};

afterEach(() => {
  vi.clearAllMocks();
  resetPlugins();
});

describe('getPluginCapabilities', () => {
  it('returns the plugins with the capability, with absolute URLs', () => {
    expect(
      getPluginCapabilities(
        [smartSearch, other],
        'tableSearch',
        'https://api.example.com/api/v2/',
      ),
    ).toEqual([
      {
        pluginId: 'smart-search',
        labels: [{ language: 'en', text: 'Smart search' }],
        url: 'https://api.example.com/api/v2/plugins/smart-search/search',
      },
    ]);
  });

  it('returns nothing without plugins', () => {
    expect(getPluginCapabilities(undefined, 'tableSearch', 'x')).toEqual([]);
  });
});

describe('getPluginLabel', () => {
  const labels = [
    { language: 'sv', text: 'Smart sökning' },
    { language: 'en', text: 'Smart search' },
  ];

  it('returns the label in the language', () => {
    expect(getPluginLabel(labels, 'en', 'id')).toBe('Smart search');
  });

  it('falls back to the first label, then to the fallback', () => {
    expect(getPluginLabel(labels, 'no', 'id')).toBe('Smart sökning');
    expect(getPluginLabel([], 'en', 'id')).toBe('id');
  });
});

describe('loadPluginCapabilities', () => {
  it('loads the plugins from the API configuration once', async () => {
    const configSpy = vi
      .mocked(ConfigurationService.getApiConfiguration)
      .mockResolvedValue({ plugins: [smartSearch] } as ConfigResponse as never);

    expect(await loadPluginCapabilities('tableSearch')).toHaveLength(1);
    expect(await loadPluginCapabilities('somethingNew')).toHaveLength(1);
    expect(configSpy).toHaveBeenCalledTimes(1);
  });

  it('returns nothing when the API configuration cannot be loaded', async () => {
    vi.mocked(ConfigurationService.getApiConfiguration).mockRejectedValue(
      new Error('Network error') as never,
    );

    expect(await loadPluginCapabilities('tableSearch')).toEqual([]);
  });
});
