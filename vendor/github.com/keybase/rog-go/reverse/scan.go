package reverse

import (
	"bufio"
	"errors"
	"io"
)

const maxBufSize = 256 * 1024

// Scanner presents the same interface as bufio.Scanner
// except it scans tokens in reverse from the end of
// a file instead of forwards from the beginning.
//
// It may not work correctly if the split function can return an
// error from reading half way through a token.
// That is not the case for any of the Scan* functions
// in bufio.
type Scanner struct {
	r io.ReadSeeker

	split bufio.SplitFunc

	// buf holds currently buffered data.
	buf []byte

	// offset holds the file offset of the data
	// in buf.
	offset int64

	// atEOF reports whether the buffer
	// is located at the end of the file.
	atEOF bool

	// tokens holds any currently unscanned
	// tokens in buf.
	tokens [][]byte

	// partialToken holds the size of the partial
	// token at the start of buf.
	partialToken int

	// err holds any error encountered.
	err error
}

// TODO make NewScanner take a ReaderAt rather
// than a ReadSeeker.

// TODO provide a FileOffset method that returns
// the offset of the token in the file.

// NewScanner returns a new Scanner to read tokens
// in reverse from r. The split function defaults to bufio.ScanLines.
func NewScanner(r io.ReadSeeker) *Scanner {
	b := &Scanner{
		r:     r,
		buf:   make([]byte, 4096),
		atEOF: true,
		split: bufio.ScanLines,
	}
	b.offset, b.err = r.Seek(0, 2)
	return b
}

func (b *Scanner) fillbuf() error {
	b.tokens = b.tokens[:0]
	if b.offset == 0 {
		return io.EOF
	}
	space := len(b.buf) - b.partialToken
	if space == 0 {
		// Partial token fills the buffer, so expand it.
		if len(b.buf) >= maxBufSize {
			return errors.New("token too long")
		}
		n := len(b.buf) * 2
		if n > maxBufSize {
			n = maxBufSize
		}
		newBuf := make([]byte, n)
		copy(newBuf, b.buf[0:b.partialToken])
		b.buf = newBuf
		space = len(b.buf) - b.partialToken
	}
	if int64(space) > b.offset {
		// We have less than the given buffer's space
		// left to read, so shrink the buffer to simplify
		// the remaining logic by preserving the
		// invariants that b.partialToken + space == len(buf)
		// and the data is read into the start of buf.
		b.buf = b.buf[0 : b.partialToken+int(b.offset)]
		space = len(b.buf) - b.partialToken
	}
	newOffset := b.offset - int64(space)
	// Copy old partial token to end of buffer.
	copy(b.buf[space:], b.buf[0:b.partialToken])
	_, err := b.r.Seek(newOffset, 0)
	if err != nil {
		return err
	}
	b.offset = newOffset
	if _, err := io.ReadFull(b.r, b.buf[0:space]); err != nil {
		// TODO Cope better with io.UnexpectedEOF at the
		// end of a file - historically some versions of NFS
		// can report a file size that's larger than the actual
		// file size.
		return err
	}
	// Populate b.tokens with the tokens in the buffer.
	if b.offset > 0 {
		// We're not at the start of the file - read the first
		// token to find out where the token boundary is, but
		// don't treat it as an actual token, because we're
		// probably not at its start.
		advance, _, err := b.split(b.buf, b.atEOF)
		if err != nil {
			// If the split function can return an error
			// when starting at a non-token boundary, this
			// will happen and there's not much we can do
			// about it other than scanning forward a byte
			// at a time in a horribly inefficient manner,
			// so just return the error.
			return err
		}
		b.partialToken = advance
		if advance == 0 || advance == len(b.buf) {
			// There are no more tokens in the buffer,
			// or the single token fills the entire buffer
			// so try again (the buffer will expand if
			// necessary)
			return b.fillbuf()
		}
	} else {
		b.partialToken = 0
	}
	for i := b.partialToken; i < len(b.buf); {
		advance, token, err := b.split(b.buf[i:], b.atEOF)
		if err != nil {
			// We've got an error - avoid returning
			// any tokens encountered earlier in this
			// buffer scan, otherwise we risk skipping
			// tokens before returning the error.
			b.tokens = b.tokens[:0]
			return err
		}
		if advance == 0 {
			// There's no remaining token in the buffer.
			break
		}
		b.tokens = append(b.tokens, token)
		i += advance
	}
	b.atEOF = false
	if len(b.tokens) == 0 {
		// There were no tokens found - that means that
		// although we did find a partial token at the start,
		// there were no other tokens, so we need
		// to scan back further.
		return b.fillbuf()
	}
	return nil
}

// Scan advances the Scanner to the next token, which will then be
// available through the Bytes or Text method. It returns false when the
// scan stops, either by reaching the end of the input or an error.
// After Scan returns false, the Err method will return any error that
// occurred during scanning, except that if it was io.EOF, Err
// will return nil.
func (b *Scanner) Scan() bool {
	if len(b.tokens) > 0 {
		b.tokens = b.tokens[0 : len(b.tokens)-1]
	}
	if len(b.tokens) > 0 {
		return true
	}
	if b.err != nil {
		return false
	}
	b.err = b.fillbuf()
	return len(b.tokens) > 0
}

// Split sets the split function for the Scanner. If called, it must be
// called before Scan. The default split function is bufio.ScanLines.
func (b *Scanner) Split(split bufio.SplitFunc) {
	b.split = split
}

// Bytes returns the most recent token generated by a call to Scan.
// The underlying array may point to data that will be overwritten
// by a subsequent call to Scan. It does no allocation.
func (b *Scanner) Bytes() []byte {
	return b.tokens[len(b.tokens)-1]
}

// Text returns the most recent token generated by a call to Scan
// as a newly allocated string holding its bytes.
func (b *Scanner) Text() string {
	return string(b.Bytes())
}

func (b *Scanner) Err() error {
	if len(b.tokens) > 0 {
		return nil
	}
	if b.err == io.EOF {
		return nil
	}
	return b.err
}
