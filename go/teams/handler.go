package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func HandleRotateRequest(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, generation keybase1.PerTeamKeyGeneration) (err error) {

	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, fmt.Sprintf("HandleRotateRequest(%s,%d)", teamID, generation), func() error { return err })()

	team, err := GetForTeamManagement(ctx, g, teamID)
	if err != nil {
		return err
	}

	if team.Generation() > generation {
		g.Log.CDebugf(ctx, "current team generation %d > team.clkr generation %d, not rotating", team.Generation(), generation)
		return nil
	}

	g.Log.CDebugf(ctx, "rotating team %s (%s)", team.Name, teamID)
	if err := team.Rotate(ctx); err != nil {
		g.Log.CDebugf(ctx, "rotating team %s (%s) error: %s", team.Name, teamID, err)
		return err
	}

	g.Log.CDebugf(ctx, "sucess rotating team %s (%s)", team.Name, teamID)
	return nil
}

func handleChangeSingle(ctx context.Context, g *libkb.GlobalContext, row keybase1.TeamChangeRow, change keybase1.TeamChangeSet) (err error) {
	change.KeyRotated = row.KeyRotated
	change.MembershipChanged = row.MembershipChanged

	defer g.CTrace(ctx, fmt.Sprintf("team.handleChangeSingle(%+v, %+v)", row, change), func() error { return err })()

	if err = ForceTeamRefresh(ctx, g, row.Id, change); err != nil {
		return err
	}
	g.NotifyRouter.HandleTeamChanged(ctx, row.Id, row.Name, row.LatestSeqno, change)
	return nil
}

func HandleChangeNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamChangeRow, changes keybase1.TeamChangeSet) error {
	for _, row := range rows {
		if err := handleChangeSingle(ctx, g, row, changes); err != nil {
			return err
		}
	}
	return nil
}
