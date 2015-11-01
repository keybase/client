// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

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
