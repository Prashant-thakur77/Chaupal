# Sulekh fonts

All fonts come from the `ofl/` directory of the google/fonts repository and are served from `public/fonts/<family>/` (URL `/fonts/<family>/<file>`). Each family folder keeps that family's `OFL.txt` unchanged. Nothing is subset: phrases are arbitrary, so the full glyph set ships.

Re-download with `scripts/sulekh/fetch-fonts.sh`; re-check with `pnpm exec tsx scripts/sulekh/verify-fonts.ts`, which checks the licence text (SIL Open Font License 1.1), the file size against the catalog, and shapes every catalog phrase and every eval phrase for the font's script with HarfBuzz, failing on any `.notdef` glyph (id 0) or inserted dotted circle.

## Table

| Family | Font id | File | Size | Licence | Scripts | Styles | Coverage |
|---|---|---|---|---|---|---|---|
| Kalam | `kalam-bold` | `public/fonts/kalam/Kalam-Bold.ttf` | 450 KB | OFL 1.1 | devanagari | kalam | pass (28 phrases, 0 notdef) |
| Amita | `amita-bold` | `public/fonts/amita/Amita-Bold.ttf` | 216 KB | OFL 1.1 | devanagari | brush | pass (28 phrases, 0 notdef) |
| Yatra One | `yatra-one` | `public/fonts/yatraone/YatraOne-Regular.ttf` | 270 KB | OFL 1.1 | devanagari | brush (alt) | pass (28 phrases, 0 notdef) |
| Tiro Devanagari Hindi | `tiro-devanagari-hindi` | `public/fonts/tirodevanagarihindi/TiroDevanagariHindi-Regular.ttf` | 413 KB | OFL 1.1 | devanagari | modern | pass (28 phrases, 0 notdef) |
| Rozha One | `rozha-one` | `public/fonts/rozhaone/RozhaOne-Regular.ttf` | 315 KB | OFL 1.1 | devanagari | modern (alt) | pass (28 phrases, 0 notdef) |
| Baloo Paaji 2 | `baloo-paaji-2` | `public/fonts/baloopaaji2/BalooPaaji2-wght.ttf` | 237 KB | OFL 1.1 | gurmukhi | kalam, brush | pass (16 phrases, 0 notdef) |
| Mukta Mahee | `mukta-mahee` | `public/fonts/muktamahee/MuktaMahee-Regular.ttf` | 206 KB | OFL 1.1 | gurmukhi | modern | pass (16 phrases, 0 notdef) |
| Catamaran | `catamaran` | `public/fonts/catamaran/Catamaran-SemiBold.ttf` | 52 KB | OFL 1.1 | tamil | brush, modern | pass (17 phrases, 0 notdef) |
| Meera Inimai | `meera-inimai` | `public/fonts/meerainimai/MeeraInimai-Regular.ttf` | 71 KB | OFL 1.1 | tamil | kalam | pass (17 phrases, 0 notdef) |
| Galada | `galada` | `public/fonts/galada/Galada-Regular.ttf` | 183 KB | OFL 1.1 | bengali | kalam, brush | pass (17 phrases, 0 notdef) |
| Baloo Da 2 | `baloo-da-2` | `public/fonts/balooda2/BalooDa2-wght.ttf` | 441 KB | OFL 1.1 | bengali | modern | pass (17 phrases, 0 notdef) |
| Noto Nastaliq Urdu | `noto-nastaliq-urdu` | `public/fonts/notonastaliqurdu/NotoNastaliqUrdu-wght.ttf` | 674 KB | OFL 1.1 | urdu | kalam, brush, modern | pass (17 phrases, 0 notdef) |

Total payload: 3.45 MB over 12 files; the largest single file is 674 KB (no file over 2 MB). The engine loads only the one font a render needs. Sanskrit and Marathi use the Devanagari fonts (language tag `sa` / `mr` is passed to HarfBuzz).

Every candidate named in the brief passed, so none was dropped.

## Notes per file

- **Variable fonts.** `BalooPaaji2-wght.ttf`, `BalooDa2-wght.ttf` and `NotoNastaliqUrdu-wght.ttf` are the upstream variable fonts (`[wght]` in the upstream file name, renamed because brackets are awkward in URLs). Their default instance is Regular (wght 400), and Sulekh always renders the default instance: HarfBuzz shapes with default coordinates and outlines come from the `glyf` table (no `gvar` deltas applied).
- **Catamaran.** Upstream ships only `Catamaran[wght].ttf`, whose default instance is Thin (wght 100), too faint for a tracing reference. `Catamaran-SemiBold.ttf` is a static instance at wght 600 made with `fontTools.varLib.instancer --static --update-name-table` (see `scripts/sulekh/fetch-fonts.sh`). This is a Modified Version under the OFL; the Catamaran OFL declares no Reserved Font Name, and its `OFL.txt` is kept as-is beside it.
- **Galada.** Its `OFL.txt` declares the Reserved Font Name "Lobster". The file is shipped unmodified under its own name, so the reservation is not affected.
- **Outline format.** All files are TrueType (`glyf`) fonts; the engine reads outlines from `glyf` and rejects CFF/OTF, WOFF and collections.

## Styles per script

| Script | kalam | brush | modern | Plainest (OCR control) |
|---|---|---|---|---|
| devanagari (hi, mr, sa) | Kalam Bold | Amita Bold (alt Yatra One) | Tiro Devanagari Hindi (alt Rozha One) | Tiro Devanagari Hindi |
| gurmukhi (pa) | Baloo Paaji 2 | Baloo Paaji 2 | Mukta Mahee | Mukta Mahee |
| tamil (ta) | Meera Inimai | Catamaran SemiBold | Catamaran SemiBold | Catamaran SemiBold |
| bengali (bn) | Galada | Galada | Baloo Da 2 | Baloo Da 2 |
| urdu (ur) | Noto Nastaliq Urdu | Noto Nastaliq Urdu | Noto Nastaliq Urdu | Noto Nastaliq Urdu |
