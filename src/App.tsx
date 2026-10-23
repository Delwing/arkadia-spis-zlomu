import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    choices,
    damageTypes,
    gapLabel,
    gapsOf,
    loadSnapshot,
    matches,
    odmianaIndex,
    players,
    pluralize,
    type Armour,
    type Gap,
    type GapId,
    type Item,
    type ItemKind,
    type Odmiana,
    type Shield,
    type Snapshot,
    type Weapon,
    type Wearable,
} from './data';
import { useHashState } from './useHashState';

type Tab = ItemKind | 'odmiany';

const TABS: { id: Tab; label: string; forms: [string, string, string] }[] = [
    { id: 'bronie', label: 'Bronie', forms: ['broń', 'bronie', 'broni'] },
    { id: 'zbroje', label: 'Zbroje', forms: ['zbroja', 'zbroje', 'zbroi'] },
    { id: 'tarcze', label: 'Tarcze', forms: ['tarcza', 'tarcze', 'tarcz'] },
    { id: 'ubrania', label: 'Ubrania', forms: ['ubranie', 'ubrania', 'ubrań'] },
    { id: 'dodatki', label: 'Dodatki', forms: ['dodatek', 'dodatki', 'dodatków'] },
    { id: 'odmiany', label: 'Odmiany', forms: ['odmiana', 'odmiany', 'odmian'] },
];

const CASES: [keyof Odmiana, string][] = [
    ['mianownik', 'Mianownik'],
    ['dopelniacz', 'Dopełniacz'],
    ['celownik', 'Celownik'],
    ['biernik', 'Biernik'],
    ['narzednik', 'Narzędnik'],
    ['miejscownik', 'Miejscownik'],
];

type Sort = 'name' | 'votes';

interface Filters {
    typ: string;
    chwyt: string;
    obrazenia: string;
    oslona: string;
    material: string;
    magik: boolean;
    srebro: boolean;
    /** '' all, 'any' with something missing, 'complete' nothing missing, or one gap */
    braki: '' | 'any' | 'complete' | GapId;
}

const NO_FILTERS: Filters = { typ: '', chwyt: '', obrazenia: '', oslona: '', material: '', magik: false, srebro: false, braki: '' };

type ItemTab = Exclude<Tab, 'odmiany'>;

/** The gaps each kind can have, in the order the filter offers them */
const TAB_GAPS: Record<ItemTab, GapId[]> = {
    bronie: ['odmiana', 'typ', 'rodzaj', 'chwyt', 'obrazenia'],
    zbroje: ['odmiana', 'typ', 'oslona'],
    tarcze: ['odmiana', 'oslona'],
    ubrania: ['odmiana', 'material'],
    dodatki: ['odmiana', 'material'],
};

function passesGaps(gaps: Gap[], braki: Filters['braki']): boolean {
    if (!braki) return true;
    if (braki === 'any') return gaps.length > 0;
    if (braki === 'complete') return gaps.length === 0;
    return gaps.some(gap => gap.id === braki);
}

function GapChips({ gaps }: { gaps: Gap[] }) {
    if (!gaps.length) return null;
    return (
        <span className="gaps" title={'Brakuje: ' + gaps.map(g => g.label).join(', ')}>
            {gaps.map(g => <span key={g.id} className="gap">{g.label}</span>)}
        </span>
    );
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Snapshot };

interface Column<T> {
    label: string;
    cell: (row: T) => ReactNode;
    className?: string;
}

const nameOf = (item: Item) => item.short;
const byName = (a: string, b: string) => a.localeCompare(b, 'pl');

function sortRows<T extends { confirmations: number }>(rows: T[], name: (row: T) => string, sort: Sort): T[] {
    return [...rows].sort((a, b) =>
        sort === 'votes'
            ? b.confirmations - a.confirmations || byName(name(a), name(b))
            : byName(name(a), name(b)));
}

function Votes({ count }: { count: number }) {
    return (
        <span className={`votes${count >= 2 ? ' votes--agreed' : ''}`} title={`Potwierdzone przez: ${players(count)}`}>
            {count}
        </span>
    );
}

