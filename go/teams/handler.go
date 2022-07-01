package teams

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func HandleRotateRequest(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamCLKRMsg) (err error) {
	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, fmt.Sprintf("HandleRotateRequest(%s,%d)", msg.TeamID, msg.Generation), &err)()

	teamID := msg.TeamID

	var needTeamReload bool
	loadTeamArg := keybase1.LoadTeamArg{
		ID:          teamID,
		Public:      teamID.IsPublic(),
		ForceRepoll: true,
	}
	team, err := Load(ctx, g, loadTeamArg)
	if err != nil {
		return err
	}

	isAdmin := func() bool {
		role, err := team.myRole(ctx)
		return err == nil && role.IsOrAbove(keybase1.TeamRole_ADMIN)
	}
	if len(msg.ResetUsersUntrusted) > 0 && team.IsOpen() && isAdmin() {
		// NOTE: One day, this code path will be unused. Server should not
		// issue CLKRs with ResetUsersUntrusted for open teams. Instead, there
		// is a new work type to sweep reset users: OPENSWEEP. See
		// `HandleOpenTeamSweepRequest`.

		// Even though this is open team, and we are aiming to not rotate them,
		// the server asked us specifically to do so with this CLKR. We have to
		// obey, otherwise that CLKR will stay undone and server will keep
		// asking users to rotate.
		postedLink, err := sweepOpenTeamResetAndDeletedMembers(ctx, g, team, msg.ResetUsersUntrusted, true /* rotate */)
		if err != nil {
			g.Log.CDebugf(ctx, "Failed to sweep deleted members: %s", err)
		} else {
			// If sweepOpenTeamResetAndDeletedMembers does not do anything to
			// the team, do not load team again later. Otherwise, if new link
			// was posted, we need to reload.
			needTeamReload = postedLink
		}

		// * NOTE * Still call the regular rotate key routine even if sweep
		// succeeds and posts link.

		// In normal case, it will reload team, see that generation is higher
		// than one requested in CLKR (because we rotated key during sweeping),
		// and then bail out.
	}

	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		if needTeamReload {
			team2, err := Load(ctx, g, loadTeamArg)
			if err != nil {
				return err
			}
			team = team2
		}
		needTeamReload = true // subsequent calls to Load here need repoll.

		if team.Generation() > msg.Generation {
			g.Log.CDebugf(ctx, "current team generation %d > team.clkr generation %d, not rotating",
				team.Generation(), msg.Generation)
			return nil
		}

		g.Log.CDebugf(ctx, "rotating team %s (%s)", team.Name(), teamID)

		rotationType := keybase1.RotationType_CLKR
		if teamID.IsPublic() {
			rotationType = keybase1.RotationType_VISIBLE
		}

		if err := team.Rotate(ctx, rotationType); err != nil {
			g.Log.CDebugf(ctx, "rotating team %s (%s) error: %s", team.Name(), teamID, err)
			return err
		}

		g.Log.CDebugf(ctx, "success rotating team %s (%s)", team.Name(), teamID)
		return nil
	})
}

func HandleOpenTeamSweepRequest(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamOpenSweepMsg) (err error) {
	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, fmt.Sprintf("HandleOpenTeamSweepRequest(teamID=%s,len(resetUsers)=%d)", msg.TeamID, len(msg.ResetUsersUntrusted)), &err)()

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          msg.TeamID,
		Public:      msg.TeamID.IsPublic(),
		ForceRepoll: true,
	})
	if err != nil {
		return err
	}

	if !team.IsOpen() {
		return fmt.Errorf("OpenSweep request for team %s that is not open", team.ID)
	}

	role, err := team.myRole(ctx)
	if err != nil {
		return err
	}
	if !role.IsOrAbove(keybase1.TeamRole_ADMIN) {
		return fmt.Errorf("OpenSweep request for team %s but our role is: %s", team.ID, role.String())
	}

	rotate := !team.CanSkipKeyRotation()
	_, err = sweepOpenTeamResetAndDeletedMembers(ctx, g, team, msg.ResetUsersUntrusted, rotate)
	return err
}

