#!/bin/sh
# Example Usage:
#   ./compile.sh inputs/*.iced

for i in $*; do
    input=$i
    output=$(basename -s .iced "$i").json
    echo "$input                   -> $output"
    ../node_modules/.bin/forge-sigchain --team --format iced --pretty < "$input" > "$output"
done
