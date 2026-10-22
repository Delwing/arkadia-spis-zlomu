import { describe, expect, it } from 'vitest';
import { choices, damageTypes, fold, matches, normalize, odmianaIndex, pluralize, players, type Weapon } from './data';

describe('matches', () => {
    it('finds every word, in any order, case and with or without Polish letters', () => {
        expect(matches('topór bojowy', 'krasnoludzki asymetryczny topor bojowy')).toBe(true);
        expect(matches('BOJOWY krasno', 'krasnoludzki asymetryczny topor bojowy')).toBe(true);
        expect(matches('miecz', 'krasnoludzki asymetryczny topor bojowy')).toBe(false);
    });

    it('looks in every text given, and an empty query matches all', () => {
        expect(matches('czaszke', 'dluga ciemna laska', 'osadzono biala czaszke')).toBe(true);
        expect(matches('  ', 'cokolwiek')).toBe(true);
    });

    it('folds ł, which NFD does not take apart', () => {
        expect(fold('Łuk ŁUSKA')).toBe('luk luska');
    });
});

describe('Polish counts', () => {
    it('says gracz for one and graczy otherwise', () => {
        expect(players(1)).toBe('1 gracz');
        expect(players(3)).toBe('3 graczy');
    });

    it('picks the few form for 2-4, but not the teens', () => {
        const form = (n: number) => pluralize(n, 'przedmiot', 'przedmioty', 'przedmiotów');
        expect([1, 2, 4, 5, 12, 14, 22, 25, 112].map(form)).toEqual([
            'przedmiot', 'przedmioty', 'przedmioty', 'przedmiotów', 'przedmiotów', 'przedmiotów',
            'przedmioty', 'przedmiotów', 'przedmiotów',
        ]);
    });
});

describe('normalize', () => {
    it('survives a snapshot with groups missing', () => {
        expect(normalize({ bronie: [{ short: 'x' }] })).toMatchObject({ bronie: [{ short: 'x' }], tarcze: [], odmiany: [] });
        expect(normalize(null).zbroje).toEqual([]);
    });
});

describe('helpers', () => {
    it('lists damage types', () => {
        expect(damageTypes({ klute: 1, ciete: 1, obuch: 0 } as Weapon)).toEqual(['kłute', 'cięte']);
    });

    it('offers filter choices most common first', () => {
        expect(choices([{ t: 'miecze' }, { t: 'topory' }, { t: 'miecze' }, { t: '' }], x => x.t)).toEqual(['miecze', 'topory']);
    });

    it('indexes declensions by mianownik', () => {
        const odmiana = { mianownik: 'Plecak', dopelniacz: 'plecaka', celownik: '', biernik: '', narzednik: '', miejscownik: '', confirmations: 1 };
        expect(odmianaIndex([odmiana]).get('plecak')).toBe(odmiana);
    });
});
