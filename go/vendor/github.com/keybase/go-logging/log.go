// Copyright 2013, Örjan Persson. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package logging

import (
	"fmt"
	"io"
)

type color int

const (
	colorBlack = iota + 30
	colorRed
	colorGreen
	colorYellow
	colorBlue
	colorMagenta
	colorCyan
	colorWhite
)

var (
	colors = []string{
		CRITICAL: colorSeq(colorMagenta),
		ERROR:    colorSeq(colorRed),
		WARNING:  colorSeq(colorYellow),
		NOTICE:   colorSeq(colorGreen),
		DEBUG:    colorSeq(colorCyan),
	}
	boldcolors = []string{
		CRITICAL: colorSeqBold(colorMagenta),
		ERROR:    colorSeqBold(colorRed),
		WARNING:  colorSeqBold(colorYellow),
		NOTICE:   colorSeqBold(colorGreen),
		DEBUG:    colorSeqBold(colorCyan),
	}
)

func colorSeq(color color) string {
	return fmt.Sprintf("\033[%dm", int(color))
}

func colorSeqBold(color color) string {
	return fmt.Sprintf("\033[%d;1m", int(color))
}

func doFmtVerbLevelColor(layout string, level Level, output io.Writer) {
	if layout == "bold" {
		output.Write([]byte(boldcolors[level]))
	} else if layout == "reset" {
		output.Write([]byte("\033[0m"))
	} else {
		output.Write([]byte(colors[level]))
	}
}