func sweepOpenTeamResetAndDeletedMembers(ctx context.Context, g *libkb.GlobalContext,
	team *Team, resetUsersUntrusted []keybase1.TeamCLKRResetUser, rotate bool) (postedLink bool, err error) {
	// When CLKR is invoked because of account reset and it's an open team,
	// we go ahead and boot reset readers and writers out of the team. Key
	// is also rotated in the process (in the same ChangeMembership link).
	defer g.CTrace(ctx, fmt.Sprintf("sweepOpenTeamResetAndDeletedMembers(rotate=%t)", rotate),
		&err)()

	// Go through resetUsersUntrusted and fetch non-cached latest
	// EldestSeqnos/Status.
	type seqnoAndStatus struct {
		eldestSeqno keybase1.Seqno
		status      keybase1.StatusCode
	}
	resetUsers := make(map[keybase1.UID]seqnoAndStatus)
	for _, u := range resetUsersUntrusted {
		if _, found := resetUsers[u.Uid]; found {
			// User was in the list more than once.
			continue
		}

		arg := libkb.NewLoadUserArg(g).
			WithNetContext(ctx).
			WithUID(u.Uid).
			WithPublicKeyOptional().
			WithForcePoll(true)
		upak, _, err := g.GetUPAKLoader().LoadV2(arg)
		if err == nil {
			resetUsers[u.Uid] = seqnoAndStatus{
				eldestSeqno: upak.Current.EldestSeqno,
				status:      upak.Current.Status,
			}
		} else {
			g.Log.CDebugf(ctx, "Could not load uid:%s through UPAKLoader: %s", u.Uid)
		}
	}

	err = RetryIfPossible(ctx, g, func(ctx context.Context, attempt int) error {
		if attempt > 0 {
			var err error
			team, err = Load(ctx, g, keybase1.LoadTeamArg{
				ID:          team.ID,
				Public:      team.ID.IsPublic(),
				ForceRepoll: true,
			})
			if err != nil {
				return err
			}
		}

		changeReq := keybase1.TeamChangeReq{None: []keybase1.UserVersion{}}

		// We are iterating through resetUsers map, which is map of
		// uid->EldestSeqno that we loaded via UPAKLoader. Do not rely
		// on server provided resetUsersUntrusted for EldestSeqnos,
		// just use UIDs and see if these users are reset.

		// We do not need to consider PUKless members here, because we
		// are not auto-adding PUKless people to open teams (server
		// doesn't send PUKless TARs in OPENREQ msg), so it shouldn't
		// be an issue.
		for uid, u := range resetUsers {
			members := team.AllUserVersionsByUID(ctx, uid)
			for _, memberUV := range members {
				if memberUV.EldestSeqno == u.eldestSeqno && u.status != keybase1.StatusCode_SCDeleted {
					// Member is the current incarnation of the user
					// (or user has never reset).
					continue
				}
				role, err := team.MemberRole(ctx, memberUV)
				if err != nil {
					continue
				}
				switch role {
				case
					keybase1.TeamRole_RESTRICTEDBOT,
					keybase1.TeamRole_BOT,
					keybase1.TeamRole_READER,
					keybase1.TeamRole_WRITER:
					changeReq.None = append(changeReq.None, memberUV)
				}
			}
		}

		if len(changeReq.None) == 0 {
			// no one to kick out
			g.Log.CDebugf(ctx, "No one to remove from a CLKR list of %d users, after UPAKLoading %d of them",
				len(resetUsersUntrusted), len(resetUsers))
			return nil
		}

		g.Log.CDebugf(ctx, "Posting ChangeMembership with %d removals (CLKR list was %d)",
			len(changeReq.None), len(resetUsersUntrusted))

		opts := ChangeMembershipOptions{
			// Make it possible for user to come back in once they reprovision.
			Permanent:       false,
			SkipKeyRotation: !rotate,
		}
		if err := team.ChangeMembershipWithOptions(ctx, changeReq, opts); err != nil {
			return err
		}

		// Notify the caller that we posted a sig and they have to
		// load team again.
		postedLink = true
		return nil
	})

	return postedLink, err
}

func invalidateCaches(mctx libkb.MetaContext, teamID keybase1.TeamID) {
	// refresh the KBFS Favorites cache since it no longer should contain
	// this team.
	mctx.G().NotifyRouter.HandleFavoritesChanged(mctx.G().GetMyUID())
	if ekLib := mctx.G().GetEKLib(); ekLib != nil {
		ekLib.PurgeTeamEKCachesForTeamID(mctx, teamID)
		ekLib.PurgeTeambotEKCachesForTeamID(mctx, teamID)
	}
	if keyer := mctx.G().GetTeambotMemberKeyer(); keyer != nil {
		keyer.PurgeCache(mctx)
	}
}

