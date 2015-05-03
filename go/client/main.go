package client

import (
	"github.com/keybase/client/go/libkb"
)

// Keep this around to simplify things
var G = libkb.G
var G_UI *UI

func InitUI() {
	G_UI = &UI{}
	G.SetUI(G_UI)
}
