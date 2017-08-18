// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Package minterm implements minimal terminal functions.
package minterm

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"

	"github.com/keybase/go-crypto/ssh/terminal"
)

// MinTerm is a minimal terminal interface.
type MinTerm struct {
	termIn       *os.File
	termOut      *os.File
	closeTermOut bool
	width        int
	height       int
	stateMu      sync.Mutex // protects raw, oldState
	raw          bool
	oldState     *terminal.State
}

var ErrPromptInterrupted = errors.New("prompt interrupted")

// New creates a new MinTerm and opens the terminal file.  Any
// errors that happen while opening or getting the terminal size
// are returned.
func New() (*MinTerm, error) {
	m := &MinTerm{}
	if err := m.open(); err != nil {
		return nil, err
	}
	return m, nil
}

// Shutdown closes the terminal.
func (m *MinTerm) Shutdown() error {
	m.restore()
	// this can hang waiting for newline, so do it in a goroutine.
	// application shutting down, so will get closed by os anyway...
	if m.termIn != nil {
		go m.termIn.Close()
	}
	if m.termOut != nil && m.closeTermOut {
		go m.termOut.Close()
	}
	return nil
}

// Size returns the width and height of the terminal.
func (m *MinTerm) Size() (int, int) {
	return m.width, m.height
}

// Write writes a string to the terminal.
func (m *MinTerm) Write(s string) error {
	_, err := fmt.Fprint(m.getReadWriter(), s)
	return err
}

// Prompt gets a line of input from the terminal.  It displays the text in
// the prompt parameter first.
func (m *MinTerm) Prompt(prompt string) (string, error) {
	m.Write(prompt)
	return m.readLine()
}

// PromptPassword gets a line of input from the terminal, but
// nothing is echoed to the terminal to hide the text.
func (m *MinTerm) PromptPassword(prompt string) (string, error) {
	m.Write(prompt)
	if !strings.HasSuffix(prompt, ": ") {
		m.Write(": ")
	}
	return m.readSecret()
}

func (m *MinTerm) fdIn() int { return int(m.termIn.Fd()) }

func (m *MinTerm) readLine() (string, error) {
	m.makeRaw()
	defer m.restore()
	ret, err := terminal.NewTerminal(m.getReadWriter(), "").ReadLine()
	return ret, convertErr(err)
}

func (m *MinTerm) readSecret() (string, error) {
	m.makeRaw()
	defer m.restore()
	ret, err := terminal.NewTerminal(m.getReadWriter(), "").ReadPassword("")
	return ret, convertErr(err)
}

func (m *MinTerm) makeRaw() error {
	m.stateMu.Lock()
	defer m.stateMu.Unlock()
	fd := int(m.fdIn())
	oldState, err := terminal.MakeRaw(fd)
	if err != nil {
		return err
	}
	m.raw = true
	m.oldState = oldState
	return nil
}

func (m *MinTerm) restore() {
	m.stateMu.Lock()
	defer m.stateMu.Unlock()
	if !m.raw {
		return
	}
	fd := int(m.fdIn())
	terminal.Restore(fd, m.oldState)
	m.raw = false
	m.oldState = nil
}

func convertErr(e error) error {
	if e == io.ErrUnexpectedEOF {
		e = ErrPromptInterrupted
	}
	return e
}
