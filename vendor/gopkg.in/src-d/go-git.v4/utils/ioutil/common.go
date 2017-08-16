// Package ioutil implements some I/O utility functions.
package ioutil

import (
	"bufio"
	"errors"
	"io"
)

type readPeeker interface {
	io.Reader
	Peek(int) ([]byte, error)
}

var (
	ErrEmptyReader = errors.New("reader is empty")
)

// NonEmptyReader takes a reader and returns it if it is not empty, or
// `ErrEmptyReader` if it is empty. If there is an error when reading the first
// byte of the given reader, it will be propagated.
func NonEmptyReader(r io.Reader) (io.Reader, error) {
	pr, ok := r.(readPeeker)
	if !ok {
		pr = bufio.NewReader(r)
	}

	_, err := pr.Peek(1)
	if err == io.EOF {
		return nil, ErrEmptyReader
	}

	if err != nil {
		return nil, err
	}

	return pr, nil
}

type readCloser struct {
	io.Reader
	closer io.Closer
}

func (r *readCloser) Close() error {
	return r.closer.Close()
}

// NewReadCloser creates an `io.ReadCloser` with the given `io.Reader` and
// `io.Closer`.
func NewReadCloser(r io.Reader, c io.Closer) io.ReadCloser {
	return &readCloser{Reader: r, closer: c}
}

type writeNopCloser struct {
	io.Writer
}

func (writeNopCloser) Close() error { return nil }

// WriteNopCloser returns a WriteCloser with a no-op Close method wrapping
// the provided Writer w.
func WriteNopCloser(w io.Writer) io.WriteCloser {
	return writeNopCloser{w}
}

// CheckClose calls Close on the given io.Closer. If the given *error points to
// nil, it will be assigned the error returned by Close. Otherwise, any error
// returned by Close will be ignored. CheckClose is usually called with defer.
func CheckClose(c io.Closer, err *error) {
	if cerr := c.Close(); cerr != nil && *err == nil {
		*err = cerr
	}
}
