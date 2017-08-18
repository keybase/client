// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package minterm

import (
	"github.com/keybase/client/go/logger"
	"golang.org/x/crypto/ssh/terminal"
	"io"
	"os"
)

// terminal takes io.ReadWriter, so for windows we mash
// stdin and stdout back together with this.
type WindowsReadWriter struct {
	r io.Reader
	w io.Writer
}

func (rw WindowsReadWriter) Read(p []byte) (n int, err error) {
	return rw.r.Read(p)
}

func (rw WindowsReadWriter) Write(p []byte) (n int, err error) {
	return rw.w.Write(p)
}

func (m *MinTerm) open() error {
	// Must be O_RDWR, or we can't mask the password as the user types it.
	fin, err := os.OpenFile("CONIN$", os.O_RDWR, 0)
	if err != nil {
		return err
	}
	// Must be O_RDWR, or else GetSize below breaks.
	fout, err := os.OpenFile("CONOUT$", os.O_RDWR, 0)
	if err != nil {
		return err
	}

	m.termIn = fin
	m.termOut = fout
	m.closeTermOut = true // since it's a different file...
	fdout := int(fout.Fd())
	w, h, err := terminal.GetSize(fdout)
	if err != nil {
		return err
	}
	m.width, m.height = w, h
	return nil
}

// Use a Windows output writer to eat control codes that look ugly on legacy terminals.
// As a bonus, we can do color prompts this way.
func (m *MinTerm) getReadWriter() io.ReadWriter {
	return WindowsReadWriter{r: m.termIn, w: logger.OutputWriterFromFile(m.termOut)}
}
