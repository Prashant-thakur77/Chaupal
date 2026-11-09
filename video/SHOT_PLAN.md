# Shot plan: nothing needs a human

Every product shot is recorded by `capture_film.mjs` from the deployed app (see `shots.json`). The opening uses
CC0 and public-domain footage (`LICENSES.md`). No founder on camera was asked for, so the narrator carries the film.

Optional, if the owner wants a stronger opening later (not needed for this cut):
1. 5–8 landscape phone shots, 4–6 s each, steady, natural light at dusk: a lamp on a doorstep (static, close), an older
   relative's hands on a chessboard or a rangoli (only with their consent), a courtyard or square at dusk (slow pan),
   a phone screen lit in a dark room (slow push). Drop them in `~/Videos/chaupal/` with a note saying what each is;
   `make_footage.py` takes them like the stock clips.
2. Before using a real person: their consent, and the on-screen label changes from "stock" to their name and role.

Capture rules this film follows: real UI only; the dock request is typed (labelled "typed for the recording; she can
also say it"); her tracing is drawn by the script (labelled); long agent waits are cut with an on-screen note giving
the real number of seconds cut; never record while a Remotion render runs.

## Optional: the Telegram chat on a real phone (drops in with one rerun)
The film shows the real send (her "हाँ" on her screen, then a proof line built from the Telegram Bot API reply: message
id and time, next to the exact picture and caption that were sent). No Telegram app UI is drawn. If the owner wants
the other end on camera:
1. On his phone, open the family chat the bot posts to, and screen-record (portrait) while a send happens, or while
   scrolling to the received rangoli picture: 6–8 s, steady, no other chats or names visible.
2. Save it as `video/footage/telegram-phone.mp4`.
3. Run `python3 video/make_film.py` and render: the phone recording replaces the picture card in the Telegram beat.
