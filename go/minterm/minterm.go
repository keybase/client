// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

// Package minterm implements minimal terminal functions.
package minterm

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/ssh/terminal"
)

// MinTerm is a minimal terminal interface.
type MinTerm struct {
	tty    *os.File
	width  int
	height int
}

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

func (m *MinTerm) open() error {
	f, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return err
	}
	m.tty = f
	fd := int(m.tty.Fd())
	w, h, err := terminal.GetSize(fd)
	if err != nil {
		return err
	}
	m.width, m.height = w, h
	return nil
}

// Shutdown closes the terminal.
func (m *MinTerm) Shutdown() error {
	if m.tty == nil {
		return nil
	}
	return m.tty.Close()
}

// Size returns the width and height of the terminal.
func (m *MinTerm) Size() (int, int) {
	return m.width, m.height
}

// Write writes a string to the terminal.
func (m *MinTerm) Write(s string) error {
	_, err := fmt.Fprint(m.tty, s)
	return err
}

// Prompt gets a line of input from the terminal.  It displays the text in
// the prompt parameter first.
func (m *MinTerm) Prompt(prompt string) (string, error) {
	m.Write(prompt)
	r := bufio.NewReader(m.tty)
	p, err := r.ReadString('\n')
	if err != nil {
		return "", err
	}
	// strip off the trailing newline
	if len(p) > 0 {
		p = p[:len(p)-1]
	}
	return p, nil
}

// PromptPassword gets a line of input from the terminal, but
// nothing is echoed to the terminal to hide the text.
func (m *MinTerm) PromptPassword(prompt string) (string, error) {
	m.Write(prompt)
	if !strings.HasSuffix(prompt, ": ") {
		m.Write(": ")
	}
	b, err := terminal.ReadPassword(int(m.tty.Fd()))
	if err != nil {
		return "", err
	}
	m.Write("\n")
	return string(b), nil
}
