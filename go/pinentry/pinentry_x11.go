// +build dragonfly freebsd linux nacl netbsd openbsd solaris

package pinentry

import "os"

func IsRemote() bool {
	return len(os.Getenv("DISPLAY")) > 0
}
