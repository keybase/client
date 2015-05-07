package engine

import (
	"github.com/keybase/client/go/libkb"
)

func IsLoggedIn(g *libkb.GlobalContext) (bool, error) {
	return g.Account().LoggedInLoad()
}
