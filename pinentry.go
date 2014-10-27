package libkb

import (
	"fmt"
	"os"
	"os/exec"
)

//
// some borrowed from here:
//
//  https://github.com/bradfitz/camlistore/blob/master/pkg/misc/pinentry/pinentry.go
//
// Under the Apache 2.0 license
//

func canExec(s string) bool {
	fi, err := os.Stat(s)
	if err != nil {
		return false
	}
	mode := fi.Mode()

	//
	// Only consider non-directories that have at least one +x
	//  bit set.
	//
	// TODO: Recheck this on windows!
	//
	return !mode.IsDir() && (int(mode)&(0111) != 0)
}

func FindPinentry() (string, error) {
	bins := []string{
		// If you install MacTools you'll wind up with this pinentry
		"/usr/local/MacGPG2/libexec/pinentry-mac.app/Contents/MacOS/pinentry-mac",
	}

	extra_paths := []string{}

	cmds := []string{
		"pinentry-gtk-2",
		"pinentry-qt4",
		"pinentry",
	}

	for _, b := range bins {
		if canExec(b) {
			return b, nil
		}
	}

	for _, c := range cmds {
		path, err := exec.LookPath(c)
		if err == nil {
			return path, nil
		}
	}

	for _, ep := range extra_paths {
		for _, c := range cmds {
			full := ep + "/" + c
			if canExec(full) {
				return full, nil
			}
		}
	}

	return "", fmt.Errorf("No pinentry found, checked a bunch of different places")
}
