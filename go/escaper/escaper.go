// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package escaper

import (
	"io"

	"github.com/lunixbochs/vtclean"
)

type EscapedWriter struct {
	io.Writer
	allow_color bool
}

func (w *EscapedWriter) Write(p []byte) (n int, err error) {
	return w.Writer.Write(vtclean.CleanBytes(p, w.allow_color))
}

func EscapeBytes(source []byte, allow_color bool) []byte {
	return vtclean.CleanBytes(source, allow_color)
}

func EscapeString(source string, allow_color bool) string {
	return vtclean.Clean(source, allow_color)
}
