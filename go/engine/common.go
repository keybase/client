package engine

import (
	"github.com/keybase/client/go/libkb"
)

var G = &libkb.G

func IsLoggedIn() (bool, error) {
	return G.LoginState().IsLoggedInLoad()
}
