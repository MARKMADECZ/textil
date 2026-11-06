# textil.markmade.cz – produktové stránky

Statický web s vlastní stránkou pro každý model z online katalogu markmade.cz (kategorie → značka → model).
Katalog na markmade.cz se nemění; tlačítko "Vybrat barvy a poptat v katalogu" na každé stránce otevře původní okno katalogu.

## Jak to funguje

**Výchozí od 6. 11. 2026: web řídí server.** Zdrojem pravdy jsou data na console.markmade.cz; GitHub web jen sestaví a hostuje.

- Server (VPS) časovačem `markmade-textil-dispatch.timer` každé 2 minuty čte veřejnou revizi katalogu a ceník potisku.
  Při změně pošle GitHubu `repository_dispatch` typu `catalog-changed` (pojistka nejvýš 1× za 10 min).
  Zdroj a instalace: `runtime/textil-dispatch/` v hlavním projektu (verzovaná kopie v repu katalog-build, složka `textil-dispatch/`).
- Workflow nejdřív stáhne ceny (`tools/server-prices.js`) a `tools/state.js` porovná otisk dat s nasazeným
  `https://textil.markmade.cz/build-state.json`:
  - beze změny → nic,
  - jen ceny → přestavba z posledních stažených detailů v cache (pár minut),
  - nový/odebraný model nebo změna ceníku potisku → plné stažení katalogu.
- Záložní spuštění: plánovač GitHubu (`7,22,37,52 * * * *`, na bezplatném repu ale chodí s hodinovým zpožděním),
  každé pondělí plné obnovení, push a ruční „Run workflow“ vždy plně.
- Klíč GitHubu na serveru: `/etc/markmade-textil/dispatch-token` (fine-grained `textil-server-dispatch`, jen toto repo,
  Contents: Read and write). Výměna: zkopírovat nový klíč a spustit `runtime/textil-dispatch/ULOZIT-KLIC-ZE-SCHRANKY.cmd`.

Plné sestavení (push, ruční spuštění, pondělí, změna modelů/potisku) udělá:

1. `tools/scrape-all.js` otevře online katalog a přečte data všech modelů (cca 30–40 min),
2. `tools/make-raw.js` je připraví pro generátor (při méně než 1500 modelech skončí chybou a web se nenasadí),
3. `tools/server-prices.js` stáhne ze serveru (console.markmade.cz) ceny textilu všech modelů – „od“ = nejlevnější objednatelná varianta (od 5. 11. 2026; detail katalogu ukazuje výchozí barvu, ne nejlevnější). Bez kompletních cen ze serveru build skončí chybou,
4. `build.js` vygeneruje web (ceny textilu bere ze serveru), `validate.js` zkontroluje titulky, popisy, JSON-LD, odkazy a sitemapu,
5. výsledek se nasadí na GitHub Pages.

Ceny na webu se tím aktualizují samy do cca 5–15 minut po změně na serveru.

## Nastavení (jednorázově)

- Settings → Pages → Source: **GitHub Actions**; Custom domain: `textil.markmade.cz`; zapnout Enforce HTTPS.
- DNS u správce domény markmade.cz: záznam `textil` typu CNAME na `markmadecz.github.io`.
- Search Console (vlastnost typu Doména markmade.cz): odeslat `https://textil.markmade.cz/sitemap.xml`; stejně v Bing a Seznam Webmaster.
- Na hlavním webu (Webnode) přidat odkazy na https://textil.markmade.cz/ a na kategorie /tricka/, /mikiny/, /polokosile/, /cepice/, /pracovni-odevy/.

## Struktura adres

```
/                                  přehled kategorií
/tricka/                           kategorie (stránkováno po 48)
/tricka/sols/                      značka v kategorii
/tricka/sols/regent-25-1380/       produkt
/pracovni-odevy/                   tématický přehled podle použití
```