function Flags({ magik, srebro }: { magik: number; srebro?: number }) {
    return (
        <>
            {magik ? <span className="flag flag--magik" title="Magiczna">magia</span> : null}
            {srebro ? <span className="flag flag--srebro" title="Wykonana ze srebra">srebro</span> : null}
        </>
    );
}

function DeclensionTable({ odmiana }: { odmiana: Odmiana }) {
    return (
        <dl className="cases">
            {CASES.map(([key, label]) => (
                <div key={key} className="cases__row">
                    <dt>{label}</dt>
                    <dd>{odmiana[key] as string}</dd>
                </div>
            ))}
        </dl>
    );
}

/** What one version says, as label / value pairs, for the detail and the alternatives */
function itemFacts(tab: Tab, item: Item): [string, ReactNode][] {
    if (tab === 'bronie') {
        const w = item as Weapon;
        return [
            ['Typ', w.typ || '—'],
            ['Rodzaj', w.rodzaj || '—'],
            ['Chwyt', w.chwyt || '—'],
            ['Obrażenia', damageTypes(w).join(', ') || '—'],
            ['Magiczna', w.magik ? 'tak' : 'nie'],
            ['Ze srebra', w.srebro ? 'tak' : 'nie'],
        ];
    }
    if (tab === 'ubrania' || tab === 'dodatki') {
        const c = item as Wearable;
        return [
            ['Materiał', c.material || '—'],
            ...(c.iLine ? [['W „i”', <code key="i">{c.iLine}</code>] as [string, ReactNode]] : []),
        ];
    }
    const a = item as Armour | Shield;
    return [
        ...(tab === 'zbroje' ? [['Typ', (a as Armour).typ || '—'] as [string, ReactNode]] : []),
        ['Osłania', a.oslona || '—'],
        ['Magiczna', a.magik ? 'tak' : 'nie'],
        ...(a.iLine ? [['W „i”', <code key="i">{a.iLine}</code>] as [string, ReactNode]] : []),
    ];
}

/** How a player fills each gap in, from the game */
function GapHelp({ gaps, item }: { gaps: Gap[]; item: Item }) {
    if (!gaps.length) return null;
    const fromOcen = gaps.filter(g => g.id !== 'odmiana' && g.id !== 'oslona');
    return (
        <div className="gap-help">
            <h4>Do uzupełnienia</h4>
            <ul>
                {gaps.some(g => g.id === 'odmiana') && (
                    <li>Brak odmiany: wpisz w grze <code>odmien {item.short}</code>.</li>
                )}
                {gaps.some(g => g.id === 'oslona') && (
                    // Putting a piece on says what it covers, and the client keeps that too
                    <li>Brak osłony: oceń przedmiot w grze (<code>ocen</code>) albo go załóż.</li>
                )}
                {fromOcen.length > 0 && (
                    <li>
                        Brak {fromOcen.map(g => g.label).join(', ')}: oceń przedmiot w grze (<code>ocen</code>).
                    </li>
                )}
            </ul>
            <p className="detail__note">
                Klient z włączonym udostępnianiem (Ustawienia → Inne) prześle to sam.
            </p>
        </div>
    );
}

