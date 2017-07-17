// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package pinentry

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/keybase/client/go/logger"
)

//
// some borrowed from here:
//
//  https://github.com/bradfitz/camlistore/blob/master/pkg/misc/pinentry/pinentry.go
//
// Under the Apache 2.0 license
//

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

func FindPinentry(log logger.Logger) (string, error) {
	if !HasWindows() {
		return "", fmt.Errorf("Can't spawn gui window, not using pinentry")
	}
	bins := []string{
		// If you install MacTools you'll wind up with this pinentry
		"/usr/local/MacGPG2/libexec/pinentry-mac.app/Contents/MacOS/pinentry-mac",
	}

	extraPaths := []string{}

	log.Debug("+ FindPinentry()")

	cmds := []string{
		"pinentry-gtk-2",
		"pinentry-qt4",
		"pinentry",
	}

	checkFull := func(s string) bool {
		log.Debug("| Check fullpath %s", s)
		found := (canExec(s) == nil)
		if found {
			log.Debug("- Found: %s", s)
		}
		return found
	}

	for _, b := range bins {
		if checkFull(b) {
			return b, nil
		}
	}

	path := os.Getenv("PATH")
	for _, c := range cmds {
		log.Debug("| Looking for %s in standard PATH %s", c, path)
		fullc, err := exec.LookPath(c)
		if err == nil {
			log.Debug("- Found %s", fullc)
			return fullc, nil
		}
	}

	for _, ep := range extraPaths {
		for _, c := range cmds {
			full := filepath.Join(ep, c)
			if checkFull(full) {
				return full, nil
			}
		}
	}

	log.Debug("- FindPinentry: none found")
	return "", fmt.Errorf("No pinentry found, checked a bunch of different places")
}

func (pe *Pinentry) GetTerminalName() {
	// Noop on all platforms but windows
}
