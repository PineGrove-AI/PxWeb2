/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PluginCapability } from './PluginCapability';
import type { PluginLabel } from './PluginLabel';
/**
 * An external service available through the API
 */
export type Plugin = {
    /**
     * The identifier for the plugin
     */
    id: string;
    /**
     * The path of the plugin relative to the API root, for example plugins/my-search
     */
    path: string;
    /**
     * The name of the plugin for clients to display, for different languages
     */
    labels?: Array<PluginLabel>;
    /**
     * What the plugin provides. Clients should ignore capability types they do not know.
     */
    capabilities: Array<PluginCapability>;
};

