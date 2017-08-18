// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package minterm

import (
	"golang.org/x/crypto/ssh/terminal"
	"io"
	"os"
)

func (m *MinTerm) open() error {
	f, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return err
	}
	m.termIn = f
	m.termOut = f
	m.closeTermOut = false // since it's repeated
	fd := int(f.Fd())
	w, h, err := terminal.GetSize(fd)
	if err != nil {
		return err
	}
	m.width, m.height = w, h
	return nil
}

func (m *MinTerm) getReadWriter() io.ReadWriter {
	return m.termIn
}
