// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package basex

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type fakeReader struct {
	b   byte
	n   int
	err error
}

func (r fakeReader) Read(b []byte) (int, error) {
	for i := 0; i < r.n; i++ {
		b[i] = r.b
	}
	return r.n, r.err
}

// TestDecodeReaderError tests that errors are propagated properly
// from the source reader. In particular, if decoder.Read uses
// io.ReadAtLeast, which drops errors if the minimum is met, then this
// will fail.
func TestDecodeReaderError(t *testing.T) {
	fakeErr := errors.New("fake error")
	encoding := Base58StdEncoding
	// The minimum passed to io.ReadAtLeast is encoding.baseXBlockLen.
	reader := fakeReader{'1', encoding.baseXBlockLen, fakeErr}
	decoder := NewDecoder(Base58StdEncoding, reader)
	var buf [100]byte
	_, err := decoder.Read(buf[:])
	require.Equal(t, fakeErr, err)
}
