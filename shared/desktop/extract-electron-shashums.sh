#!/bin/bash
awk '
BEGIN {
  print "const electronChecksums = {";
}
/electron-.*-(darwin-arm64|darwin-x64|linux-arm64|linux-x64|win32-x64)\.zip|hunspell_dictionaries\.zip/ {
  gsub(/\*/, "", $2);
  print "  [\x27"$2"\x27]: \x27"$1"\x27,";
}
END {
  print "}";
}' ~/Downloads/SHASUMS256.txt
