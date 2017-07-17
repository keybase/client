// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"
	"io"
	"strings"
)

type Markup struct {
	data string
}

func markupFrame(s string) string {
	s = strings.TrimSpace(s)
	if s[0] != '<' {
		s = "<p>" + s + "</p>"
	}
	return s
}

func NewMarkup(s string) *Markup {
	return &Markup{markupFrame(s)}
}

func FmtMarkup(f string, args ...interface{}) *Markup {
	return &Markup{data: markupFrame(fmt.Sprintf(f, args...))}
}

func (m Markup) ToReader() io.Reader {
	return bytes.NewBufferString(m.data)
}

func (m *Markup) Append(s string) {
	m.data += s
}

func (m Markup) GetRaw() string { return m.data }
