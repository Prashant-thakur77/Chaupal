#!/usr/bin/env bash
# Re-download the Sulekh fonts (OFL, google/fonts ofl/ directory) into
# public/fonts/<family>/ together with each family's OFL.txt, unchanged.
#
# Catamaran ships only as a variable font whose default instance is Thin
# (wght 100), too faint for a tracing reference, so it is instantiated once
# at wght 600 with fontTools (pip install fonttools). No other file is
# modified; nothing is subset.
set -euo pipefail
cd "$(dirname "$0")/../../public/fonts"
R=https://raw.githubusercontent.com/google/fonts/main/ofl

dl() { # dir upstream-file local-file
  mkdir -p "$1"
  curl -sfL "$R/$1/$2" -o "$1/$3"
  curl -sfL "$R/$1/OFL.txt" -o "$1/OFL.txt"
}

dl kalam Kalam-Bold.ttf Kalam-Bold.ttf
dl amita Amita-Bold.ttf Amita-Bold.ttf
dl yatraone YatraOne-Regular.ttf YatraOne-Regular.ttf
dl tirodevanagarihindi TiroDevanagariHindi-Regular.ttf TiroDevanagariHindi-Regular.ttf
dl rozhaone RozhaOne-Regular.ttf RozhaOne-Regular.ttf
dl baloopaaji2 'BalooPaaji2%5Bwght%5D.ttf' BalooPaaji2-wght.ttf
dl muktamahee MuktaMahee-Regular.ttf MuktaMahee-Regular.ttf
dl catamaran 'Catamaran%5Bwght%5D.ttf' Catamaran-wght.ttf
dl meerainimai MeeraInimai-Regular.ttf MeeraInimai-Regular.ttf
dl galada Galada-Regular.ttf Galada-Regular.ttf
dl balooda2 'BalooDa2%5Bwght%5D.ttf' BalooDa2-wght.ttf
dl notonastaliqurdu 'NotoNastaliqUrdu%5Bwght%5D.ttf' NotoNastaliqUrdu-wght.ttf

python3 -m fontTools.varLib.instancer catamaran/Catamaran-wght.ttf wght=600 \
  --static --update-name-table -o catamaran/Catamaran-SemiBold.ttf
rm catamaran/Catamaran-wght.ttf
ls -l */
