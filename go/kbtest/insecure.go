package kbtest

import (
	"github.com/keybase/client/go/libkb"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
)

func InstallInsecureTriplesec(g *libkb.GlobalContext) {
	g.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { g.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return g.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, warner, isProduction)
	}
}
