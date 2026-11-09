# Shot plan: nothing needs a human

Every product shot is recorded by `capture_film.mjs` from the deployed app (see `shots.json`). The opening uses
licensed footage (CC0 and CC BY, `LICENSES.md`). No founder on camera was asked for, so the narrator carries the film.

Optional, if the owner wants a stronger opening later (not needed for this cut):
1. 5–8 landscape phone shots, 4–6 s each, steady, natural light at dusk: a lamp on a doorstep (static, close), an older
   relative's hands on a chessboard or a rangoli (only with their consent), a courtyard or square at dusk (slow pan),
   a phone screen lit in a dark room (slow push). Drop them in `~/Videos/chaupal/` with a note saying what each is;
   `make_footage.py` takes them like the stock clips.
2. Before using a real person: their consent, and the on-screen label changes from "stock" to their name and role.

Capture rules this film follows: real UI only; the dock request is typed (labelled "typed for the recording; she can
also say it"); her tracing is drawn by the script (labelled); long agent waits are cut with an on-screen note giving
the real number of seconds cut; never record while a Remotion render runs.
