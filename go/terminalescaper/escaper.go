package terminalescaper

import (
	"io"
	"strings"
)

// Clean escapes the UTF8 encoded string provided as input so it is safe to print on a unix terminal.
// It removes non printing characters and substitutes the vt100 escape character 0x1b with '^'.
func Clean(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= 32 && r != 127 { // Values below 32 (and 127) are special non printing characters (i.e. DEL, ESC, carriage return).
			return r
		} else if r == '\n' || r == '\t' { // Allow newlines and tabs.
			return r
		} else if r == 0x1b { // 0x1b denotes the start of a vt100 escape sequence. Substiture it with '^' (this is how it is usually shown, i.e. in vim).
			return '^'
		}
		return -1
	}, s)
}

// CleanBytes is a wrapper around Clean to work on byte slices instead of strings.
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
	_, err := w.Writer.Write(CleanBytes(p))
	if err == nil {
		return len(p), nil
	}
	w.err = err
	return 0, err
}
