// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package qrcode

import (
	"bytes"
	"strings"

	"code.google.com/p/rsc/qr"
)

// Encodings is the result of QR encoding.  It has three different
// representations:  Terminal with ansi codes, PNG-encoded bytes,
// and ASCII string where "#" is black and " " is white.
type Encodings struct {
	Terminal string
	PNG      []byte
	ASCII    string
}

// Encode makes a QR code out of data and encodes it into three
// different representations.
func Encode(data []byte) (*Encodings, error) {
	code, err := qr.Encode(string(data), qr.L)
	if err != nil {
		return nil, err
	}

	var result Encodings
	result.PNG = code.PNG()
	result.Terminal = terminal(code)
	result.ASCII = ascii(code)

	return &result, nil
}

const (
	black = "\033[40m  \033[0m"
	white = "\033[47m  \033[0m"
)

func terminal(code *qr.Code) string {
	var buf bytes.Buffer

	line := strings.Repeat(white, code.Size+2)
	buf.WriteString(line + "\n")
	for row := 0; row < code.Size; row++ {
		buf.WriteString(white)
		for col := 0; col < code.Size; col++ {
			if code.Black(col, row) {
				buf.WriteString(black)
			} else {
				buf.WriteString(white)
			}
		}
		buf.WriteString(white + "\n")
	}
	buf.WriteString(line + "\n")

	return buf.String()
}

func ascii(code *qr.Code) string {
	var buf bytes.Buffer

	buf.WriteString("\n")
	for row := 0; row < code.Size; row++ {
		buf.WriteString(" ")
		for col := 0; col < code.Size; col++ {
			if code.Black(col, row) {
				buf.WriteString("#")
			} else {
				buf.WriteString(" ")
			}
		}
		buf.WriteString("\n")
	}
	buf.WriteString("\n")

	return buf.String()
}
