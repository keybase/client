package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/teams/hidden"
)

func ServiceInit(g *libkb.GlobalContext) {
	NewTeamLoaderAndInstall(g)
	NewFastTeamLoaderAndInstall(g)
	NewAuditorAndInstall(g)
	NewBoxAuditorAndInstall(g)
	NewImplicitTeamConflictInfoCacheAndInstall(g)
	NewImplicitTeamCacheAndInstall(g)
	hidden.NewChainManagerAndInstall(g)
}