func handleChangeSingle(ctx context.Context, g *libkb.GlobalContext, row keybase1.TeamChangeRow, change keybase1.TeamChangeSet) (changedMetadata bool, err error) {
	change.KeyRotated = row.KeyRotated
	change.MembershipChanged = row.MembershipChanged
	change.Misc = row.Misc
	mctx := libkb.NewMetaContext(ctx, g)

	defer mctx.Trace(fmt.Sprintf("team.handleChangeSingle [%s] (%+v, %+v)", g.Env.GetUsername(), row, change),
		&err)()

	// Any errors are already logged in their respective functions.
	_ = HintLatestSeqno(mctx, row.Id, row.LatestSeqno)
	_ = HintLatestHiddenSeqno(mctx, row.Id, row.LatestHiddenSeqno)

	// If we're handling a rename we should also purge the resolver cache and
	// the KBFS favorites cache
	if change.Renamed {
		if err = PurgeResolverTeamID(ctx, g, row.Id); err != nil {
			mctx.Warning("error in PurgeResolverTeamID: %v", err)
			err = nil // non-fatal
		}
		invalidateCaches(mctx, row.Id)
	}
	// Send teamID and teamName in two separate notifications. It is
	// server-trust that they are the same team.
	g.NotifyRouter.HandleTeamChangedByBothKeys(ctx, row.Id, row.Name, row.LatestSeqno, row.ImplicitTeam, change,
		row.LatestHiddenSeqno, row.LatestOffchainSeqno, keybase1.TeamChangedSource_SERVER)

	// Note we only get updates about new subteams we create because the flow
	// is that we join the team as an admin when we create them and then
	// immediately leave.
	if change.Renamed || change.MembershipChanged || change.Misc {
		changedMetadata = true
	}
	if change.MembershipChanged {
		g.NotifyRouter.HandleCanUserPerformChanged(ctx, row.Name)
	}
	return changedMetadata, nil
}

func HandleChangeNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamChangeRow, changes keybase1.TeamChangeSet) (err error) {
	ctx = libkb.WithLogTag(ctx, "THCN")
	defer g.CTrace(ctx, "HandleChangeNotification", &err)()
	var anyChangedMetadata bool
	for _, row := range rows {
		if changedMetadata, err := handleChangeSingle(ctx, g, row, changes); err != nil {
			return err
		} else if changedMetadata {
			anyChangedMetadata = true
		}
	}
	if anyChangedMetadata {
		g.NotifyRouter.HandleTeamMetadataUpdate(ctx)
	}
	return nil
}

func HandleTeamMemberShowcaseChange(ctx context.Context, g *libkb.GlobalContext) (err error) {
	defer g.CTrace(ctx, "HandleTeamMemberShowcaseChange", &err)()
	g.NotifyRouter.HandleTeamMetadataUpdate(ctx)
	return nil
}

func HandleDeleteNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamChangeRow) (err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	defer mctx.Trace(fmt.Sprintf("team.HandleDeleteNotification(%v)", len(rows)),
		&err)()

	g.NotifyRouter.HandleTeamMetadataUpdate(ctx)

	for _, row := range rows {
		g.Log.CDebugf(ctx, "team.HandleDeleteNotification: (%+v)", row)
		if err := TombstoneTeam(libkb.NewMetaContext(ctx, g), row.Id); err != nil {
			g.Log.CDebugf(ctx, "team.HandleDeleteNotification: failed to Tombstone: %s", err)
		}
		invalidateCaches(mctx, row.Id)
		g.NotifyRouter.HandleTeamDeleted(ctx, row.Id)
	}

	return nil
}

func HandleExitNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamExitRow) (err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	defer mctx.Trace(fmt.Sprintf("team.HandleExitNotification(%v)", len(rows)),
		&err)()

	g.NotifyRouter.HandleTeamMetadataUpdate(ctx)
	for _, row := range rows {
		mctx.Debug("team.HandleExitNotification: (%+v)", row)
		if err := FreezeTeam(mctx, row.Id); err != nil {
			mctx.Debug("team.HandleExitNotification: failed to FreezeTeam: %s", err)
		}
		invalidateCaches(mctx, row.Id)
		mctx.G().NotifyRouter.HandleTeamExit(ctx, row.Id)
	}
	return nil
}

func HandleNewlyAddedToTeamNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamNewlyAddedRow) (err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	defer mctx.Trace(fmt.Sprintf("team.HandleNewlyAddedToTeamNotification(%v)", len(rows)),
		&err)()
	for _, row := range rows {
		mctx.Debug("team.HandleNewlyAddedToTeamNotification: (%+v)", row)
		mctx.G().NotifyRouter.HandleNewlyAddedToTeam(mctx.Ctx(), row.Id)
		invalidateCaches(mctx, row.Id)
	}
	return nil
}

func HandleSBSRequest(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamSBSMsg) (err error) {
	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, "HandleSBSRequest", &err)()
	for _, invitee := range msg.Invitees {
		if err := handleSBSSingle(ctx, g, msg.TeamID, invitee); err != nil {
			return err
		}
	}
	return nil
}

func handleSBSSingle(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, untrustedInviteeFromGregor keybase1.TeamInvitee) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("team.handleSBSSingle(teamID: %v, invitee: %+v)", teamID, untrustedInviteeFromGregor), &err)()

	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		team, err := Load(ctx, g, keybase1.LoadTeamArg{
			ID:          teamID,
			Public:      teamID.IsPublic(),
			ForceRepoll: true,
		})
		if err != nil {
			g.Log.CDebugf(ctx, "Load of team failed")
			return err
		}

		// verify the invite info:

		// find the invite in the team chain
		inviteMD, found := team.chain().FindActiveInviteMDByID(untrustedInviteeFromGregor.InviteID)
		if !found {
			g.Log.CDebugf(ctx, "FindActiveInviteByID failed for invite %s", untrustedInviteeFromGregor.InviteID)
			return libkb.NotFoundError{Msg: "Invite not found"}
		}
		invite := inviteMD.Invite
		g.Log.CDebugf(ctx, "Found invite: %+v", invite)
		category, err := invite.Type.C()
		if err != nil {
			return err
		}
		ityp, err := invite.Type.String()
		if err != nil {
			return err
		}
		switch category {
		case keybase1.TeamInviteCategory_SBS:
			//  resolve assertion in link (with uid in invite msg)
			assertion := fmt.Sprintf("%s@%s+uid:%s", string(invite.Name), ityp, untrustedInviteeFromGregor.Uid)

			arg := keybase1.Identify2Arg{
				UserAssertion:    assertion,
				UseDelegateUI:    false,
				Reason:           keybase1.IdentifyReason{Reason: "process team invite"},
				CanSuppressUI:    true,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
			}
			eng := engine.NewResolveThenIdentify2(g, &arg)
			m := libkb.NewMetaContext(ctx, g)
			if err := engine.RunEngine2(m, eng); err != nil {
				return err
			}
		case keybase1.TeamInviteCategory_EMAIL, keybase1.TeamInviteCategory_PHONE:
			// nothing to verify, need to trust the server
		case keybase1.TeamInviteCategory_KEYBASE:
			// Check if UV in `untrustedInviteeFromGregor` is the same
			// person as in `invite`, and that we can bring them in.
			if err := assertCanAcceptKeybaseInvite(ctx, g, untrustedInviteeFromGregor, invite); err != nil {
				g.Log.CDebugf(ctx, "Failed assertCanAcceptKeybaseInvite")
				return err
			}
		default:
			return fmt.Errorf("no verification implemented for invite category %s (%+v)", category, invite)
		}

		// It's fine to use untrustedInviteeFromGregor Uid and EldestSeqno.
		// Code above verifies that Uid/Eldest passed by the server really
		// belongs to crypto-person described in invite in sigchain. So
		// right now untrustedInviteeFromGregor is *verified*.
		verifiedInvitee := untrustedInviteeFromGregor
		uv := NewUserVersion(verifiedInvitee.Uid, verifiedInvitee.EldestSeqno)

		currentRole, err := team.MemberRole(ctx, uv)
		if err != nil {
			g.Log.CDebugf(ctx, "Failed to lookup memberRole for %+v", uv)
			return err
		}

		if currentRole.IsOrAbove(invite.Role) {
			if team.IsImplicit() {
				g.Log.CDebugf(ctx, "This is implicit team SBS resolution, mooting invite %s", invite.Id)
				req := keybase1.TeamChangeReq{}
				req.CompletedInvites = make(SCMapInviteIDToUV)
				req.CompletedInvites[invite.Id] = uv.PercentForm()
				return team.ChangeMembership(ctx, req)
			}

			g.Log.CDebugf(ctx, "User already has same or higher role, canceling invite %s", invite.Id)
			return removeInviteID(ctx, team, invite.Id)
		}

		tx := CreateAddMemberTx(team)
		// NOTE: AddMemberBySBS errors out when encountering PUK-less users,
		// and this transaction is also set to default AllowPUKless=false.
		if err := tx.AddMemberBySBS(ctx, verifiedInvitee, invite.Role); err != nil {
			return err
		}
		if err := tx.Post(libkb.NewMetaContext(ctx, g)); err != nil {
			return err
		}

		// Send chat welcome message
		if team.IsImplicit() {
			// Do not send messages about keybase-type invites being resolved.
			// They are supposed to be transparent for the users and look like
			// a real members even though they have to be SBS-ed in.
			if category != keybase1.TeamInviteCategory_KEYBASE {
				iteamName, err := team.ImplicitTeamDisplayNameString(ctx)
				if err != nil {
					return err
				}
				g.Log.CDebugf(ctx,
					"sending resolution message for successful SBS handle")
				SendChatSBSResolutionMessage(ctx, g, iteamName,
					string(invite.Name), ityp, verifiedInvitee.Uid)
			}
		} else {
			g.Log.CDebugf(ctx, "sending welcome message for successful SBS handle")
			SendChatInviteWelcomeMessage(ctx, g, team.Name().String(), category, invite.Inviter.Uid,
				verifiedInvitee.Uid, invite.Role)
		}

		return nil
	})
}

