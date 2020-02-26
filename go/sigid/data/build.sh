#!/bin/sh

ALL="sigids-1.0.16"
FIXES="sigid-fixes"
TMP=$(mktemp)

grep -E '^h' $ALL > $TMP
cat $FIXES | awk ' { print "g", $2 }' | sort >> $TMP
iced3 mkdata.iced < $TMP > ../data.go
iced3 mktest.iced < $TMP > ../data_test.go
(cd .. && go fmt .)
rm $TMP
