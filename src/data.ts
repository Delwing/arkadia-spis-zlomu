/**
 * The crowd snapshot, as the Worker serves it, and what the page does with it.
 *
 * The Worker (arkadia-web-client-extension, crowd-worker/) exports it hourly.
 * Each entry is the version most players agree on; other versions of the same
 * name hang under `alternatives`. `opis` is a sample: one item's description
 * changes copy to copy (a set gem, an empty socket), so it is never voted on.
 */

export const SNAPSHOT_URL: string =
    (import.meta.env.VITE_SNAPSHOT_URL as string | undefined)
    ?? 'https://arkadia-crowd-worker.delwing.workers.dev/crowd/snapshot';

interface Voted {
    confirmations: number;
}

export interface Weapon extends Voted {
    short: string;
    shortAlt?: string;
    typ: string;
    rodzaj: string;
    klute: number;
    obuch: number;
    ciete: number;
    chwyt: string;
    magik: number;
    srebro: number;
    opis: string;
    alternatives?: Weapon[];
}

export interface Shield extends Voted {
    short: string;
    shortAlt?: string;
    magik: number;
    opis: string;
    oslona: string;
    iLine?: string;
    alternatives?: Shield[];
}

export interface Armour extends Voted {
    short: string;
    shortAlt?: string;
    typ: string;
    magik: number;
    opis: string;
    oslona: string;
    iLine?: string;
    alternatives?: Armour[];
}

export interface Odmiana extends Voted {
    mianownik: string;
    dopelniacz: string;
    celownik: string;
    biernik: string;
    narzednik: string;
    miejscownik: string;
    alternatives?: Odmiana[];
}

export interface Snapshot {
    generatedAt: string;
    bronie: Weapon[];
    tarcze: Shield[];
    zbroje: Armour[];
    odmiany: Odmiana[];
}

export type Item = Weapon | Shield | Armour;

function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

export function normalize(raw: unknown): Snapshot {
    const s = (raw ?? {}) as Partial<Snapshot>;
    return {
        generatedAt: typeof s.generatedAt === 'string' ? s.generatedAt : '',
        bronie: asArray<Weapon>(s.bronie),
        tarcze: asArray<Shield>(s.tarcze),
        zbroje: asArray<Armour>(s.zbroje),
        odmiany: asArray<Odmiana>(s.odmiany),
    };
}

export async function loadSnapshot(signal?: AbortSignal): Promise<Snapshot> {
    const response = await fetch(SNAPSHOT_URL, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalize(await response.json());
}

/** Polish letters folded away, lower case: game text is ASCII, a search may not be */
export function fold(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/ł/g, 'l')
        .replace(/Ł/g, 'L')
        .toLowerCase();
}

/** Every word of the query somewhere in the text, in any order and case */
export function matches(query: string, ...texts: (string | undefined)[]): boolean {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const haystack = fold(texts.filter(Boolean).join(' '));
    return words.every(word => haystack.includes(word));
}

/** "1 gracz", "2 graczy"... Polish: gracz / graczy for every count but one */
export function players(count: number): string {
    return `${count} ${count === 1 ? 'gracz' : 'graczy'}`;
}

/** "kilka" forms for the tab counters: 1 przedmiot, 2-4 przedmioty, 5+ przedmiotow */
export function pluralize(count: number, one: string, few: string, many: string): string {
    const lastTwo = count % 100;
    const last = count % 10;
    if (count === 1) return one;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
    return many;
}

export function damageTypes(weapon: Weapon): string[] {
    return [
        weapon.klute ? 'kłute' : '',
        weapon.ciete ? 'cięte' : '',
        weapon.obuch ? 'obuchowe' : '',
    ].filter(Boolean);
}

/** The declension of an item's name, when someone has sent it */
export function odmianaIndex(odmiany: Odmiana[]): Map<string, Odmiana> {
    return new Map(odmiany.map(o => [o.mianownik.toLowerCase(), o]));
}

/** Distinct values of a field, for a filter's choices, most common first */
export function choices<T>(items: T[], pick: (item: T) => string): string[] {
    const counts = new Map<string, number>();
    for (const item of items) {
        const value = pick(item).trim();
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl')).map(([value]) => value);
}
