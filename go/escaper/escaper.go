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

// Writer can be used to write data to the underlying io.Writer, while transparently sanitizing it.
// If an error occurs writing to a Writer, all subsequent writes will return the error.
// Note that the sanitization might alter the size of the actual data being written.
type Writer struct {
	err error
	io.Writer
}

// Write writes p to the underlying io.Writer, after sanitizing it.
// It returns n = len(p) on a successful write (regardless of how much data is written).
// This is because the escaping function might alter the actual dimension of the data, but the caller is interested
// in knowing how much of what they wanted to write was actually written. In case of errors it (conservatively) returns n=0
// and the error, and no other writes are possible.
func (w *Writer) Write(p []byte) (int, error) {
	if w.err != nil {
		return 0, w.err
	}
	if _, err := w.Writer.Write(CleanBytes(p)); err == nil {
		return len(p), nil
	} else {
		w.err = err
		return 0, err
	}
}
