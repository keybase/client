// Package buffruneio provides rune-based buffered input.
package buffruneio

import (
	"bufio"
	"errors"
	"io"
	"unicode/utf8"
)

// EOF is a rune value indicating end-of-file.
const EOF = -1

// ErrNoRuneToUnread is the error returned when UnreadRune is called with nothing to unread.
var ErrNoRuneToUnread = errors.New("no rune to unwind")

// A Reader implements rune-based input for an underlying byte stream.
type Reader struct {
	buffer  []rune
	current int
	input   *bufio.Reader
}

// NewReader returns a new Reader reading the given input.
func NewReader(input io.Reader) *Reader {
	return &Reader{
		input: bufio.NewReader(input),
	}
}

// The rune buffer stores -2 to represent RuneError of length 1 (UTF-8 decoding errors).
const badRune = -2

// feedBuffer adds a rune to the buffer.
// If EOF is reached, it adds EOF to the buffer and returns nil.
// If a different error is encountered, it returns the error without
// adding to the buffer.
func (rd *Reader) feedBuffer() error {
	if rd.buffer == nil {
		rd.buffer = make([]rune, 0, 256)
	}
	r, size, err := rd.input.ReadRune()
	if err != nil {
		if err != io.EOF {
			return err
		}
		r = EOF
	}
	if r == utf8.RuneError && size == 1 {
		r = badRune
	}
	rd.buffer = append(rd.buffer, r)
	return nil
}

// ReadRune reads and returns the next rune from the input.
// The rune is also saved in an internal buffer, in case UnreadRune is called.
// To avoid unbounded buffer growth, the caller must call Forget at appropriate intervals.
//
// At end of file, ReadRune returns EOF, 0, nil.
// On read errors other than io.EOF, ReadRune returns EOF, 0, err.
func (rd *Reader) ReadRune() (rune, int, error) {
	if rd.current >= len(rd.buffer) {
		if err := rd.feedBuffer(); err != nil {
			return EOF, 0, err
		}
	}
	r := rd.buffer[rd.current]
	rd.current++
	if r == badRune {
		return utf8.RuneError, 1, nil
	}
	if r == EOF {
		return EOF, 0, nil
	}
	return r, utf8.RuneLen(r), nil
}

// UnreadRune rewinds the input by one rune, undoing the effect of a single ReadRune call.
// UnreadRune may be called multiple times to rewind a sequence of ReadRune calls,
// up to the last time Forget was called or the beginning of the input.
//
// If there are no ReadRune calls left to undo, UnreadRune returns ErrNoRuneToUnread.
func (rd *Reader) UnreadRune() error {
	if rd.current == 0 {
		return ErrNoRuneToUnread
	}
	rd.current--
	return nil
}

// Forget discards buffered runes before the current input position.
// Calling Forget makes it impossible to UnreadRune earlier than the current input position
// but is necessary to avoid unbounded buffer growth.
func (rd *Reader) Forget() {
	n := copy(rd.buffer, rd.buffer[rd.current:])
	rd.current = 0
	rd.buffer = rd.buffer[:n]
}

// PeekRunes returns the next n runes in the input,
// without advancing the current input position.
//
// If the input has fewer than n runes and then returns
// an io.EOF error, PeekRune returns a slice containing
// the available runes followed by EOF.
// On other hand, if the input ends early with a non-io.EOF error,
// PeekRune returns a slice containing only the available runes,
// with no terminating EOF.
func (rd *Reader) PeekRunes(n int) []rune {
	for len(rd.buffer)-rd.current < n && !rd.haveEOF() {
		if err := rd.feedBuffer(); err != nil {
			break
		}
	}

	res := make([]rune, 0, n)
	for i := 0; i < n; i++ {
		r := rd.buffer[rd.current+i]
		if r == badRune {
			r = utf8.RuneError
		}
		res = append(res, r)
		if r == EOF {
			break
		}
	}
	return res
}

func (rd *Reader) haveEOF() bool {
	return rd.current < len(rd.buffer) && rd.buffer[len(rd.buffer)-1] == EOF
}
