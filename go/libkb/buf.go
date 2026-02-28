// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"bytes"
	"io"
)

// BufferCloser is a Buffer that satisfies the io.Closer
// interface.
type BufferCloser struct {
	*bytes.Buffer
}

func NewBufferCloser() *BufferCloser {
	return &BufferCloser{Buffer: new(bytes.Buffer)}
}

func (b *BufferCloser) Close() error { return nil }

// BufferWriter has a bufio Writer that will Flush before Close.
type BufferWriter struct {
	wc io.WriteCloser
	w  *bufio.Writer
}

func NewBufferWriter(wc io.WriteCloser) *BufferWriter {
	return &BufferWriter{
		wc: wc,
		w:  bufio.NewWriter(wc),
	}
}

func (b *BufferWriter) Write(p []byte) (n int, err error) {
	return b.w.Write(p)
}

func (b *BufferWriter) Close() error {
	b.w.Flush()
	return b.wc.Close()
}
