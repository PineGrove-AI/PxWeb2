import { useEffect, useState } from 'react';

import {
  loadTableSearchProviders,
  type TableSearchProvider,
} from '../tableSearchProviders';

// The table search providers offered by plugins in the API, or an empty list
// until they are loaded (and when there are none).
export function useTableSearchProviders(): TableSearchProvider[] {
  const [providers, setProviders] = useState<TableSearchProvider[]>([]);

  useEffect(() => {
    let active = true;
    loadTableSearchProviders().then((loaded) => {
      if (active) {
        setProviders(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return providers;
}
