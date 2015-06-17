// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package libkb

import (
	"fmt"
	"os"
)

func canExec(s string) error {
	fi, err := os.Stat(s)
	if err != nil {
		return err
	}
	mode := fi.Mode()

	//
	// Only consider non-directories that have at least one +x
	//  bit set.
	//
	// TODO: Recheck this on windows!
	//   See here for lookpath: http://golang.org/src/pkg/os/exec/lp_windows.go
	//
	// Similar to check from exec.LookPath below
	//   See here: http://golang.org/src/pkg/os/exec/lp_unix.go
	//
	if mode.IsDir() {
		return fmt.Errorf("Program '%s' is a directory", s)
	} else if int(mode)&0111 == 0 {
		return fmt.Errorf("Program '%s' isn't executable", s)
	} else {
		return nil
	}
}
