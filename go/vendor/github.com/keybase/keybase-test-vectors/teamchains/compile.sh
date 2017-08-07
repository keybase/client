#!/bin/sh
# Example Usage:
#   ./compile.sh inputs/*.iced

for i in $*; do
	input=$i
	output=`basename -s .iced $1`.json
    echo "$input                   -> $output"
	forge-sigchain --team --format iced --pretty < "$input" > "$output"
done
