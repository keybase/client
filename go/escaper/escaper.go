package escaper

import (
	"io"
	"strings"
)

func Clean(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= 32 && r != 127 { // Allow non escape extended characters
			return r
		} else if r == '\n' || r == '\t' { // Allow newlines and tabs
			return r
		} else if r == 0x1b { // Substiture escape byte with '^' (this is how it is usually shown, i.e. in vim)
			return '^'
		}
		return -1
	}, s)
}

func CleanBytes(p []byte) []byte {
	return []byte(Clean(string(p)))
}

type Writer struct {
	io.Writer
}

func (w Writer) Write(p []byte) (int, error) {
	return w.Writer.Write(CleanBytes(p))
}
