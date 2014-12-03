package libkb

import (
	"bytes"
	"fmt"
	"io"
)

type Markup struct {
	data string
}

func FmtMarkup(f string, args ...interface{}) *Markup {
	return &Markup{data: fmt.Sprintf(f, args...)}
}

func (m Markup) ToReader() io.Reader {
	return bytes.NewBufferString(m.data)
}
