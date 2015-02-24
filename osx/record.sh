#/bin/sh
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

RECORD_DIR="$HOME/Library/Application Support/Keybase/Record"

if [ "$1" = "pack" ]; then
	if [ ! -d "$RECORD_DIR" ]; then
		echo "No directory: ${RECORD_DIR}"
		exit 1
	fi
	cd "$RECORD_DIR"
	rm "$DIR/record.zip"
	zip -r "$DIR/record.zip" *
else
	if [ "$1" = "unpack" ]; then
		mkdir -p "$RECORD_DIR"
		cd "$RECORD_DIR"
		unzip "$DIR/record.zip"
	else
		echo "pack or unpack"
	fi
fi

