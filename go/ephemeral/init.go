package ephemeral

import (
	"github.com/keybase/client/go/libkb"
)

// Creates a ephemeral key storage and installs it into G.
func NewEphemeralStorageAndInstall(mctx libkb.MetaContext) {
	mctx.G().SetDeviceEKStorage(NewDeviceEKStorage(mctx))
	mctx.G().SetUserEKBoxStorage(NewUserEKBoxStorage())
	mctx.G().SetTeamEKBoxStorage(NewTeamEKBoxStorage(NewTeamEphemeralKeyer()))
	mctx.G().SetTeambotEKBoxStorage(NewTeamEKBoxStorage(NewTeambotEphemeralKeyer()))
	ekLib := NewEKLib(mctx)
	mctx.G().SetEKLib(ekLib)
	mctx.G().AddLoginHook(ekLib)
	mctx.G().AddLogoutHook(ekLib, "ekLib")
	mctx.G().AddDbNukeHook(ekLib, "ekLib")
	mctx.G().PushShutdownHook(func() error {
		mctx.Debug("stopping background eklib loop")
		ekLib.Shutdown()
		return nil
	})
}

func ServiceInit(mctx libkb.MetaContext) {
	NewEphemeralStorageAndInstall(mctx)
}
