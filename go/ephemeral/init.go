package ephemeral

import (
	"github.com/keybase/client/go/libkb"
)

// Creates a ephemeral key storage and installs it into G.
func NewEphemeralStorageAndInstall(g *libkb.GlobalContext) {
	g.SetDeviceEKStorage(NewDeviceEKStorage(g))
	g.SetUserEKBoxStorage(NewUserEKBoxStorage(g))
	g.SetTeamEKBoxStorage(NewTeamEKBoxStorage(g))
	ekLib := NewEKLib(g)
	g.SetEKLib(ekLib)
	g.AddLoginHook(ekLib)
	g.AddLogoutHook(ekLib)
}

func ServiceInit(g *libkb.GlobalContext) {
	NewEphemeralStorageAndInstall(g)
}
