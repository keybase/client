package teams

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func ParseAndAcceptSeitanToken(mctx libkb.MetaContext, ui keybase1.TeamsUiInterface,
	tok string) (wasSeitan bool, err error) {

	seitanVersion, err := DeriveSeitanVersionFromToken(tok)
	if err != nil {
		return false, err
	}
	switch seitanVersion {
	case SeitanVersion1:
		wasSeitan, err = parseAndAcceptSeitanTokenV1(mctx, tok)
	case SeitanVersion2:
		wasSeitan, err = parseAndAcceptSeitanTokenV2(mctx, tok)
	case SeitanVersionInvitelink:
		wasSeitan, err = parseAndAcceptSeitanTokenInvitelink(mctx, ui, tok)
	default:
		wasSeitan = false
		err = fmt.Errorf("Unexpected SeitanVersion %d", seitanVersion)
	}
	return wasSeitan, err
}

// Seitan V1:

type acceptedSeitanV1 struct {
	unixNow  int64
	inviteID SCTeamInviteID
	akey     SeitanAKey
	encoded  string // base64 encoded akey
}

func generateAcceptanceSeitanV1(ikey SeitanIKey, uv keybase1.UserVersion, unixNow int64) (ret acceptedSeitanV1, err error) {
	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return ret, err
	}

	inviteID, err := sikey.GenerateTeamInviteID()
	if err != nil {
		return ret, err
	}

	akey, encoded, err := sikey.GenerateAcceptanceKey(uv.Uid, uv.EldestSeqno, unixNow)
	if err != nil {
		return ret, err
	}

	return acceptedSeitanV1{
		unixNow:  unixNow,
		inviteID: inviteID,
		akey:     akey,
		encoded:  encoded,
	}, nil
}

func postSeitanV1(mctx libkb.MetaContext, acceptedSeitan acceptedSeitanV1) error {
	arg := apiArg("team/seitan")
	arg.Args.Add("akey", libkb.S{Val: acceptedSeitan.encoded})
	arg.Args.Add("now", libkb.I64{Val: acceptedSeitan.unixNow})
	arg.Args.Add("invite_id", libkb.S{Val: string(acceptedSeitan.inviteID)})
	_, err := mctx.G().API.Post(mctx, arg)
	return err
}

func parseAndAcceptSeitanTokenV1(mctx libkb.MetaContext, tok string) (wasSeitan bool, err error) {
	seitan, err := ParseIKeyFromString(tok)
	if err != nil {
		mctx.Debug("ParseIKeyFromString error: %s", err)
		mctx.Debug("returning TeamInviteBadToken instead")
		return false, libkb.TeamInviteBadTokenError{}
	}
	uv := mctx.CurrentUserVersion()
	unixNow := mctx.G().Clock().Now().Unix()
	acpt, err := generateAcceptanceSeitanV1(seitan, uv, unixNow)
	if err != nil {
		return true, err
	}
	err = postSeitanV1(mctx, acpt)
	return true, err
}

// Seitan V2:

type acceptedSeitanV2 struct {
	now      keybase1.Time
	inviteID SCTeamInviteID
	sig      SeitanSig
	encoded  string // base64 encoded sig
}

func generateAcceptanceSeitanV2(ikey SeitanIKeyV2, uv keybase1.UserVersion, timeNow keybase1.Time) (ret acceptedSeitanV2, err error) {
	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return ret, err
	}

	inviteID, err := sikey.GenerateTeamInviteID()
	if err != nil {
		return ret, err
	}

	sig, encoded, err := sikey.GenerateSignature(uv.Uid, uv.EldestSeqno, inviteID, timeNow)
	if err != nil {
		return ret, err
	}

	return acceptedSeitanV2{
		now:      timeNow,
		inviteID: inviteID,
		sig:      sig,
		encoded:  encoded,
	}, nil
}

func postSeitanV2(mctx libkb.MetaContext, acceptedSeitan acceptedSeitanV2) error {
	arg := apiArg("team/seitan_v2")
	arg.Args.Add("sig", libkb.S{Val: acceptedSeitan.encoded})
	arg.Args.Add("now", libkb.HTTPTime{Val: acceptedSeitan.now})
	arg.Args.Add("invite_id", libkb.S{Val: string(acceptedSeitan.inviteID)})
	_, err := mctx.G().API.Post(mctx, arg)
	return err
}

