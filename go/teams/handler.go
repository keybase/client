package teams

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func HandleRotateRequest(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, generation keybase1.PerTeamKeyGeneration) (err error) {

	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, fmt.Sprintf("HandleRotateRequest(%s,%d)", teamID, generation), func() error { return err })()

	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		team, err := Load(ctx, g, keybase1.LoadTeamArg{
			ID:          teamID,
			Public:      teamID.IsPublic(),
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
	})
}

func handleChangeSingle(ctx context.Context, g *libkb.GlobalContext, row keybase1.TeamChangeRow, change keybase1.TeamChangeSet) (err error) {
	change.KeyRotated = row.KeyRotated
	change.MembershipChanged = row.MembershipChanged

	defer g.CTrace(ctx, fmt.Sprintf("team.handleChangeSingle(%+v, %+v)", row, change), func() error { return err })()

	err = g.GetTeamLoader().HintLatestSeqno(ctx, row.Id, row.LatestSeqno)
	if err != nil {
		g.Log.CWarningf(ctx, "error in HintLatestSeqno: %v", err)
		return nil
	}
	// Send teamID and teamName in two separate notifications. It is server-trust that they are the same team.
	g.NotifyRouter.HandleTeamChangedByBothKeys(ctx, row.Id, row.Name, row.LatestSeqno, row.ImplicitTeam, change)

	return nil
}

func HandleChangeNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamChangeRow, changes keybase1.TeamChangeSet) (err error) {
	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, "HandleChangeNotification", func() error { return err })()
	for _, row := range rows {
		if err := handleChangeSingle(ctx, g, row, changes); err != nil {
			return err
		}
	}
	return nil
}

func HandleDeleteNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamChangeRow) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("team.HandleDeleteNotification(%v)", len(rows)), func() error { return err })()

	for _, row := range rows {
		g.Log.CDebugf(ctx, "team.HandleDeleteNotification: (%+v)", row)
		err := g.GetTeamLoader().Delete(ctx, row.Id)
		if err != nil {
			g.Log.CDebugf(ctx, "team.HandleDeleteNotification: error deleting team cache: %v", err)
		}
		g.NotifyRouter.HandleTeamDeleted(ctx, row.Id)
	}
	return nil
}

func HandleExitNotification(ctx context.Context, g *libkb.GlobalContext, rows []keybase1.TeamExitRow) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("team.HandleExitNotification(%v)", len(rows)), func() error { return err })()

	for _, row := range rows {
		g.Log.CDebugf(ctx, "team.HandleExitNotification: (%+v)", row)
		err := g.GetTeamLoader().Delete(ctx, row.Id)
		if err != nil {
			g.Log.CDebugf(ctx, "team.HandleExitNotification: error deleting team cache: %v", err)
		}
		g.NotifyRouter.HandleTeamExit(ctx, row.Id)
	}
	return nil
}

func HandleSBSRequest(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamSBSMsg) (err error) {
	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, "HandleSBSRequest", func() error { return err })()
	for _, invitee := range msg.Invitees {
		if err := handleSBSSingle(ctx, g, msg.TeamID, invitee); err != nil {
			return err
		}
	}
	return nil
}

func handleSBSSingle(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, untrustedInviteeFromGregor keybase1.TeamInvitee) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("team.handleSBSSingle(teamID: %v, invitee: %+v)", teamID, untrustedInviteeFromGregor), func() error { return err })()

	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
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
		invite, found := team.chain().FindActiveInviteByID(untrustedInviteeFromGregor.InviteID)
		if !found {
			g.Log.CDebugf(ctx, "FindActiveInviteByID failed for invite %s", untrustedInviteeFromGregor.InviteID)
			return libkb.NotFoundError{}
		}
		g.Log.CDebugf(ctx, "Found invite: %+v", invite)
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
			assertion := fmt.Sprintf("%s@%s+uid:%s", string(invite.Name), ityp, untrustedInviteeFromGregor.Uid)

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
		if err := tx.AddMemberBySBS(ctx, verifiedInvitee, invite.Role); err != nil {
			return err
		}
		if err := tx.Post(ctx); err != nil {
			return err
		}

		// Send chat welcome message
		g.Log.CDebugf(ctx, "sending welcome message for successful SBS handle")
		SendChatInviteWelcomeMessage(ctx, g, team.Name().String(), category, invite.Inviter.Uid,
			verifiedInvitee.Uid)

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
	defer g.CTrace(ctx, "HandleOpenTeamAccessRequest", func() error { return err })()

	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
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
		if joinAsRole != keybase1.TeamRole_READER && joinAsRole != keybase1.TeamRole_WRITER {
			return fmt.Errorf("unexpected role to add to open team: %v", joinAsRole)
		}

		var uvs []keybase1.UserVersion
		for _, tar := range msg.Tars {
			uvs = append(uvs, NewUserVersion(tar.Uid, tar.EldestSeqno))
		}

		// No need to forceRepoll here because we just loaded the team few lines above.
		return AddMembersBestEffort(ctx, g, msg.TeamID, joinAsRole, uvs, false /* forceRepoll */)
	})
}

type chatSeitanRecip struct {
	inviter keybase1.UID
	invitee keybase1.UID
}

