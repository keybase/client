// +build !darwin,!windows,!dragonfly,!freebsd,!linux,!netbsd,!openbsd,!solaris

package libkb

import "fmt"

func OSVersionAndBuild() (string, string, error) {
	return fmt.Errorf("Could not get OS info on this system")
}
