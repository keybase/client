package libkb

import (
	"bytes"
	"fmt"
	"io"
)

type Markup struct {
	data string
}

func NewMarkup(s string) *Markup {
	return &Markup{s}
}

func FmtMarkup(f string, args ...interface{}) *Markup {
	return &Markup{data: fmt.Sprintf(f, args...)}
}

func (m Markup) ToReader() io.Reader {
	return bytes.NewBufferString(m.data)
}
