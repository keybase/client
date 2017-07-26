package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/engine"
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
	uv := NewUserVersion(invitee.Uid, invitee.EldestSeqno)
	req, err := reqFromRole(uv, invitee.Role)
	if err != nil {
		return err
	}
	req.CompletedInvites = make(map[keybase1.TeamInviteID]keybase1.UID)
	req.CompletedInvites[invitee.InviteID] = invitee.Uid

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
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
	switch category {
	case keybase1.TeamInviteCategory_SBS:
		//  resolve assertion in link (with uid in invite msg)
		ityp, err := invite.Type.String()
		if err != nil {
			return err
		}
		assertion := fmt.Sprintf("%s@%s+uid:%s", string(invite.Name), ityp, invitee.Uid)

		arg := keybase1.Identify2Arg{
			UserAssertion:    assertion,
			UseDelegateUI:    false,
			Reason:           keybase1.IdentifyReason{Reason: "process team invite"},
			CanSuppressUI:    true,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
		}
		ectx := &engine.Context{
			NetContext: ctx,
		}
		eng := engine.NewResolveThenIdentify2(g, &arg)
		if err := engine.RunEngine(eng, ectx); err != nil {
			return err
		}
	case keybase1.TeamInviteCategory_EMAIL:
		// nothing to verify, need to trust the server
	case keybase1.TeamInviteCategory_KEYBASE:
		uid, err := keybase1.UIDFromString(string(invite.Name))
		if err != nil {
			return err
		}
		if uid != invitee.Uid {
			return fmt.Errorf("chain keybase invite link uid %s does not match uid %s in team.sbs message", uid, invitee.Uid)
		}
	default:
		return fmt.Errorf("no verification implemented for invite category %s (%+v)", category, invite)
	}

	return team.ChangeMembership(ctx, req)
}
