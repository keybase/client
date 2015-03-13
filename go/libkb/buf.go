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
