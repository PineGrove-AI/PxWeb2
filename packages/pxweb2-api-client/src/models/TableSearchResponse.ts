/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TableSearchHit } from './TableSearchHit';
/**
 * The response of a plugin's tableSearch endpoint
 */
export type TableSearchResponse = {
    /**
     * The matching tables, best match first
     */
    tables: Array<TableSearchHit>;
    /**
     * An optional text for clients to show with the results
     */
    note?: string | null;
};

