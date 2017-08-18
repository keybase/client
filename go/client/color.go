// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
)

//
// Some code copied from here:
//   https://github.com/Marak/colors.js/blob/master/lib/styles.js
//

/*
The MIT License (MIT)

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

type CodePair struct {
	Open  int
	Close int
}

var (
	CpBold          = CodePair{1, 22}
	CpDim           = CodePair{2, 22}
	CpItalic        = CodePair{3, 23}
	CpUnderline     = CodePair{4, 24}
	CpStrikethrough = CodePair{9, 29}
)

var codes = map[string]CodePair{
	"reset":         {0, 0},
	"bold":          CpBold,
	"dim":           CpDim,
	"italic":        CpItalic,
	"underline":     CpUnderline,
	"inverse":       {7, 27},
	"hidden":        {8, 28},
	"strikethrough": CpStrikethrough,
	"black":         {30, 39},
	"red":           {31, 39},
	"green":         {32, 39},
	"yellow":        {33, 39},
	"blue":          {34, 39},
	"magenta":       {35, 39},
	"cyan":          {36, 39},
	"white":         {37, 39},
	"gray":          {90, 39},
	"grey":          {90, 39},
	"bgBlack":       {40, 49},
	"bgRed":         {41, 49},
	"bgGreen":       {42, 49},
	"bgYellow":      {43, 49},
	"bgBlue":        {44, 49},
	"bgMagenta":     {45, 49},
	"bgCyan":        {46, 49},
	"bgWhite":       {47, 49},
}

const keyEscape = 0x1b

func colorByteSequence(code int) []byte {
	b := []byte(fmt.Sprintf("%d", code))
	ret := []byte{keyEscape, '['}
	ret = append(ret, b...)
	ret = append(ret, 'm')
	return ret
}

func (cp CodePair) OpenBytes() []byte  { return colorByteSequence(cp.Open) }
func (cp CodePair) CloseBytes() []byte { return colorByteSequence(cp.Close) }

func HasColor() bool {
	// TODO Color should be based on whether log format supports it
	logFormatHasColor := map[string]bool{
		"":        true,
		"default": true,
		"fancy":   true,
		"file":    false,
		"plain":   false,
	}
	return logFormatHasColor[G.Env.GetLogFormat()]
}

func ColorOpen(which string) []byte {
	if !HasColor() {
		return nil
	}
	if cp, ok := codes[which]; ok {
		return colorByteSequence(cp.Open)
	}
	return nil
}

func GetColorCode(which string) *CodePair {
	if tmp, ok := codes[which]; ok {
		return &tmp
	}
	return nil
}

func ColorClose(which string) []byte {
	if !HasColor() {
		return nil
	}
	if cp, ok := codes[which]; ok {
		return colorByteSequence(cp.Close)
	}
	return nil
}

func ColorBytes(which string, text []byte) []byte {
	if !HasColor() {
		return text
	} else if cp, ok := codes[which]; ok {
		ret := colorByteSequence(cp.Open)
		ret = append(ret, text...)
		ret = append(ret, colorByteSequence(cp.Close)...)
		return ret
	} else {
		return text
	}
}

func ColorString(which, text string) string {
	return string(ColorBytes(which, []byte(text)))
}
