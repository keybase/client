package engine

import (
	"github.com/keybase/client/go/libkb"
)

// var G = libkb.G

func IsLoggedIn(g *libkb.GlobalContext) (bool, error) {
	return g.LoginState().IsLoggedInLoad()
}
