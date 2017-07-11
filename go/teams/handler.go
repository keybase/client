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

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	if err != nil {
		return err
	}

	if team.Generation() > generation {
		g.Log.CDebugf(ctx, "current team generation %d > team.clkr generation %d, not rotating", team.Generation(), generation)
		return nil
	}

	g.Log.CDebugf(ctx, "rotating team %s (%s)", team.Name(), teamID)
	if err := team.Rotate(ctx); err != nil {
		g.Log.CDebugf(ctx, "rotating team %s (%s) error: %s", team.Name(), teamID, err)
		return err
	}

	g.Log.CDebugf(ctx, "sucess rotating team %s (%s)", team.Name(), teamID)
	return nil
}

func reloadLocal(ctx context.Context, g *libkb.GlobalContext, row keybase1.TeamChangeRow, change keybase1.TeamChangeSet) error {
	if change.Renamed {
		// This force reloads the team as a side effect
		return g.GetTeamLoader().NotifyTeamRename(ctx, row.Id, row.Name)
	}

	_, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          row.Id,
		ForceRepoll: true,
	})
	return err
}

func handleChangeSingle(ctx context.Context, g *libkb.GlobalContext, row keybase1.TeamChangeRow, change keybase1.TeamChangeSet) (err error) {
	change.KeyRotated = row.KeyRotated
	change.MembershipChanged = row.MembershipChanged

	defer g.CTrace(ctx, fmt.Sprintf("team.handleChangeSingle(%+v, %+v)", row, change), func() error { return err })()

	if err = reloadLocal(ctx, g, row, change); err != nil {
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

func HandleSBSRequest(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamSBSMsg) error {
	for _, invitee := range msg.Invitees {
		if err := handleSBSSingle(ctx, g, msg.TeamID, invitee); err != nil {
			return err
		}
	}
	return nil
}

func handleSBSSingle(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, invitee keybase1.TeamInvitee) error {
	g.Log.Warning("handleSBSSingle")
	uv := NewUserVersion(invitee.Uid, invitee.EldestSeqno)
	req, err := reqFromRole(uv, invitee.Role)
	if err != nil {
		return err
	}
	req.CompletedInvites = make(map[keybase1.TeamInviteID]keybase1.UID)
	req.CompletedInvites[invitee.InviteID] = invitee.Uid

	team, err := GetForTeamManagement(ctx, g, teamID)
	if err != nil {
		return err
	}

	// verify the invite info:

	// find the invite in the team chain
	invite, found := team.chain().FindActiveInviteByID(invitee.InviteID)
	if !found {
		return libkb.NotFoundError{}
	}
	category, err := invite.Type.C()
	if err != nil {
		return err
	}
	if category == keybase1.TeamInviteCategory_SBS {
		//  resolve assertion in link
		ityp, err := invite.Type.String()
		if err != nil {
			return err
		}
		assertion := string(invite.Name) + "@" + ityp

		res := g.Resolver.ResolveWithBody(assertion)
		if res.GetError() != nil {
			return res.GetError()
		}
		uid, err := g.GetUPAKLoader().LookupUID(ctx, res.GetNormalizedUsername())
		if err != nil {
			return err
		}

		// check resolved assertion uid with invitee.Uid
		if uid != invitee.Uid {
			return fmt.Errorf("resolved %s to uid %s, which doesn't match uid %s in team.sbs message", assertion, uid, invitee.Uid)
		}
	}

	return team.ChangeMembership(ctx, req)
}