function ItemDetail({ tab, item, odmiana, gaps }: { tab: Tab; item: Item; odmiana?: Odmiana; gaps: Gap[] }) {
    return (
        <div className="detail">
            <div className="detail__main">
                <GapHelp gaps={gaps} item={item} />
                {item.opis ? (
                    <>
                        <p className="detail__opis">{item.opis}</p>
                        <p className="detail__note">Opis z jednego egzemplarza: kolejne mogą się różnić, np. wprawionym klejnotem.</p>
                    </>
                ) : (
                    // Blanked when it turned out to describe another item; the next player to send it fills it
                    <p className="detail__note">Brak opisu: uzupełni się, gdy ktoś oceni ten przedmiot.</p>
                )}
                {item.shortAlt && item.shortAlt !== item.short && (
                    <p className="detail__note">Przy ocenie: <em>{item.shortAlt}</em></p>
                )}
                <dl className="facts">
                    {itemFacts(tab, item).map(([label, value]) => (
                        <div key={label} className="facts__row"><dt>{label}</dt><dd>{value}</dd></div>
                    ))}
                </dl>
                {item.alternatives?.length ? (
                    <div className="alternatives">
                        <h4>Inne wersje tej nazwy</h4>
                        <p className="detail__note">
                            Gracze opisali ten przedmiot inaczej. Główna jest wersja, którą potwierdziło najwięcej osób.
                        </p>
                        {item.alternatives.map((alt, i) => (
                            <div key={i} className="alternative">
                                <Votes count={alt.confirmations} />
                                <dl className="facts facts--inline">
                                    {itemFacts(tab, alt).map(([label, value]) => (
                                        <div key={label} className="facts__row"><dt>{label}</dt><dd>{value}</dd></div>
                                    ))}
                                </dl>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="detail__side">
                <h4>Odmiana</h4>
                {odmiana ? (
                    <DeclensionTable odmiana={odmiana} />
                ) : (
                    <p className="detail__note">
                        Nikt jej jeszcze nie przysłał.
                    </p>
                )}
            </div>
        </div>
    );
}

function Table<T extends { confirmations: number }>({ rows, columns, keyOf, detail }: {
    rows: T[];
    columns: Column<T>[];
    keyOf: (row: T) => string;
    detail: (row: T) => ReactNode;
}) {
    const [open, setOpen] = useState<string | null>(null);
    if (!rows.length) return <p className="empty">Nic nie pasuje do wyszukiwania.</p>;
    return (
        <table className="list">
            <thead>
                <tr>
                    {columns.map(c => <th key={c.label} className={c.className}>{c.label}</th>)}
                    <th className="list__votes" title="Ilu graczy potwierdziło tę wersję">Graczy</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(row => {
                    const key = keyOf(row);
                    const isOpen = open === key;
                    return [
                        <tr
                            key={key}
                            className={`list__row${isOpen ? ' list__row--open' : ''}`}
                            onClick={() => setOpen(isOpen ? null : key)}
                        >
                            {columns.map(c => <td key={c.label} className={c.className}>{c.cell(row)}</td>)}
                            <td className="list__votes"><Votes count={row.confirmations} /></td>
                        </tr>,
                        isOpen && (
                            <tr key={`${key}:detail`} className="list__detail">
                                <td colSpan={columns.length + 1}>{detail(row)}</td>
                            </tr>
                        ),
                    ];
                })}
            </tbody>
        </table>
    );
}

function Select({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
    return (
        <label className="filter">
            <span>{label}</span>
            <select value={value} onChange={e => onChange(e.target.value)}>
                <option value="">wszystkie</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </label>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
    return (
        <label className="toggle">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            {label}
        </label>
    );
}

function formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function App() {
    const [load, setLoad] = useState<Load>({ status: 'loading' });
    const [params, setParams] = useHashState();
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [sort, setSort] = useState<Sort>('name');

    const tab = (TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'bronie') as Tab;
    const query = params.get('q') ?? '';

    useEffect(() => {
        const controller = new AbortController();
        loadSnapshot(controller.signal)
            .then(data => setLoad({ status: 'ready', data }))
            .catch(error => {
                if (!controller.signal.aborted) setLoad({ status: 'error', message: String(error?.message ?? error) });
            });
        return () => controller.abort();
    }, []);

    const data = load.status === 'ready' ? load.data : null;
    const declensions = useMemo(() => odmianaIndex(data?.odmiany ?? []), [data]);
    const setFilter = (patch: Partial<Filters>) => setFilters(current => ({ ...current, ...patch }));
    const switchTab = (next: Tab) => {
        setFilters(NO_FILTERS);
        setParams({ tab: next === 'bronie' ? '' : next });
    };

    // What each item lacks, worked out once per snapshot
    const gaps = useMemo(() => {
        const map = new Map<Item, Gap[]>();
        if (!data) return map;
        for (const w of data.bronie) map.set(w, gapsOf('bronie', w, declensions));
        for (const a of data.zbroje) map.set(a, gapsOf('zbroje', a, declensions));
        for (const s of data.tarcze) map.set(s, gapsOf('tarcze', s, declensions));
        for (const c of data.ubrania) map.set(c, gapsOf('ubrania', c, declensions));
        for (const d of data.dodatki) map.set(d, gapsOf('dodatki', d, declensions));
        return map;
    }, [data, declensions]);
    const gapsOfItem = (item: Item) => gaps.get(item) ?? [];

    const weapons = useMemo(() => sortRows((data?.bronie ?? []).filter(w =>
        matches(query, w.short, w.shortAlt, w.opis, w.typ, w.rodzaj)
        && (!filters.typ || w.typ === filters.typ)
        && (!filters.chwyt || w.chwyt === filters.chwyt)
        && (!filters.obrazenia || damageTypes(w).includes(filters.obrazenia))
        && (!filters.magik || w.magik === 1)
        && (!filters.srebro || w.srebro === 1)
        && passesGaps(gaps.get(w) ?? [], filters.braki)), nameOf, sort), [data, query, filters, sort, gaps]);

    const armour = useMemo(() => sortRows((data?.zbroje ?? []).filter(a =>
        matches(query, a.short, a.shortAlt, a.opis, a.iLine)
        && (!filters.typ || a.typ === filters.typ)
        && (!filters.oslona || a.oslona === filters.oslona)
        && (!filters.magik || a.magik === 1)
        && passesGaps(gaps.get(a) ?? [], filters.braki)), nameOf, sort), [data, query, filters, sort, gaps]);

    const shields = useMemo(() => sortRows((data?.tarcze ?? []).filter(s =>
        matches(query, s.short, s.shortAlt, s.opis, s.iLine)
        && (!filters.magik || s.magik === 1)
        && passesGaps(gaps.get(s) ?? [], filters.braki)), nameOf, sort), [data, query, filters, sort, gaps]);

    const wearables = useMemo(() => tab === 'ubrania' || tab === 'dodatki'
        ? sortRows((data?.[tab] ?? []).filter(c =>
            matches(query, c.short, c.shortAlt, c.opis, c.material, c.iLine)
            && (!filters.material || c.material === filters.material)
            && passesGaps(gaps.get(c) ?? [], filters.braki)), nameOf, sort)
        : [], [data, tab, query, filters, sort, gaps]);

    /** How many items of the current tab have each gap, for the filter's labels */
    const gapCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (!data || tab === 'odmiany') return counts;
        for (const item of data[tab] as Item[]) {
            const own = gaps.get(item) ?? [];
            counts.set(own.length ? 'any' : 'complete', (counts.get(own.length ? 'any' : 'complete') ?? 0) + 1);
            for (const gap of own) counts.set(gap.id, (counts.get(gap.id) ?? 0) + 1);
        }
        return counts;
    }, [data, tab, gaps]);

    const odmiany = useMemo(() => sortRows((data?.odmiany ?? []).filter(o =>
        matches(query, ...CASES.map(([key]) => o[key] as string))), o => o.mianownik, sort), [data, query, sort]);

    const counts: Record<Tab, number> = {
        bronie: data?.bronie.length ?? 0,
        zbroje: data?.zbroje.length ?? 0,
        tarcze: data?.tarcze.length ?? 0,
        ubrania: data?.ubrania.length ?? 0,
        dodatki: data?.dodatki.length ?? 0,
        odmiany: data?.odmiany.length ?? 0,
    };
    const shown: Record<Tab, number> = {
        bronie: weapons.length, zbroje: armour.length, tarcze: shields.length,
        ubrania: wearables.length, dodatki: wearables.length, odmiany: odmiany.length,
    };
    const current = TABS.find(t => t.id === tab)!;

    const itemDetail = (item: Item) => (
        <ItemDetail tab={tab} item={item} odmiana={declensions.get(item.short.toLowerCase())} gaps={gapsOfItem(item)} />
    );

    return (
        <div className="page">
            <header className="header">
                <div>
                    <h1>Spis złomu Arkadii</h1>
                    <p className="header__lead">
                        Bronie, zbroje, tarcze, ubrania i dodatki oraz odmiany ich nazw, zebrane przez graczy, którzy w kliencie
                        włączyli <em>Udostępniaj mój spis złomu i odmiany</em> (Ustawienia → Inne).
                    </p>
                </div>
                {data && (
                    <p className="header__meta">
                        Aktualizacja: {formatDate(data.generatedAt)}
                        <br />
                        <span>odświeżane kilka minut po nowych danych</span>
                    </p>
                )}
            </header>

            <nav className="tabs">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        className={`tabs__tab${t.id === tab ? ' tabs__tab--active' : ''}`}
                        onClick={() => switchTab(t.id)}
                    >
                        {t.label}
                        {data && <span className="tabs__count">{counts[t.id]}</span>}
                    </button>
                ))}
            </nav>

            <div className="toolbar">
                <input
                    className="search"
                    type="search"
                    placeholder={tab === 'odmiany' ? 'Szukaj w odmianach…' : 'Szukaj po nazwie, opisie, typie…'}
                    value={query}
                    onChange={e => setParams({ q: e.target.value })}
                    autoFocus
                />
                {data && tab === 'bronie' && (
                    <>
                        <Select label="Typ" value={filters.typ} options={choices(data.bronie, w => w.typ)} onChange={typ => setFilter({ typ })} />
                        <Select label="Chwyt" value={filters.chwyt} options={choices(data.bronie, w => w.chwyt)} onChange={chwyt => setFilter({ chwyt })} />
                        <Select label="Obrażenia" value={filters.obrazenia} options={['kłute', 'cięte', 'obuchowe']} onChange={obrazenia => setFilter({ obrazenia })} />
                        <Toggle label="magiczne" checked={filters.magik} onChange={magik => setFilter({ magik })} />
                        <Toggle label="srebrne" checked={filters.srebro} onChange={srebro => setFilter({ srebro })} />
                    </>
                )}
                {data && tab === 'zbroje' && (
                    <>
                        <Select label="Typ" value={filters.typ} options={choices(data.zbroje, a => a.typ)} onChange={typ => setFilter({ typ })} />
                        <Select label="Osłania" value={filters.oslona} options={choices(data.zbroje, a => a.oslona)} onChange={oslona => setFilter({ oslona })} />
                        <Toggle label="magiczne" checked={filters.magik} onChange={magik => setFilter({ magik })} />
                    </>
                )}
                {data && tab === 'tarcze' && (
                    <Toggle label="magiczne" checked={filters.magik} onChange={magik => setFilter({ magik })} />
                )}
                {data && (tab === 'ubrania' || tab === 'dodatki') && (
                    <Select label="Materiał" value={filters.material} options={choices(data[tab], c => c.material)} onChange={material => setFilter({ material })} />
                )}
                {data && tab !== 'odmiany' && (
                    <label className="filter">
                        <span>Braki</span>
                        <select value={filters.braki} onChange={e => setFilter({ braki: e.target.value as Filters['braki'] })}>
                            <option value="">wszystkie</option>
                            <option value="any">z brakami ({gapCounts.get('any') ?? 0})</option>
                            {TAB_GAPS[tab].map(id => (
                                <option key={id} value={id}>bez {gapLabel(id)} ({gapCounts.get(id) ?? 0})</option>
                            ))}
                            <option value="complete">kompletne ({gapCounts.get('complete') ?? 0})</option>
                        </select>
                    </label>
                )}
                <label className="filter filter--sort">
                    <span>Kolejność</span>
                    <select value={sort} onChange={e => setSort(e.target.value as Sort)}>
                        <option value="name">alfabetycznie</option>
                        <option value="votes">najwięcej potwierdzeń</option>
                    </select>
                </label>
            </div>

            <main>
                {load.status === 'loading' && <p className="empty">Wczytywanie spisu…</p>}
                {load.status === 'error' && (
                    <p className="empty empty--error">Nie udało się wczytać spisu ({load.message}). Spróbuj odświeżyć stronę.</p>
                )}
                {data && (
                    <>
                        <p className="summary">
                            {shown[tab]} {pluralize(shown[tab], ...current.forms)}
                            {shown[tab] !== counts[tab] && ` z ${counts[tab]}`}. Kliknij wiersz, żeby zobaczyć szczegóły.
                        </p>
                        {tab === 'bronie' && (
                            <Table<Weapon>
                                rows={weapons}
                                keyOf={nameOf}
                                detail={itemDetail}
                                columns={[
                                    { label: 'Nazwa', cell: w => <span className="name">{w.short}</span>, className: 'list__name' },
                                    { label: 'Typ', cell: w => w.typ },
                                    { label: 'Chwyt', cell: w => w.chwyt, className: 'list__wide' },
                                    { label: 'Obrażenia', cell: w => damageTypes(w).join(', ') },
                                    { label: '', cell: w => <Flags magik={w.magik} srebro={w.srebro} />, className: 'list__flags' },
                                    { label: 'Braki', cell: w => <GapChips gaps={gapsOfItem(w)} />, className: 'list__gaps' },
                                ]}
                            />
                        )}
                        {tab === 'zbroje' && (
                            <Table<Armour>
                                rows={armour}
                                keyOf={nameOf}
                                detail={itemDetail}
                                columns={[
                                    { label: 'Nazwa', cell: a => <span className="name">{a.short}</span>, className: 'list__name' },
                                    { label: 'Typ', cell: a => a.typ },
                                    { label: 'Osłania', cell: a => a.oslona, className: 'list__wide' },
                                    { label: '', cell: a => <Flags magik={a.magik} />, className: 'list__flags' },
                                    { label: 'Braki', cell: a => <GapChips gaps={gapsOfItem(a)} />, className: 'list__gaps' },
                                ]}
                            />
                        )}
                        {tab === 'tarcze' && (
                            <Table<Shield>
                                rows={shields}
                                keyOf={nameOf}
                                detail={itemDetail}
                                columns={[
                                    { label: 'Nazwa', cell: s => <span className="name">{s.short}</span>, className: 'list__name' },
                                    { label: 'Osłania', cell: s => s.oslona, className: 'list__wide' },
                                    { label: '', cell: s => <Flags magik={s.magik} />, className: 'list__flags' },
                                    { label: 'Braki', cell: s => <GapChips gaps={gapsOfItem(s)} />, className: 'list__gaps' },
                                ]}
                            />
                        )}
                        {(tab === 'ubrania' || tab === 'dodatki') && (
                            <Table<Wearable>
                                rows={wearables}
                                keyOf={nameOf}
                                detail={itemDetail}
                                columns={[
                                    { label: 'Nazwa', cell: c => <span className="name">{c.short}</span>, className: 'list__name' },
                                    { label: 'Materiał', cell: c => c.material, className: 'list__wide' },
                                    { label: 'Braki', cell: c => <GapChips gaps={gapsOfItem(c)} />, className: 'list__gaps' },
                                ]}
                            />
                        )}
                        {tab === 'odmiany' && (
                            <Table<Odmiana>
                                rows={odmiany}
                                keyOf={o => o.mianownik}
                                detail={o => <div className="detail detail--single"><DeclensionTable odmiana={o} /></div>}
                                columns={[
                                    { label: 'Mianownik', cell: o => <span className="name">{o.mianownik}</span>, className: 'list__name' },
                                    { label: 'Dopełniacz', cell: o => o.dopelniacz, className: 'list__wide' },
                                    { label: 'Biernik', cell: o => o.biernik, className: 'list__wide' },
                                ]}
                            />
                        )}
                    </>
                )}
            </main>

            <footer className="footer">
                Dane: <a href="https://arkadia-crowd-worker.delwing.workers.dev/crowd/snapshot">snapshot JSON</a>
                {' · '}
                Klient: <a href="https://delwing.github.io/arkadia-web-client-extension/">Arkadia Web Client</a>
                {' · '}
                Waga, cena i oceny jakości nie są zbierane: zależą od umiejętności oceniającej postaci.
            </footer>
        </div>
    );
}
