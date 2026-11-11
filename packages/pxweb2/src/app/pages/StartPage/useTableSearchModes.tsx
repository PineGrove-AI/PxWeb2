import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { BodyShort, Chips } from '@pxweb2/pxweb2-ui';
import styles from './useTableSearchModes.module.scss';
import {
  searchTables,
  type TableSearchProvider,
} from '../../util/tableSearchProviders';
import { useTableSearchProviders } from '../../util/hooks/useTableSearchProviders';

// The search mode for the API's own keyword search. Other modes are the ids of
// table search providers (plugins in the API).
const KEYWORD_SEARCH_MODE = 'keyword';

// The start page's search modes: the keyword search plus one per table search
// provider. Everything about the modes lives here, so the start page only
// calls search and places the two pieces of UI.
export function useTableSearchModes() {
  const { t } = useTranslation();
  const providers = useTableSearchProviders();
  const [mode, setMode] = useState(KEYWORD_SEARCH_MODE);
  const [note, setNote] = useState<string>();

  // In refs, so search stays the same function and always sees the mode the
  // user picked last, also before the state has caught up.
  const provider = useRef<TableSearchProvider | undefined>(undefined);
  const latestSearch = useRef(0);

  // Searches in the current mode. Returns the IDs of the tables found, best
  // match first.
  const search = useCallback(async (query: string, language: string) => {
    const current = ++latestSearch.current;
    const result = await searchTables(query, language, provider.current);
    // The note of a search that was overtaken by a newer one is not shown.
    if (current === latestSearch.current) {
      setNote(result.note);
    }
    return result.tableIds;
  }, []);

  // The search mode toggle, or nothing when there are no providers.
  // onChange: called after the mode changed, to run the current query again.
  const renderModes = (onChange: () => void): ReactNode => {
    if (providers.length === 0) {
      return null;
    }
    const modes = [
      { id: KEYWORD_SEARCH_MODE, label: t('start_page.search_mode.keyword') },
      ...providers,
    ];
    return (
      <div className={styles.searchModes}>
        <Chips aria-label={t('start_page.search_mode.aria')}>
          {modes.map((item) => (
            <Chips.Toggle
              key={item.id}
              selected={mode === item.id}
              checkmark={false}
              onClick={() => {
                if (item.id === mode) {
                  return;
                }
                setMode(item.id);
                provider.current = providers.find((p) => p.id === item.id);
                setNote(undefined);
                onChange();
              }}
            >
              {item.label}
            </Chips.Toggle>
          ))}
        </Chips>
      </div>
    );
  };

  // The provider's note about the last search, if it gave one.
  const renderNote = (): ReactNode =>
    note ? (
      <BodyShort size="medium" className={styles.searchNote}>
        {note}
      </BodyShort>
    ) : null;

  return { search, renderModes, renderNote };
}
