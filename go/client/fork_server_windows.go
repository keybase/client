// +build windows

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
)

// ForkServerNix doesn't work on non-Unix platforms
func ForkServerNix(cl libkb.CommandLine, g *libkb.GlobalContext) error { return nil }

// GetExtraFlags gets the extra command line flags for this platform
func GetExtraFlags() []cli.Flag { return nil }
