// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

// chunker is an interface for a type that emits a sequence of
// plaintext chunks.
//
// Implementations should follow exampleChunker in
// chunk_reader_test.go pretty closely.
type chunker interface {
	// getNextChunk() returns a plaintext chunk with an error. If
	// the chunk is empty, the error must be non-nil. Once
	// getNextChunk() returns a non-nil error (which may be
	// io.EOF), it can assume that it will never be called again.
	getNextChunk() ([]byte, error)
}

// chunkReader is an io.Reader adaptor for chunker.
type chunkReader struct {
	chunker   chunker
	prevChunk []byte
	prevErr   error
}

func newChunkReader(chunker chunker) *chunkReader {
	return &chunkReader{chunker: chunker}
}

func (r *chunkReader) Read(p []byte) (n int, err error) {
	// Copy data into p until it is full, or getNextChunk()
	// returns a non-nil error.
	for {
		// Drain r.prevChunk first before checking for an error.
		if len(r.prevChunk) > 0 {
			copied := copy(p[n:], r.prevChunk)
			n += copied
			r.prevChunk = r.prevChunk[copied:]
			if len(r.prevChunk) > 0 {
				// p is full.
				return n, nil
			}
		}

		if r.prevErr != nil {
			// r.prevChunk is fully drained, so return the
			// error.
			return n, r.prevErr
		}

		r.prevChunk, r.prevErr = r.chunker.getNextChunk()
		if len(r.prevChunk) == 0 && r.prevErr == nil {
			panic("empty chunk and nil error")
		}
	}
}
