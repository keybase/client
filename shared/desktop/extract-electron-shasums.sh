#!/bin/bash
if [ -z "$1" ]; then
	echo "Usage: $0 <version>"
	exit 1
fi
script_dir="$(dirname "$0")"
version="$1"
url="https://github.com/electron/electron/releases/download/v$version/SHASUMS256.txt"
sums="$(curl -L -s "$url")"
echo "$sums" | awk '
BEGIN {
  print "// Generated with: ./extract-electron-shasums.sh {ver}";
  print "// prettier-ignore";
  print "export const electronChecksums = {";
}
/electron-.*-(darwin-arm64|darwin-x64|linux-arm64|linux-x64|win32-x64)\.zip|hunspell_dictionaries\.zip/ {
  gsub(/\*/, "", $2);
  print "  \x27"$2"\x27: \x27"$1"\x27,";
}
END {
  print "}";
}' >"$script_dir/electron-sums.tsx"
