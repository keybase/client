package libkb

import (
	"bytes"
	"io"
)

type Peeker struct {
	reader io.Reader
	buf    bytes.Buffer
}

var _ io.Reader = &Peeker{}

func NewPeeker(r io.Reader) *Peeker {
	return &Peeker{reader: r}
}

func (p *Peeker) Read(d []byte) (int, error) {
	bl := p.buf.Len()
	if bl == 0 {
		return p.reader.Read(d)
	}
	n, err := p.buf.Read(d)
	if err != nil {
		return n, err
	}
	if n == len(d) {
		return n, nil
	}
	rn, err := p.reader.Read(d[n:])
	return n + rn, err
}

func (p *Peeker) Peek(d []byte) (int, error) {
	r := io.TeeReader(p.reader, &p.buf)
	return r.Read(d)
}
