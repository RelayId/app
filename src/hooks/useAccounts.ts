import { loadAccounts } from '../relay/storage';
import type { Account } from '../relay/models';
import { useCallback } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';

export type UseAccountsReturn = {
    accounts: Account[];
    loaded: boolean;
    selectedAccount?: Account;
    selectedAccountId?: string;
    reloadAccounts: () => Promise<Account[]>;
    selectAccount: (id: string) => void;
};

export function useAccounts(): UseAccountsReturn {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState<string>();

    const reloadAccounts = useCallback(async (): Promise<Account[]> => {
        const loaded = await loadAccounts();
        setAccounts(loaded);
        setLoaded(true);
        setSelectedAccountId((current) =>
            current && loaded.some((account) => account.id === current) ? current : loaded[0]?.id,
        );
        return loaded;
    }, []);

    useEffect(() => {
        void reloadAccounts();
    }, []);

    return {
        accounts,
        loaded,
        selectedAccountId,
        selectedAccount: accounts.find((account) => account.id === selectedAccountId),
        reloadAccounts,
        selectAccount: setSelectedAccountId,
    };
}
