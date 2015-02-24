package libkb

import (
	"encoding/base32"
	"os"
	"strings"
)

func TempFile(prefix string, mode os.FileMode) (string, *os.File, error) {
	buf, err := RandBytes(20)
	if err != nil {
		return "", nil, err
	}
	suffix := base32.StdEncoding.EncodeToString(buf)
	flags := os.O_WRONLY | os.O_CREATE | os.O_EXCL
	filename := strings.Join([]string{prefix, suffix}, ".")
	if mode == 0 {
		mode = PERM_FILE
	}
	file, err := os.OpenFile(filename, flags, mode)
	return filename, file, err
}
