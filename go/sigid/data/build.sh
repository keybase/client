#!/bin/sh

ALL="sigids-1.0.16"
FIXES="sigid-fixes"
OUT="nacl-1.0.16.txt"

grep -E '^h' $ALL > $OUT
cat $FIXES | awk ' { print "g", $2 }' | sort >> $OUT
iced3 mkdata.iced < $OUT > ../data.go
(cd .. && go fmt .)
