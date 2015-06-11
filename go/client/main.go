package client

import (
	"github.com/keybase/client/go/libkb"
)

// Keep this around to simplify things
var G = libkb.G
var GlobUI *UI

func InitUI() {
	GlobUI = &UI{}
	G.SetUI(GlobUI)
}
