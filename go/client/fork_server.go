// +build !dragonfly,!freebsd,!linux,!netbsd,!openbsd,!solaris,!darwin

package client

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
)

// ForkServerNix doesn't work on non-Unix platforms
func ForkServerNix(cl *libcmdline.CommandLine) error { return nil }

// GetExtraFlags gets the extra command line flags for this platform
func GetExtraFlags() []cli.Flag { return nil }
