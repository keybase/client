package kex

import (
	"github.com/keybase/client/go/libkb"
)

// For convenience, store libkb's G here...
var G *libkb.GlobalContext

func init() {
	G = libkb.G
}
