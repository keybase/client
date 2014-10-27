
package libkb

import (
	"os"
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
	if !fi.Mode().IsRegular() {
		return false
	}
	return true
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

	return "", nil
}