func assertCanAcceptKeybaseInvite(ctx context.Context, g *libkb.GlobalContext, untrustedInviteeFromGregor keybase1.TeamInvitee, chainInvite keybase1.TeamInvite) error {
	chainUV, err := chainInvite.KeybaseUserVersion()
	if err != nil {
		return err
	}
	if chainUV.Uid.NotEqual(untrustedInviteeFromGregor.Uid) {
		return fmt.Errorf("chain keybase invite link uid %s does not match uid %s in team.sbs message", chainUV.Uid, untrustedInviteeFromGregor.Uid)
	}

	if chainUV.EldestSeqno.Eq(untrustedInviteeFromGregor.EldestSeqno) {
		return nil
	}

	if chainUV.EldestSeqno == 0 {
		g.Log.CDebugf(ctx, "team.sbs invitee eldest seqno: %d, allowing it to take the invite for eldest seqno 0 (reset account)", untrustedInviteeFromGregor.EldestSeqno)
		return nil
	}

	return fmt.Errorf("chain keybase invite link eldest seqno %d does not match eldest seqno %d in team.sbs message", chainUV.EldestSeqno, untrustedInviteeFromGregor.EldestSeqno)
}

func HandleOpenTeamAccessRequest(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamOpenReqMsg) (err error) {
	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, "HandleOpenTeamAccessRequest", &err)()

	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		team, err := Load(ctx, g, keybase1.LoadTeamArg{
			ID:          msg.TeamID,
			Public:      msg.TeamID.IsPublic(),
			ForceRepoll: true,
		})
		if err != nil {
			return err
		}

		if !team.IsOpen() {
			g.Log.CDebugf(ctx, "team %q is not an open team", team.Name())
			return nil // Not an error - let the handler dismiss the message.
		}

		joinAsRole := team.chain().inner.OpenTeamJoinAs
		switch joinAsRole {
		case keybase1.TeamRole_READER, keybase1.TeamRole_WRITER:
		default:
			return fmt.Errorf("unexpected role to add to open team: %v", joinAsRole)
		}

		tx := CreateAddMemberTx(team)
		for _, tar := range msg.Tars {
			uv := NewUserVersion(tar.Uid, tar.EldestSeqno)
			err := tx.AddMemberByUV(ctx, uv, joinAsRole, nil)
			g.Log.CDebugf(ctx, "Open team request: adding %v, returned err: %v", uv, err)
		}

		if tx.IsEmpty() {
			g.Log.CDebugf(ctx, "Nothing to do - transaction is empty")
			return nil
		}

		return tx.Post(libkb.NewMetaContext(ctx, g))
	})
}

type chatSeitanRecip struct {
	inviter keybase1.UID
	invitee keybase1.UID
	role    keybase1.TeamRole
}

