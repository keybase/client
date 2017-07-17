// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "bytes"

// BufferCloser is a Buffer that satisfies the io.Closer
// interface.
type BufferCloser struct {
	*bytes.Buffer
}

func NewBufferCloser() *BufferCloser {
	return &BufferCloser{Buffer: new(bytes.Buffer)}
}

func (b *BufferCloser) Close() error { return nil }
