package ephemeral

import "github.com/keybase/client/go/libkb"

// Creates a ephemeral key storage and installs it into G.
func NewEphemeralStorageAndInstall(g *libkb.GlobalContext) {
	// TODO add UserEk/TeamEk storage
	s := NewDeviceEKStorage(g)
	g.SetDeviceEKStorage(s)
}

func ServiceInit(g *libkb.GlobalContext) {
	NewEphemeralStorageAndInstall(g)
}