func HandleTeamSeitan(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamSeitanMsg) (err error) {
	ctx = libkb.WithLogTag(ctx, "SEIT")
	mctx := libkb.NewMetaContext(ctx, g)
	defer mctx.Trace("HandleTeamSeitan", &err)()

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          msg.TeamID,
		Public:      msg.TeamID.IsPublic(),
		ForceRepoll: true,
	})
	if err != nil {
		return err
	}

	var chats []chatSeitanRecip

	// we only reject invalid or used up invites after the transaction was
	// correctly submitted.
	var invitesToReject []keybase1.TeamSeitanRequest

	// Only allow crypto-members added through 'team.change_membership' to be
	// added for Seitan invites (AllowPUKless=false).
	tx := CreateAddMemberTx(team)

	for _, seitan := range msg.Seitans {
		inviteMD, found := team.chain().FindActiveInviteMDByID(seitan.InviteID)
		if !found {
			mctx.Debug("Couldn't find specified invite id %q; skipping", seitan.InviteID)
			continue
		}
		invite := inviteMD.Invite

		mctx.Debug("Processing Seitan acceptance for invite %s", invite.Id)

		err := verifySeitanSingle(ctx, g, team, invite, seitan)
		if err != nil {
			if _, ok := err.(InviteLinkAcceptanceError); ok {
				mctx.Debug("Provided AKey failed to verify with error: %v; ignoring and scheduling for rejection", err)
				invitesToReject = append(invitesToReject, seitan)
			} else {
				mctx.Debug("Provided AKey failed to verify with error: %v; ignoring", err)
			}
			continue
		}

		uv := NewUserVersion(seitan.Uid, seitan.EldestSeqno)
		currentRole, err := team.MemberRole(ctx, uv)
		if err != nil {
			mctx.Debug("Failure in team.MemberRole: %v", err)
			return err
		}

		err = tx.CanConsumeInvite(ctx, invite.Id)
		if err != nil {
			if _, ok := err.(InviteLinkAcceptanceError); ok {
				mctx.Debug("Can't use invite: %s; ignoring and scheduling for rejection", err)
				invitesToReject = append(invitesToReject, seitan)
			} else {
				mctx.Debug("Can't use invite: %s", err)
			}
			continue
		}

		isNewStyle, err := IsNewStyleInvite(invite)
		if err != nil {
			mctx.Debug("Error checking whether invite is new-style: %s", isNewStyle)
			continue
		}

		if currentRole.IsOrAbove(invite.Role) {
			mctx.Debug("User already has same or higher role.")
			if !isNewStyle {
				mctx.Debug("User already has same or higher role; since is not a new-style invite, cancelling invite.")
				tx.CancelInvite(invite.Id, uv.Uid)
			} else {
				mctx.Debug("User already has same or higher role; scheduling for rejection.")
				invitesToReject = append(invitesToReject, seitan)
			}
			continue
		}

		err = tx.AddMemberByUV(ctx, uv, invite.Role, nil)
		if err != nil {
			mctx.Debug("Failed to add %v to transaction: %v", uv, err)
			continue
		}

		// Only allow adding members as cryptomembers. Server should never send
		// us PUKless users accepting seitan tokens. When PUKless user accepts
		// seitan token invite status is set to WAITING_FOR_PUK and team_rekeyd
		// hold on it till user gets a PUK and status is set to ACCEPTED.
		err = tx.ConsumeInviteByID(ctx, invite.Id, uv)
		if err != nil {
			mctx.Debug("Failed to consume invite: %v", err)
			continue
		}

		chats = append(chats, chatSeitanRecip{
			inviter: invite.Inviter.Uid,
			invitee: seitan.Uid,
			role:    invite.Role,
		})
	}

	if tx.IsEmpty() {
		mctx.Debug("Transaction is empty - nothing to post")
	} else {
		err = tx.Post(mctx)
		if err != nil {
			return fmt.Errorf("HandleTeamSeitan: Error posting transaction: %w", err)
		}

		// Send chats
		for _, chat := range chats {
			mctx.Debug("sending welcome message for successful Seitan handle: inviter: %s invitee: %s, role: %v",
				chat.inviter, chat.invitee, chat.role)
			SendChatInviteWelcomeMessage(ctx, g, team.Name().String(), keybase1.TeamInviteCategory_SEITAN,
				chat.inviter, chat.invitee, chat.role)
		}
	}

	if err = rejectInviteLinkAcceptances(mctx, invitesToReject); err != nil {
		// the transaction posted correctly, and rejecting an invite is not a critical step, so just log and swallow the error
		mctx.Debug("HandleTeamSeitan: error rejecting invite acceptances: %v", err)
	}

	return nil
}

