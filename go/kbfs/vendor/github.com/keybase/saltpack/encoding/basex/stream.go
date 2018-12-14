// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package basex

import "io"

// Much of this code is adopted from Go's encoding/base64

// EncodeToString returns the baseX encoding of src.
func (enc *Encoding) EncodeToString(src []byte) string {
	buf := make([]byte, enc.EncodedLen(len(src)))
	enc.Encode(buf, src)
	return string(buf)
}

type encoder struct {
	err  error
	enc  *Encoding
	w    io.Writer
	buf  []byte // buffered data waiting to be encoded
	nbuf int    // number of bytes in buf
	out  []byte // output buffer
}

func (e *encoder) Write(p []byte) (n int, err error) {
	if e.err != nil {
		return 0, e.err
	}

	ibl := e.enc.base256BlockLen
	obl := e.enc.baseXBlockLen

	// Leading fringe.
	if e.nbuf > 0 {
		var i int
		for i = 0; i < len(p) && e.nbuf < ibl; i++ {
			e.buf[e.nbuf] = p[i]
			e.nbuf++
		}
		n += i
		p = p[i:]
		if e.nbuf < ibl {
			return
		}
		e.enc.Encode(e.out[:], e.buf[:])
		if _, e.err = e.w.Write(e.out[:obl]); e.err != nil {
			return n, e.err
		}
		e.nbuf = 0
	}

	// Large interior chunks.
	for len(p) >= ibl {
		nn := len(e.out) / obl * ibl
		if nn > len(p) {
			nn = len(p)
			nn -= nn % ibl
		}
		e.enc.Encode(e.out[:], p[:nn])
		if _, e.err = e.w.Write(e.out[0 : nn/ibl*obl]); e.err != nil {
			return n, e.err
		}
		n += nn
		p = p[nn:]
	}

	// Trailing fringe.
	copy(e.buf[0:len(p)], p)
	e.nbuf = len(p)
	n += len(p)
	return
}

// Close flushes any pending output from the encoder.
// It is an error to call Write after calling Close.
func (e *encoder) Close() error {
	// If there's anything left in the buffer, flush it out
	if e.err == nil && e.nbuf > 0 {
		e.enc.Encode(e.out[:], e.buf[:e.nbuf])
		_, e.err = e.w.Write(e.out[:e.enc.EncodedLen(e.nbuf)])
		e.nbuf = 0
	}
	return e.err
}

// NewEncoder returns a new baseX stream encoder.  Data written to
// the returned writer will be encoded using enc and then written to w.
// Encodings operate in enc.baseXBlockLen-byte blocks; when finished
// writing, the caller must Close the returned encoder to flush any
// partially written blocks.
func NewEncoder(enc *Encoding, w io.Writer) io.WriteCloser {
	return &encoder{
		enc: enc,
		w:   w,
		buf: make([]byte, enc.base256BlockLen),
		out: make([]byte, 128*enc.baseXBlockLen),
	}
}

// DecodeString returns the bytes represented by the baseX string s.
// It uses the liberal decoding strategy, ignoring any non-baseX-characters
func (enc *Encoding) DecodeString(s string) ([]byte, error) {
	dbuf := make([]byte, enc.DecodedLen(len(s)))
	n, err := enc.Decode(dbuf, []byte(s))
	return dbuf[:n], err
}

type decoder struct {
	err        error
	enc        *Encoding
	r          io.Reader
	out        []byte // leftover decoded output
	buf        []byte // leftover input
	nbuf       int    // the begin pointer of buf above
	scratchbuf []byte // a temporary scratch buf, for reuse
}

func (d *decoder) Read(p []byte) (int, error) {

	if d.err != nil {
		return 0, d.err
	}

	// Use leftover decoded output from last read.
	if len(d.out) > 0 {
		ret := copy(p, d.out)
		d.out = d.out[ret:]
		return ret, nil
	}

	ibl := d.enc.base256BlockLen
	obl := d.enc.baseXBlockLen

	nn := len(p) / ibl * obl
	if nn < obl {
		nn = obl
	}
	if nn > len(d.buf) {
		nn = len(d.buf)
	}

	// Try to read up to the next full block.
	for d.nbuf < obl && d.err == nil {
		var n int
		n, d.err = d.r.Read(d.buf[d.nbuf:nn])
		d.nbuf += n
	}

	eof := false

	if d.err == io.EOF {
		if d.nbuf == 0 {
			return 0, d.err
		}
		eof = true
		d.err = nil
	} else if d.err != nil {
		return 0, d.err
	}

	// The num bytes to decode should be along obl-aligned boundaries, unless
	// we're at the end of file.
	numBytesToDecode := d.nbuf
	if !eof {
		numBytesToDecode = numBytesToDecode / obl * obl
	}
	numBytesToOutput := d.enc.DecodedLen(numBytesToDecode)

	var ret int

	// If we have too many bytes for the given buffer, we can buffer
	// the rest internally
	if numBytesToOutput > len(p) {
		var n int
		n, d.err = d.enc.Decode(d.scratchbuf[:], d.buf[:numBytesToDecode])
		d.out = d.scratchbuf[:n]
		ret = copy(p, d.out)
		d.out = d.out[ret:]
	} else {
		ret, d.err = d.enc.Decode(p, d.buf[:numBytesToDecode])
	}

	// Shift the bytes in d.buf over from [numBytesToDecode:] to the start of the array
	d.nbuf -= numBytesToDecode
	copy(d.buf[0:d.nbuf], d.buf[numBytesToDecode:numBytesToDecode+d.nbuf])

	if ret == 0 && d.err == nil && len(p) != 0 {
		return 0, io.EOF
	}

	return ret, d.err
}

type filteringReader struct {
	wrapped io.Reader
	enc     *Encoding
	nRead   int
}

func (r *filteringReader) Read(p []byte) (int, error) {
	n, err := r.wrapped.Read(p)
	for n > 0 {
		offset := 0
		for i, b := range p[:n] {
			typ := r.enc.getByteType(b)
			if typ == invalidByteType {
				// TODO: Return n, i.e. partial results?
				return 0, CorruptInputError(r.nRead)
			}
			r.nRead++
			if typ == skipByteType {
				continue
			}

			// We want this byte. We only need to rewrite it if
			// offset is behind i (otherwise we'd just be writing the
			// same byte again, over itself).
			if i != offset {
				p[offset] = b
			}
			offset++
		}
		if offset > 0 {
			return offset, err
		}
		// Previous buffer entirely whitespace, read again
		n, err = r.wrapped.Read(p)
	}
	return n, err
}

// NewDecoder constructs a new baseX stream decoder.
func NewDecoder(enc *Encoding, r io.Reader) io.Reader {
	return newDecoder(enc, r)
}

func newDecoder(enc *Encoding, r io.Reader) io.Reader {
	if enc.hasSkipBytes() {
		r = &filteringReader{r, enc, 0}
	}
	return &decoder{
		enc:        enc,
		r:          r,
		buf:        make([]byte, 8192*enc.base256BlockLen),
		scratchbuf: make([]byte, 8192*enc.baseXBlockLen),
	}
}