func parseAndAcceptSeitanTokenV2(mctx libkb.MetaContext, tok string) (wasSeitan bool, err error) {
	seitan, err := ParseIKeyV2FromString(tok)
	if err != nil {
		mctx.Debug("ParseIKeyV2FromString error: %s", err)
		mctx.Debug("returning TeamInviteBadToken instead")
		return false, libkb.TeamInviteBadTokenError{}
	}
	uv := mctx.CurrentUserVersion()
	timeNow := keybase1.ToTime(mctx.G().Clock().Now())
	acpt, err := generateAcceptanceSeitanV2(seitan, uv, timeNow)
	if err != nil {
		return true, nil
	}
	err = postSeitanV2(mctx, acpt)
	return true, err

}

// Seitan V3 (Seitan Invite Link):

type acceptedSeitanInviteLink struct {
	unixNow  int64
	inviteID SCTeamInviteID
	akey     SeitanAKey
	encoded  string // base64 encoded akey
}

func generateAcceptanceSeitanInviteLink(ikey keybase1.SeitanIKeyInvitelink, uv keybase1.UserVersion, unixNow int64) (ret acceptedSeitanInviteLink, err error) {
	sikey, err := GenerateSIKeyInvitelink(ikey)
	if err != nil {
		return ret, err
	}

	inviteID, err := sikey.GenerateTeamInviteID()
	if err != nil {
		return ret, err
	}

	akey, encoded, err := GenerateSeitanInvitelinkAcceptanceKey(sikey[:], uv.Uid, uv.EldestSeqno, unixNow)
	if err != nil {
		return ret, err
	}

	return acceptedSeitanInviteLink{
		unixNow:  unixNow,
		inviteID: inviteID,
		akey:     akey,
		encoded:  encoded,
	}, nil
}

func postSeitanInviteLink(mctx libkb.MetaContext, acceptedSeitan acceptedSeitanInviteLink) error {
	arg := apiArg("team/seitan_invitelink")
	arg.Args.Add("akey", libkb.S{Val: acceptedSeitan.encoded})
	arg.Args.Add("unix_timestamp", libkb.I64{Val: acceptedSeitan.unixNow})
	arg.Args.Add("invite_id", libkb.S{Val: string(acceptedSeitan.inviteID)})
	_, err := mctx.G().API.Post(mctx, arg)
	return err
}

// presentInviteLinkInUI calls the TeamsUI ConfirmInviteLinkAccept which should
// present a modal or CLI prompt for the user, where they can confirm or
// decline accepting the invite.
func presentInviteLinkInUI(mctx libkb.MetaContext, ui keybase1.TeamsUiInterface, inviteID SCTeamInviteID) error {
	teamInviteID, err := inviteID.TeamInviteID()
	if err != nil {
		return err
	}
	details, err := GetInviteLinkDetails(mctx, teamInviteID)
	if err != nil {
		mctx.Debug("failed to get invite details for %v: %v", inviteID, err)
		return err
	}
	if details.IsMember {
		return libkb.AppStatusError{
			Code: libkb.SCTeamMemberExists,
			Name: "TEAM_MEMBER_EXISTS",
			Desc: fmt.Sprintf("You're already a member of %s!", details.TeamName),
		}
	}
	accepted, err := ui.ConfirmInviteLinkAccept(mctx.Ctx(), keybase1.ConfirmInviteLinkAcceptArg{Details: details})
	if err != nil {
		mctx.Debug("failed to confirm invite link %v: %v", inviteID, err)
		return err
	}
	if !accepted {
		mctx.Debug("invite link %v not accepted", inviteID)
		return errors.New("invite acceptance not confirmed")
	}
	return nil
}

func parseAndAcceptSeitanTokenInvitelink(mctx libkb.MetaContext, ui keybase1.TeamsUiInterface,
	tok string) (wasSeitan bool, err error) {

	seitan, err := ParseIKeyInvitelinkFromString(tok)
	if err != nil {
		mctx.Debug("ParseIKeyInvitelinkFromString error: %s", err)
		mctx.Debug("returning TeamInviteBadToken instead")
		return false, libkb.TeamInviteBadTokenError{}
	}
	uv := mctx.CurrentUserVersion()
	unixNow := mctx.G().Clock().Now().Unix()
	acpt, err := generateAcceptanceSeitanInviteLink(seitan, uv, unixNow)
	if err != nil {
		return true, err
	}

	if ui != nil {
		err = presentInviteLinkInUI(mctx, ui, acpt.inviteID)
		if err != nil {
			return true, err
		}
	} else {
		mctx.Debug("`ui` is nil, skipping presentInviteLinkInUI")
	}

	err = postSeitanInviteLink(mctx, acpt)
	return true, err
}
