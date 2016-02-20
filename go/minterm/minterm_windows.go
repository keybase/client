// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package minterm

import (
	"golang.org/x/crypto/ssh/terminal"
	"os"
)

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
