package ephemeral

import (
	"github.com/keybase/client/go/libkb"
)

// Creates a ephemeral key storage and installs it into G.
func NewEphemeralStorageAndInstall(g *libkb.GlobalContext) {
	// TODO add TeamEk storage
	g.SetDeviceEKStorage(NewDeviceEKStorage(g))
	g.SetUserEKBoxStorage(NewUserEKBoxStorage(g))
	ekLib := NewEKLib(g)
	g.SetEKLib(ekLib)
	// TODO remove this when we want to release in the wild.
	if ShouldRun(g) {
		g.AddLoginHook(ekLib)
		g.AddLogoutHook(ekLib)
	}
}

func ServiceInit(g *libkb.GlobalContext) {
	NewEphemeralStorageAndInstall(g)
}
