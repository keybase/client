package client

import (
	"github.com/keybase/client/go/libkb"
)

// Keep this around to simplify things
var G = libkb.G
var GlobUI *UI

func InitUI(uiType string) {
	// TODO: Null UI type disables the UI. This is a workaround when the client is
	// run from a process without access to /dev/tty.
	if uiType == "null" {
		return
	}
	GlobUI = &UI{}
	G.SetUI(GlobUI)
}