func rejectInviteLinkAcceptances(mctx libkb.MetaContext, requests []keybase1.TeamSeitanRequest) error {
	failed := 0
	var lastErr error
	for _, request := range requests {
		arg := libkb.APIArg{
			Endpoint:    "team/reject_invite_acceptance",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"invite_id":    libkb.S{Val: string(request.InviteID)},
				"uid":          libkb.S{Val: request.Uid.String()},
				"eldest_seqno": libkb.I{Val: int(request.EldestSeqno)},
				"akey":         libkb.S{Val: string(request.Akey)},
			},
		}

		if _, err := mctx.G().API.Post(mctx, arg); err != nil {
			failed++
			mctx.Debug("rejectInviteLinkAcceptances: failed to call cancel_invite_acceptance(%v,%v,%v): %s", request.InviteID, request.Uid, request.EldestSeqno, err)
			lastErr = err
		}
	}

	if failed > 0 {
		return fmt.Errorf("Failed to reject %v (out of %v) InviteLink Acceptance requests. Last error: %w", failed, len(requests), lastErr)
	}
	return nil
}

func verifySeitanSingle(ctx context.Context, g *libkb.GlobalContext, team *Team, invite keybase1.TeamInvite, seitan keybase1.TeamSeitanRequest) (err error) {
	pkey, err := SeitanDecodePKey(string(invite.Name))
	if err != nil {
		return err
	}

	keyAndLabel, err := pkey.DecryptKeyAndLabel(ctx, team)
	if err != nil {
		return err
	}

	labelversion, err := keyAndLabel.V()
	if err != nil {
		return fmt.Errorf("while parsing KeyAndLabel: %s", err)
	}

	category, err := invite.Type.C()
	if err != nil {
		return err
	}

	switch labelversion {
	case keybase1.SeitanKeyAndLabelVersion_V1:
		if category != keybase1.TeamInviteCategory_SEITAN {
			return fmt.Errorf("HandleTeamSeitan wanted to claim an invite with category %v; wanted seitan", category)
		}
		return verifySeitanSingleV1(keyAndLabel.V1().I, invite, seitan)
	case keybase1.SeitanKeyAndLabelVersion_V2:
		if category != keybase1.TeamInviteCategory_SEITAN {
			return fmt.Errorf("HandleTeamSeitan wanted to claim an invite with category %v; wanted seitan", category)
		}
		return verifySeitanSingleV2(keyAndLabel.V2().K, invite, seitan)
	case keybase1.SeitanKeyAndLabelVersion_Invitelink:
		if category != keybase1.TeamInviteCategory_INVITELINK {
			return fmt.Errorf("HandleTeamSeitan wanted to claim an invite with category %v; wanted invitelink", category)
		}
		return verifySeitanSingleInvitelink(ctx, g, team, keyAndLabel.Invitelink().I, invite, seitan)
	default:
		return fmt.Errorf("unknown KeyAndLabel version: %v", labelversion)
	}
}

func verifySeitanSingleV1(key keybase1.SeitanIKey, invite keybase1.TeamInvite, seitan keybase1.TeamSeitanRequest) (err error) {
	// We repeat the steps that user does when they request access using the
	// invite ID and see if we get the same answer for the same parameters (UV
	// and unixCTime).
	ikey := SeitanIKey(key)
	uv := keybase1.UserVersion{
		Uid:         seitan.Uid,
		EldestSeqno: seitan.EldestSeqno,
	}
	ourAccept, err := generateAcceptanceSeitanV1(ikey, uv, seitan.UnixCTime)
	if err != nil {
		return fmt.Errorf("failed to generate acceptance key to test: %w", err)
	}

	if !ourAccept.inviteID.Eq(invite.Id) {
		return errors.New("invite ID mismatch (seitan)")
	}

	// Decode AKey received from the user to be able to do secure hash
	// comparison.
	decodedAKey, err := base64.StdEncoding.DecodeString(string(seitan.Akey))
	if err != nil {
		return err
	}

	if !libkb.SecureByteArrayEq(ourAccept.akey, decodedAKey) {
		return fmt.Errorf("did not end up with the same AKey")
	}

	return nil
}

