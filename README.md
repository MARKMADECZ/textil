# textil.markmade.cz – produktové stránky

Statický web s vlastní stránkou pro každý model z online katalogu markmade.cz (kategorie → značka → model).
Katalog na markmade.cz se nemění; tlačítko "Vybrat barvy a poptat v katalogu" na každé stránce otevře původní okno katalogu.

## Jak to funguje

GitHub Actions (`.github/workflows/pages.yml`) při každém pushi a **každé pondělí ve 3:00** udělá:

1. `tools/scrape-all.js` otevře online katalog a přečte data všech modelů (cca 30–40 min),
2. `tools/make-raw.js` je připraví pro generátor (při méně než 1500 modelech skončí chybou a web se nenasadí),
3. `build.js` vygeneruje web, `validate.js` zkontroluje titulky, popisy, JSON-LD, odkazy a sitemapu,
4. výsledek se nasadí na GitHub Pages.

Ceny na webu se tím aktualizují samy podle katalogu.

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
