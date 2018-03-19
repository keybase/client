package ephemeral

import "github.com/keybase/client/go/libkb"

// Creates a ephemeral key storage and installs it into G.
func NewEphemeralStorageAndInstall(g *libkb.GlobalContext) {
	g.SetDeviceEKStorage(NewDeviceEKStorage(g))
	g.SetUserEKBoxStorage(NewUserEKBoxStorage(g))
	g.SetTeamEKBoxStorage(NewTeamEKBoxStorage(g))
}

func ServiceInit(g *libkb.GlobalContext) {
	NewEphemeralStorageAndInstall(g)
}
