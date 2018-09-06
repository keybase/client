package teams

import (
	"github.com/keybase/client/go/libkb"
)

func ServiceInit(g *libkb.GlobalContext) {
	NewTeamLoaderAndInstall(g)
	NewFastTeamLoaderAndInstall(g)
	NewImplicitTeamConflictInfoCacheAndInstall(g)
}
