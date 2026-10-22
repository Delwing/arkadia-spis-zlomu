# Spis złomu Arkadii

Przeglądarka wspólnego spisu złomu (bronie, zbroje, tarcze) i odmian nazw przedmiotów z Arkadii.

**https://delwing.github.io/arkadia-spis-zlomu/**

## Skąd dane

Zbierają je gracze [Arkadia Web Client](https://delwing.github.io/arkadia-web-client-extension/),
którzy włączyli *Udostępniaj mój spis złomu i odmiany* (Ustawienia → Inne). Klient wysyła
anonimowo to, co gracz ocenił (`ocen`) i odmienił (`odmien`).

Zbierane jest tylko to, czym przedmiot jest: nazwa, opis, typ, rodzaj obrażeń, chwyt, magia,
srebro, osłona i to, jak opisuje go `i`. Waga, cena i oceny jakości nie są zbierane, bo zależą
od umiejętności postaci, która ocenia.

Strona czyta publiczny eksport:
`https://arkadia-crowd-worker.delwing.workers.dev/crowd/snapshot`, odświeżany co godzinę.

- Każdą nazwę reprezentuje wersja potwierdzona przez najwięcej graczy (kolumna *Graczy*).
  Inne wersje tej samej nazwy są w szczegółach, pod *Inne wersje tej nazwy*.
- Opis pochodzi z jednego egzemplarza. Opisy tego samego przedmiotu różnią się, np.
  wprawionym klejnotem, więc nie biorą udziału w głosowaniu.

## Rozwój

```sh
yarn
yarn dev      # http://localhost:5181/arkadia-spis-zlomu/
yarn test
yarn build
```

`VITE_SNAPSHOT_URL` podmienia adres danych, np. na lokalny `wrangler dev`.

Wypchnięcie na `master` buduje i publikuje stronę na GitHub Pages
(`.github/workflows/deploy.yml`).
