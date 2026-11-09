# Outside assets in the Chaupal film

Every asset that was not made for this film, with its licence. Nothing in the film is under a licence that
requires attribution: the footage is CC0 or public domain, the fonts are OFL (no on-screen credit needed), and
everything else was made for the film or recorded from the app.

| Asset | Used for | Source | Author (as listed) | Licence | Credit owed? | Accessed |
|---|---|---|---|---|---|---|
| "Eastern Europe to Southeastern Asia at Night" — 0:19.0–0:21.7 (city lights from orbit), cropped to 16:9 and slowed with motion interpolation | opening footage | https://commons.wikimedia.org/wiki/File:Eastern_Europe_to_Southeastern_Asia_at_Night.ogv | ISS Expedition 29 crew (NASA) | Public domain (NASA material is not copyrighted) | No | 2026-11-09 |
| "Women at Work - Sukhad Watchal (Comfortable journey)" — 0:23.0–0:26.4 (village path), 1:25.6–1:28.2 (hands at work) | opening footage | https://commons.wikimedia.org/wiki/File:Women_at_Work_-_Sukhad_Watchal_(Comfortable_journey).webm | Lek Ladki Abhiyan | CC0 1.0 | No | 2026-11-09 |
| "Women at Work - Vishwasu Prawas (Trusted transport)" — 6:29.0–6:31.6 (a hand on the controls) | opening footage | https://commons.wikimedia.org/wiki/File:Women_at_Work_-_Vishwasu_Prawas_(Trusted_transport).webm | Lek Ladki Abhiyan | CC0 1.0 | No | 2026-11-09 |
| Tiro Devanagari Hindi (Regular, Italic), Mukta (400–700), Yatra One | all type | Google Fonts / @fontsource 5.0.0 via jsdelivr | their designers | SIL Open Font License 1.1 (OFL.txt kept in film/public/fonts) | No (OFL needs no on-screen credit) | 2026-11-09 |

Made for this film or by the app itself (nothing owed):
- Music: composed and synthesised in numpy (`video/music.py`): bansuri, santoor and tabla are all synthesis, no samples.
- Sound effects: synthesised in numpy (`video/tools/sfx_synth.py`, `video/sfx_chaupal.py`).
- Narration: local Chatterbox TTS (MIT licence) with its built-in voice; no cloned person.
- The kolam (5×5 pulli), rangoli and Sulekh calligraphy shapes: the Chaupal app's own engines (sample outputs in `.chaupal-work/kolam-samples`, `.chaupal-work/sulekh-samples`).
- 3D diya, shatranj board and the chabutra stack: procedural three.js geometry written for this film.
- Product footage: recorded from the deployed app (chaupal.prashantthakur.dev).

Removed on the owner's decision (no credit in the video): an earlier cut used two shots from a CC BY 3.0 film; they are
gone. Rejected on licence grounds: Wikimedia clips under CC BY-SA ("Deepavali diyas in RR Nagar", "Video of Brigade Road, Bangalore at night",
"Village in Kerala", "Channasandra at night") — share-alike would bind the whole film; not used.
