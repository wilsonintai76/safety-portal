import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { getMasterData, type MasterData } from '../services/portalApi';

interface PortalDataValue {
  masterData: MasterData | null;
  departments: MasterData['departments'];
  workshops: MasterData['workshops'];
  workshopNames: string[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const EMPTY_VALUE: PortalDataValue = {
  masterData: null,
  departments: [],
  workshops: [],
  workshopNames: [],
  isLoading: true,
  error: null,
  reload: () => undefined
};

const PortalDataContext = createContext<PortalDataValue>(EMPTY_VALUE);

/**
 * Reference data (departments, workshops, risk matrix) lives in D1.
 * Components read it from this provider instead of hardcoded lists.
 */
export const PortalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getMasterData()
      .then((data) => {
        if (cancelled) return;
        setMasterData(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Tidak dapat memuatkan data induk dari D1.'
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const value = useMemo<PortalDataValue>(
    () => ({
      masterData,
      departments: masterData?.departments ?? [],
      workshops: masterData?.workshops ?? [],
      workshopNames: (masterData?.workshops ?? []).map((workshop) => workshop.name),
      isLoading,
      error,
      reload
    }),
    [masterData, isLoading, error, reload]
  );

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
};

export function usePortalData(): PortalDataValue {
  return useContext(PortalDataContext);
}
