/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PluginCapability = {
    /**
     * The type of capability. Known types:
     * - tableSearch: GET {path}?query={text}&lang={language} returns a TableSearchResponse
     *
     */
    type: string;
    /**
     * The path of the capability's endpoint relative to the API root
     */
    path: string;
};

