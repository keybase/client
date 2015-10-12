// +build windows

package libkb

import (
	"os/exec"
	"strings"
)

// LookPath searches for an executable binary named file
// in the directories named by the PATH environment variable.
// If file contains a slash, it is tried directly and the PATH is not consulted.

func canExec(s string) error {
	if strings.IndexAny(s, `:\/`) == -1 {
		s = s + "/"
	}
	_, err := exec.LookPath(s)
	return err
}

func PosixLineEndings(arg string) string {
	return strings.Replace(arg, "\r", "", -1)
}