func verifySeitanSingleV2(key keybase1.SeitanPubKey, invite keybase1.TeamInvite, seitan keybase1.TeamSeitanRequest) (err error) {
	// Do the public key signature verification. Signature coming from the user
	// is encoded in seitan.Akey. Recreate message using UV and ctime, then
	// verify signature.
	pubKey, err := ImportSeitanPubKey(key)
	if err != nil {
		return err
	}

	// For V2 the server responds with sig in the akey field.
	var sig SeitanSig
	decodedSig, err := base64.StdEncoding.DecodeString(string(seitan.Akey))
	if err != nil || len(sig) != len(decodedSig) {
		return errors.New("Signature length verification failed (seitan)")
	}
	copy(sig[:], decodedSig)

	// For V2 this is ms since the epoch, not seconds (like in V1 or InviteLink)
	now := keybase1.Time(seitan.UnixCTime)
	// NOTE: Since we are re-serializing the values from seitan here to
	// generate the message, if we want to change the fields present in the
	// signature in the future, old clients will not be compatible.
	msg, err := GenerateSeitanSignatureMessage(seitan.Uid, seitan.EldestSeqno, SCTeamInviteID(seitan.InviteID), now)
	if err != nil {
		return err
	}

	err = VerifySeitanSignatureMessage(pubKey, msg, sig)
	if err != nil {
		return err
	}

	return nil
}

func verifySeitanSingleInvitelink(ctx context.Context, g *libkb.GlobalContext, team *Team, ikey keybase1.SeitanIKeyInvitelink, invite keybase1.TeamInvite, seitan keybase1.TeamSeitanRequest) (err error) {
	// We repeat the steps that user does when they request access using the
	// invite ID and see if we get the same answer for the same parameters (UV
	// and unixCTime).
	//
	// Also, we check that the state of the user in the team has not changed
	// since they signed the acceptance.
	uv := keybase1.UserVersion{
		Uid:         seitan.Uid,
		EldestSeqno: seitan.EldestSeqno,
	}
	ourAccept, err := generateAcceptanceSeitanInviteLink(ikey, uv, seitan.UnixCTime)
	if err != nil {
		return NewInviteLinkAcceptanceError("failed to generate acceptance key to test: %w", err)
	}

	if !ourAccept.inviteID.Eq(invite.Id) {
		return NewInviteLinkAcceptanceError("invite ID mismatch (seitan invitelink)")
	}

	// Decode AKey received from the user to be able to do secure hash
	// comparison.
	decodedAKey, err := base64.StdEncoding.DecodeString(string(seitan.Akey))
	if err != nil {
		return NewInviteLinkAcceptanceError("Unable to decode AKey: %s", err)
	}

	if !libkb.SecureByteArrayEq(ourAccept.akey, decodedAKey) {
		return NewInviteLinkAcceptanceError("did not end up with the same invitelink AKey")
	}

	roleChangeTime, wasMember := team.UserLastRoleChangeTime(uv)
	if wasMember && seitan.UnixCTime < roleChangeTime.UnixSeconds() {
		return NewInviteLinkAcceptanceError("invite link was accepted before the user last changed their role")
	}

	if g.Clock().Now().Unix() < seitan.UnixCTime {
		// In this case we do not return an InviteLinkAcceptanceError to avoid
		// triggering a rejection in case this client's clock is off. If the
		// server is honest, clients shouldn't get asked to process these invite
		// links anyways, and if it is malicious than it does not matter if we
		// ask it to reject. Moreover, not rejecting might be cause a slight
		// performance degradation that can be detected server side, while
		// rejecting erroneously means people can't get into the teams they want
		// with no immediate feedback error.
		return fmt.Errorf("acceptance was produced with a future timestamp: ignoring (without rejecting)")
	}

	return nil
}

func HandleForceRepollNotification(ctx context.Context, g *libkb.GlobalContext, dtime gregor.TimeOrOffset) error {
	e1 := g.GetTeamLoader().ForceRepollUntil(ctx, dtime)
	e2 := g.GetFastTeamLoader().ForceRepollUntil(libkb.NewMetaContext(ctx, g), dtime)
	if e1 != nil {
		return e1
	}
	return e2
}
