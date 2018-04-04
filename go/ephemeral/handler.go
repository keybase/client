package ephemeral

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func HandleNewTeamEK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) (err error) {
	defer g.CTrace(ctx, "HandleNewTeamEK", func() error { return err })()

	ekLib := g.GetEKLib()
	ekLib.PurgeTeamEKGenCache(teamID, generation)
	g.NotifyRouter.HandleNewTeamEK(ctx, teamID, generation)
	return nil
}
