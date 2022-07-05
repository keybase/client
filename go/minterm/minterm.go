// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Package minterm implements minimal terminal functions.
package minterm

import (
	"errors"
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

// Prompt gets a line of input from the terminal.  It displays the text in
// the prompt parameter first.
func (m *MinTerm) Prompt(prompt string) (string, error) {
	return m.readLine(prompt)
}

// PromptPassword gets a line of input from the terminal, but
// nothing is echoed to the terminal to hide the text.
func (m *MinTerm) PromptPassword(prompt string) (string, error) {
	if !strings.HasSuffix(prompt, ": ") {
		prompt += ": "
	}
	return m.readSecret(prompt)
}

func (m *MinTerm) fdIn() int { return int(m.termIn.Fd()) }

func (m *MinTerm) getNewTerminal(prompt string) (*terminal.Terminal, error) {
	term := terminal.NewTerminal(m.getReadWriter(), prompt)
	a, b := m.Size()
	if a < 80 {
		a = 80
	}
	err := term.SetSize(a, b)
	if err != nil {
		return nil, err
	}
	return term, nil
}

func (m *MinTerm) readLine(prompt string) (string, error) {
	err := m.makeRaw()
	if err != nil {
		return "", convertErr(err)
	}
	defer m.restore()
	term, err := m.getNewTerminal(prompt)
	if err != nil {
		return "", convertErr(err)
	}
	ret, err := term.ReadLine()
	return ret, convertErr(err)
}

func (m *MinTerm) readSecret(prompt string) (string, error) {
	err := m.makeRaw()
	if err != nil {
		return "", convertErr(err)
	}
	defer m.restore()
	term, err := m.getNewTerminal("")
	if err != nil {
		return "", convertErr(err)
	}
	ret, err := term.ReadPassword(prompt)
	return ret, convertErr(err)
}

func (m *MinTerm) makeRaw() error {
	m.stateMu.Lock()
	defer m.stateMu.Unlock()
	fd := m.fdIn()
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
	fd := m.fdIn()
	_ = terminal.Restore(fd, m.oldState)
	m.raw = false
	m.oldState = nil
}

func convertErr(e error) error {
	if e == io.ErrUnexpectedEOF {
		e = ErrPromptInterrupted
	}
	return e
}
