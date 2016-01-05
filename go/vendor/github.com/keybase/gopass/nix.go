// +build linux darwin

package gopass

import (
	"syscall"

	"golang.org/x/crypto/ssh/terminal"
)

func getch(termDescriptor int) byte {
	if oldState, err := terminal.MakeRaw(termDescriptor); err != nil {
		panic(err)
	} else {
		defer terminal.Restore(termDescriptor, oldState)
	}

	var buf [1]byte
	if n, err := syscall.Read(termDescriptor, buf[:]); n == 0 || err != nil {
		panic(err)
	}
	return buf[0]
}
