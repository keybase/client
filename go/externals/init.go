package externals

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/merklestore"
)

func NewGlobalContextInit() *libkb.GlobalContext {
	g := libkb.NewGlobalContext().Init()
	g.SetProofServices(NewProofServices(g))
	merklestore.NewPvlSourceAndInstall(g)
	return g
}
