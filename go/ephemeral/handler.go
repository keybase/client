package ephemeral

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func HandleNewTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) (err error) {
	defer mctx.TraceTimed("HandleNewTeamEK", func() error { return err })()

	if ekLib := mctx.G().GetEKLib(); ekLib != nil {
		ekLib.PurgeCachesForTeamIDAndGeneration(mctx, teamID, generation)
	}
	mctx.G().NotifyRouter.HandleNewTeamEK(mctx.Ctx(), teamID, generation)
	return nil
}
