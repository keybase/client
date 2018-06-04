// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package escaper

import (
	"github.com/lunixbochs/vtclean"
	"io"
)

type EscapedWriter struct {
	io.Writer
}

func (w *EscapedWriter) Write(p []byte) (n int, err error) {
	return w.Writer.Write(vtclean.CleanBytes(p, false))
}

func EscapeBytes(source []byte, allow_color bool) []byte {
	return vtclean.CleanBytes(source, allow_color)
}

func EscapeString(source string, allow_color bool) string {
	return vtclean.Clean(source, allow_color)
}
