import {
  ConfigurationService,
  type Plugin,
  type PluginLabel,
} from '@pxweb2/pxweb2-api-client';
import { getConfig } from './config/getConfig';

// A plugin capability with the absolute URL of its endpoint.
export type PluginCapabilityEndpoint = {
  pluginId: string;
  labels: PluginLabel[];
  url: string;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

// The capabilities of the given type, one per plugin that has it. Types that
// PxWeb does not know are ignored by not asking for them.
export function getPluginCapabilities(
  plugins: Plugin[] | undefined,
  type: string,
  apiUrl: string,
): PluginCapabilityEndpoint[] {
  return (plugins ?? []).flatMap((plugin) => {
    const capability = plugin.capabilities?.find((c) => c.type === type);
    if (!capability) {
      return [];
    }
    return [
      {
        pluginId: plugin.id,
        labels: plugin.labels ?? [],
        url: joinUrl(apiUrl, capability.path),
      },
    ];
  });
}

// The label in the given language, else the first label, else the fallback.
export function getPluginLabel(
  labels: PluginLabel[],
  language: string,
  fallback: string,
): string {
  return (
    labels.find((label) => label.language === language)?.text ??
    labels[0]?.text ??
    fallback
  );
}

let pluginsPromise: Promise<Plugin[]> | undefined;

// Loads the API's plugins once per page load. A missing or failing /config
// means no plugins.
export function loadPlugins(): Promise<Plugin[]> {
  pluginsPromise ??= ConfigurationService.getApiConfiguration()
    .then((config) => config.plugins ?? [])
    .catch(() => []);

  return pluginsPromise;
}

export async function loadPluginCapabilities(
  type: string,
): Promise<PluginCapabilityEndpoint[]> {
  return getPluginCapabilities(await loadPlugins(), type, getConfig().apiUrl);
}

// For tests: forget the plugins loaded so far.
export function resetPlugins() {
  pluginsPromise = undefined;
}
