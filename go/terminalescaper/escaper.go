package terminalescaper

import (
	"io"
	"unicode/utf8"
)

// Taken from unexported data at golang.org/x/crypto/ssh/terminal
// and expanded with data at github.com/keybase/client/go/client:color.go
type EscapeCode []byte

var keyEscape byte = 27
var vt100EscapeCodes = []EscapeCode{
	// Foreground colors
	{keyEscape, '[', '3', '0', 'm'},
	{keyEscape, '[', '3', '1', 'm'},
	{keyEscape, '[', '3', '2', 'm'},
	{keyEscape, '[', '3', '3', 'm'},
	{keyEscape, '[', '3', '4', 'm'},
	{keyEscape, '[', '3', '5', 'm'},
	{keyEscape, '[', '3', '6', 'm'},
	{keyEscape, '[', '3', '7', 'm'},
	{keyEscape, '[', '9', '0', 'm'},
	// Reset foreground color
	{keyEscape, '[', '3', '9', 'm'},
	// Bold
	{keyEscape, '[', '1', 'm'},
	// Italic
	{keyEscape, '[', '3', 'm'},
	// Underline
	{keyEscape, '[', '4', 'm'},
	// Reset bold (or doubly underline according to ECMA-48; fallback is code [22m)
	// See https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
	{keyEscape, '[', '2', '1', 'm'},
	// Normal intensity
	{keyEscape, '[', '2', '2', 'm'},
	// Reset italic
	{keyEscape, '[', '2', '3', 'm'},
	// Reset underline
	{keyEscape, '[', '2', '4', 'm'},
	// Reset all formatting
	{keyEscape, '[', '0', 'm'},
}

// Clean escapes the UTF8 encoded string provided as input so it is safe to print on a unix terminal.
// It removes non printing characters and substitutes the vt100 escape character 0x1b with '^['.
func Clean(s string) string {
	return replace(func(r rune) rune {
		switch {
		case r >= 32 && r != 127: // Values below 32 (and 127) are special non printing characters (i.e. DEL, ESC, carriage return).
			return r
		case r == '\n' || r == '\t': // Allow newlines and tabs.
			return r
		case r == rune(keyEscape):
			// Start of a vt100 escape sequence. If not a color, we will
			// substitute it with '^[' (this is how it is usually shown, i.e.
			// in vim).
			return -1
		}
		return -2
	}, s)
}

func isStartOfColorCode(s string, i int) bool {
outer:
	for _, code := range vt100EscapeCodes {
		if i+len(code) > len(s) {
			continue
		}
		for j, c := range code {
			if s[i+j] != c {
				continue outer
			}
		}
		return true
	}
	return false
}

// replace returns a copy of the string s with all its characters modified
// according to the mapping function.
// If mapping returns -1, the character is substituted with the two character string `^[` (unless it is the start of a color code).
// If mapping returns any other negative value, the character is dropped from the string with no replacement.
// This function is copied from strings.Map, and is identical except for how -1 is handled (differences are marked).
func replace(mapping func(rune) rune, s string) string {
	// In the worst case, the string can grow when mapped, making
	// things unpleasant. But it's so rare we barge in assuming it's
	// fine. It could also shrink but that falls out naturally.

	// The output buffer b is initialized on demand, the first
	// time a character differs.
	var b []byte
	// nbytes is the number of bytes encoded in b.
	var nbytes int

	for i, c := range s {
		r := mapping(c)
		if r == c {
			continue
		}

		b = make([]byte, len(s)+utf8.UTFMax)
		nbytes = copy(b, s[:i])
		switch {
		case r >= 0:
			if r <= utf8.RuneSelf {
				b[nbytes] = byte(r)
				nbytes++
			} else {
				nbytes += utf8.EncodeRune(b[nbytes:], r)
			}
		case r == -1 && isStartOfColorCode(s, i):
			// This branch is NOT part of strings.Map
			// Allow color codes.
			b[nbytes] = byte(c)
			nbytes++
		case r == -1:
			// This else branch is NOT part of strings.Map
			// Substitute escape code with ^[ to nullify it.
			b[nbytes] = byte('^')
			b[nbytes+1] = byte('[')
			nbytes += 2
		}

		if c == utf8.RuneError {
			// RuneError is the result of either decoding
			// an invalid sequence or '\uFFFD'. Determine
			// the correct number of bytes we need to advance.
			_, w := utf8.DecodeRuneInString(s[i:])
			i += w
		} else {
			i += utf8.RuneLen(c)
		}

		s = s[i:]
		break
	}

	if b == nil {
		return s
	}

	for i, c := range s {
		r := mapping(c)

		// common case
		if (0 <= r && r <= utf8.RuneSelf) && nbytes < len(b) {
			b[nbytes] = byte(r)
			nbytes++
			continue
		}

		// b is not big enough or r is not a ASCII rune.
		// The isStartOfColorCode check is NOT part of strings.Map
		switch {
		case r >= 0:
			if nbytes+utf8.UTFMax >= len(b) {
				// Grow the buffer.
				nb := make([]byte, 2*len(b))
				copy(nb, b[:nbytes])
				b = nb
			}
			nbytes += utf8.EncodeRune(b[nbytes:], r)
		case r == -1 && isStartOfColorCode(s, i):
			// This branch is NOT part of strings.Map
			// Allow color codes.
			b[nbytes] = byte(c)
			nbytes++
		case r == -1: // This else branch is NOT part of strings.Map, but mirrors the preceding if branch
			if nbytes+2 >= len(b) {
				// Grow the buffer.
				nb := make([]byte, 2*len(b))
				copy(nb, b[:nbytes])
				b = nb
			}
			b[nbytes] = byte('^')
			b[nbytes+1] = byte('[')
			nbytes += 2
		}
	}

	return string(b[:nbytes])
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
