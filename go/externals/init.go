package externals

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pvlsource"
)

func NewGlobalContextInit() *libkb.GlobalContext {
	g := libkb.NewGlobalContext().Init()
	g.SetProofServices(NewProofServices(g))
	pvlsource.NewPvlSourceAndInstall(g)
	return g
}