func HandleTeamSeitan(ctx context.Context, g *libkb.GlobalContext, msg keybase1.TeamSeitanMsg) (err error) {
	ctx = libkb.WithLogTag(ctx, "CLKR")
	defer g.CTrace(ctx, "HandleTeamSeitan", func() error { return err })()

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          msg.TeamID,
		Public:      msg.TeamID.IsPublic(),
		ForceRepoll: true,
	})
	if err != nil {
		return err
	}

	var chats []chatSeitanRecip
	tx := CreateAddMemberTx(team)

	for _, seitan := range msg.Seitans {
		invite, found := team.chain().FindActiveInviteByID(seitan.InviteID)
		if !found {
			return libkb.NotFoundError{}
		}

		g.Log.CDebugf(ctx, "Processing Seitan acceptance for invite %s", invite.Id)

		err := handleSeitanSingle(ctx, g, team, invite, seitan)
		if err != nil {
			g.Log.CDebugf(ctx, "Provided AKey failed to verify with error: %v; ignoring", err)
			continue
		}

		uv := NewUserVersion(seitan.Uid, seitan.EldestSeqno)
		currentRole, err := team.MemberRole(ctx, uv)
		if err != nil {
			g.Log.CDebugf(ctx, "Failure in team.MemberRole: %v", err)
			return err
		}

		if currentRole.IsOrAbove(invite.Role) {
			g.Log.CDebugf(ctx, "User already has same or higher role, canceling invite.")
			tx.CancelInvite(invite.Id)
			continue
		}

		err = tx.AddMemberByUV(ctx, uv, invite.Role)
		if err != nil {
			g.Log.CDebugf(ctx, "Failed to add %v to transaction: %v", uv, err)
			continue
		}

		// Only allow adding members as cryptomembers. Server should
		// never send us  PUKless users accepting seitan tokens. When
		// PUKless user accepts seitan token invite status is set to
		// WAITING_FOR_PUK and team_rekeyd hold on it till user gets a
		// PUK and status is set to ACCEPTED.

		g.Log.CDebugf(ctx, "Completing invite %s", invite.Id)
		err = tx.CompleteInviteByID(ctx, invite.Id, uv)
		if err != nil {
			g.Log.CDebugf(ctx, "Failed to complete invite, member was added as keybase-invite: %v", err)
			return err
		}

		chats = append(chats, chatSeitanRecip{
			inviter: invite.Inviter.Uid,
			invitee: seitan.Uid,
		})
	}

	if tx.IsEmpty() {
		return nil
	}

	err = tx.Post(ctx)
	if err != nil {
		return err
	}

	// Send chats
	for _, chat := range chats {
		g.Log.CDebugf(ctx, "sending welcome message for successful Seitan handle: inviter: %s invitee: %s",
			chat.inviter, chat.invitee)
		SendChatInviteWelcomeMessage(ctx, g, team.Name().String(), keybase1.TeamInviteCategory_SEITAN,
			chat.inviter, chat.invitee)
	}

	return nil
}

func handleSeitanSingle(ctx context.Context, g *libkb.GlobalContext, team *Team, invite keybase1.TeamInvite, seitan keybase1.TeamSeitanRequest) (err error) {
	category, err := invite.Type.C()
	if err != nil {
		return err
	}

	if category != keybase1.TeamInviteCategory_SEITAN {
		return fmt.Errorf("HandleTeamSeitan wanted to claim an invite with category %v", category)
	}

	pkey, err := SeitanDecodePKey(string(invite.Name))
	if err != nil {
		return err
	}

	keyAndLabel, err := pkey.DecryptKeyAndLabel(ctx, team)
	if err != nil {
		return err
	}

	version, err := keyAndLabel.V()
	if err != nil {
		return fmt.Errorf("while parsing KeyAndLabel: %s", err)
	}

	switch version {
	case keybase1.SeitanKeyAndLabelVersion_V1:
		err = handleSeitanSingleV1(keyAndLabel.V1().I, invite, seitan)
	case keybase1.SeitanKeyAndLabelVersion_V2:
		err = handleSeitanSingleV2(keyAndLabel.V2().K, invite, seitan)
	default:
		return fmt.Errorf("unknown KeyAndLabel version: %v", version)
	}

	return err
}

func handleSeitanSingleV1(key keybase1.SeitanIKey, invite keybase1.TeamInvite, seitan keybase1.TeamSeitanRequest) (err error) {
	ikey := SeitanIKey(key)
	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return err
	}

	inviteID, err := sikey.GenerateTeamInviteID()
	if err != nil {
		return err
	}

	if !inviteID.Eq(invite.Id) {
		return errors.New("invite ID mismatch (seitan)")
	}

	akey, _, err := sikey.GenerateAcceptanceKey(seitan.Uid, seitan.EldestSeqno, seitan.UnixCTime)
	if err != nil {
		return err
	}

	// Decode given AKey to be able to do secure hash comparison.
	decodedAKey, err := base64.StdEncoding.DecodeString(string(seitan.Akey))
	if err != nil {
		return err
	}

	if !libkb.SecureByteArrayEq(akey, decodedAKey) {
		return fmt.Errorf("did not end up with the same AKey")
	}

	return nil
}

func handleSeitanSingleV2(key keybase1.SeitanPubKey, invite keybase1.TeamInvite, seitan keybase1.TeamSeitanRequest) (err error) {
	pubKey, err := ImportSeitanPubKey(key)
	if err != nil {
		return err
	}

	var sig SeitanSig
	decodedSig, err := base64.StdEncoding.DecodeString(string(seitan.Akey)) // For V2 the server responds with sig in the akey field
	if len(sig) != len(decodedSig) {
		return errors.New("Signature length verification failed (seitan)")
	}
	copy(sig[:], decodedSig[:])

	now := keybase1.Time(seitan.UnixCTime) // For V2 this is ms since the epoch, not seconds
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
