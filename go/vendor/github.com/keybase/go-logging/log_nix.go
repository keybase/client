// +build !windows

// Copyright 2013, Örjan Persson. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package logging

import (
	"bytes"
	"io"
	"log"
)

// LogBackend utilizes the standard log module.
type LogBackend struct {
	Logger      *log.Logger
	Color       bool
	ColorConfig []string
}

// NewLogBackend creates a new LogBackend.
func NewLogBackend(out io.Writer, prefix string, flag int) *LogBackend {
	return &LogBackend{Logger: log.New(out, prefix, flag)}
}

// Log implements the Backend interface.
func (b *LogBackend) Log(level Level, calldepth int, rec *Record) error {
	if b.Color {
		col := colors[level]
		if len(b.ColorConfig) > int(level) && b.ColorConfig[level] != "" {
			col = b.ColorConfig[level]
		}

		buf := &bytes.Buffer{}
		buf.Write([]byte(col))
		buf.Write([]byte(rec.Formatted(calldepth + 1)))
		buf.Write([]byte("\033[0m"))
		// For some reason, the Go logger arbitrarily decided "2" was the correct
		// call depth...
		return b.Logger.Output(calldepth+2, buf.String())
	}

	return b.Logger.Output(calldepth+2, rec.Formatted(calldepth+1))
}

