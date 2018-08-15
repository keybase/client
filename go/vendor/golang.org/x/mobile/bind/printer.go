// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bind

import (
	"bytes"
	"fmt"
)

type Printer struct {
	Buf        *bytes.Buffer
	IndentEach []byte
	indentText []byte
	needIndent bool
}

func (p *Printer) writeIndent() error {
	if !p.needIndent {
		return nil
	}
	p.needIndent = false
	_, err := p.Buf.Write(p.indentText)
	return err
}

func (p *Printer) Write(b []byte) (n int, err error) {
	wrote := 0
	for len(b) > 0 {
		if err := p.writeIndent(); err != nil {
			return wrote, err
		}
		i := bytes.IndexByte(b, '\n')
		if i < 0 {
			break
		}
		n, err = p.Buf.Write(b[0 : i+1])
		wrote += n
		if err != nil {
			return wrote, err
		}
		b = b[i+1:]
		p.needIndent = true
	}
	if len(b) > 0 {
		n, err = p.Buf.Write(b)
		wrote += n
	}
	return wrote, err
}

func (p *Printer) Printf(format string, args ...interface{}) {
	if _, err := fmt.Fprintf(p, format, args...); err != nil {
		panic(fmt.Sprintf("printer: %v", err))
	}
}

func (p *Printer) Indent() {
	p.indentText = append(p.indentText, p.IndentEach...)
}

func (p *Printer) Outdent() {
	if len(p.indentText) > len(p.IndentEach)-1 {
		p.indentText = p.indentText[len(p.IndentEach):]
	}
}
