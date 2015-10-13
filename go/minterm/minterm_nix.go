// +build !windows

package minterm

import (
	"golang.org/x/crypto/ssh/terminal"
	"os"
)

func (m *MinTerm) open() error {
	f, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return err
	}
	m.out = f
	fd := int(m.out.Fd())
	w, h, err := terminal.GetSize(fd)
	if err != nil {
		return err
	}
	m.width, m.height = w, h
	return nil
}
