import { useCallback, useEffect, useState } from 'react';

/**
 * Tab and search kept in the URL fragment (#tab=bronie&q=topor), so a view can
 * be linked and survives a reload. The fragment never reaches a server.
 */
export function useHashState(): [URLSearchParams, (patch: Record<string, string>) => void] {
    const read = () => new URLSearchParams(window.location.hash.slice(1));
    const [params, setParams] = useState(read);

    useEffect(() => {
        const onChange = () => setParams(read());
        window.addEventListener('hashchange', onChange);
        return () => window.removeEventListener('hashchange', onChange);
    }, []);

    const update = useCallback((patch: Record<string, string>) => {
        const next = read();
        for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
        }
        const hash = next.toString();
        // replaceState: typing a search should not flood the back button
        history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search);
        setParams(next);
    }, []);

    return [params, update];
}
