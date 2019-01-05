#!/bin/sh

FILES=`find $1 -type f -name '*.go' | grep -Ev "^./vendor/"`

for f in $FILES
do
	head -1 $f | grep "Copyright"
	if [ $? -ne  0 ]; then
		tmp=`mktemp $f.XXXXX`
		cat copyright.txt >> $tmp
		cat $f >> $tmp
		mv $tmp $f
	fi
done
