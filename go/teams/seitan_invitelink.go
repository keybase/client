package teams

import (
	"context"
	cryptorand "crypto/rand"
	"fmt"
	"regexp"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// documented in go/teams/seitan.go
const SeitanEncodedIKeyInvitelinkLength = 28
const seitanEncodedIKeyInvitelinkPlusOffset = 7

func GenerateSeitanIKeyInvitelink() (ikey keybase1.SeitanIKeyInvitelink, err error) {
	str, err := generateIKey(SeitanEncodedIKeyInvitelinkLength, seitanEncodedIKeyInvitelinkPlusOffset)
	if err != nil {
		return ikey, err
	}
	return keybase1.SeitanIKeyInvitelink(str), nil
}

func ParseIKeyInvitelinkFromString(token string) (ikey keybase1.SeitanIKeyInvitelink, err error) {
	if len(token) != SeitanEncodedIKeyInvitelinkLength {
		return ikey, fmt.Errorf("invalid token length: expected %d characters, got %d", SeitanEncodedIKeyLength, len(token))
	}

	return keybase1.SeitanIKeyInvitelink(strings.ToLower(token)), nil
}

type SeitanSIKeyInvitelink [SeitanScryptKeylen]byte

func GenerateSIKeyInvitelink(ikey keybase1.SeitanIKeyInvitelink) (sikey SeitanSIKeyInvitelink, err error) {
	buf, err := generateSIKey(ikey.String())
	if err != nil {
		return sikey, err
	}
	copy(sikey[:], buf)
	return sikey, nil
}

func (sikey SeitanSIKeyInvitelink) generateMsgpackPayload() ([]byte, error) {
	return msgpack.Encode(NewSeitanInviteIDPayload(SeitanVersionInvitelink))
}

func (sikey SeitanSIKeyInvitelink) GenerateTeamInviteID() (id SCTeamInviteID, err error) {
	payload, err := sikey.generateMsgpackPayload()
	if err != nil {
		return id, err
	}
	return generateTeamInviteID(sikey[:], payload)
}

func (sikey SeitanSIKeyInvitelink) GenerateShortTeamInviteID() (id SCTeamInviteIDShort, err error) {
	payload, err := sikey.generateMsgpackPayload()
	if err != nil {
		return id, err
	}
	return generateShortTeamInviteID(sikey[:], payload)
}

func generatePackedEncryptedKeyWithSecretKeyInvitelink(ikey keybase1.SeitanIKeyInvitelink,
	secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce,
	label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {
	var keyAndLabel keybase1.SeitanKeyAndLabelInvitelink
	keyAndLabel.I = ikey
	keyAndLabel.L = label

	packedKeyAndLabel, err := msgpack.Encode(keybase1.NewSeitanKeyAndLabelWithInvitelink(keyAndLabel))
	if err != nil {
		return pkey, encoded, err
	}
	return packAndEncryptKeyWithSecretKey(secretKey, gen, nonce, packedKeyAndLabel, SeitanVersionInvitelink)
}

func GeneratePackedEncryptedKeyInvitelink(ctx context.Context, ikey keybase1.SeitanIKeyInvitelink,
	team *Team, label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKeyLatest(ctx)
	if err != nil {
		return pkey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = cryptorand.Read(nonce[:]); err != nil {
		return pkey, encoded, err
	}

	return generatePackedEncryptedKeyWithSecretKeyInvitelink(ikey, appKey.Key,
		appKey.KeyGeneration, nonce, label)
}

func GenerateSeitanInvitelinkAcceptanceKey(sikey []byte, uid keybase1.UID, eldestSeqno keybase1.Seqno, unixTimestampSeconds int64) (akey SeitanAKey, encoded string, err error) {
	type AKeyPayload struct {
		Stage       string         `codec:"stage" json:"stage"`
		UID         keybase1.UID   `codec:"uid" json:"uid"`
		EldestSeqno keybase1.Seqno `codec:"eldest_seqno" json:"eldest_seqno"`
		CTime       int64          `codec:"ctime" json:"ctime"`
		Version     SeitanVersion  `codec:"version" json:"version"`
	}

	akeyPayload, err := msgpack.Encode(AKeyPayload{
		Stage:       "accept",
		UID:         uid,
		EldestSeqno: eldestSeqno,
		CTime:       unixTimestampSeconds,
		Version:     SeitanVersionInvitelink,
	})
	if err != nil {
		return akey, encoded, err
	}
	return generateAcceptanceKey(akeyPayload, sikey)
}

// bound from SeitanEncodedIKeyInvitelinkLength
var invitelinkIKeyRxx = regexp.MustCompile(`/i/t/([a-zA-Z0-9]{16,28})#([a-z0-9+]{16,28})`)

func generateInvitelinkURLPrefix(mctx libkb.MetaContext) string {
	// NOTE: if you change this url, change invitelinkIKeyRxx too!
	return fmt.Sprintf("%s/i/t/", libkb.SiteURILookup[mctx.G().Env.GetRunMode()])
}

func GenerateInvitelinkURL(
	mctx libkb.MetaContext,
	ikey keybase1.SeitanIKeyInvitelink,
	id SCTeamInviteIDShort,
) string {
	return fmt.Sprintf("%s%s#%s", generateInvitelinkURLPrefix(mctx), id, ikey)
}

type TeamInviteLinkDetails struct {
	libkb.AppStatusEmbed
	InviterResetOrDel bool                                         `json:"inviter_reset_or_del"`
	InviterUID        keybase1.UID                                 `json:"inviter_uid"`
	InviterUsername   string                                       `json:"inviter_username"`
	IsMember          bool                                         `json:"is_member"`
	TeamAvatars       map[keybase1.AvatarFormat]keybase1.AvatarUrl `json:"team_avatars"`
	TeamDescription   string                                       `json:"team_desc"`
	TeamID            keybase1.TeamID                              `json:"team_id"`
	TeamIsOpen        bool                                         `json:"team_is_open"`
	TeamName          string                                       `json:"team_name"`
	TeamNumMembers    int                                          `json:"team_num_members"`
}

func GetInviteLinkDetails(mctx libkb.MetaContext, inviteID keybase1.TeamInviteID) (info keybase1.InviteLinkDetails, err error) {
	arg := libkb.APIArg{
		Endpoint:    "team/get_invite_details",
		SessionType: libkb.APISessionTypeOPTIONAL,
		Args: libkb.HTTPArgs{
			"invite_id": libkb.S{Val: string(inviteID)},
		},
	}

	var resp TeamInviteLinkDetails
	if err = mctx.G().API.GetDecode(mctx, arg, &resp); err != nil {
		// The server knows about invite IDs (but not keys), so it is fine to
		// put this in the log.
		mctx.Debug("GetInviteLinkDetails: failed to get team invite details for %v: %s", inviteID, err)
		return info, err
	}

	teamName, err := keybase1.TeamNameFromString(resp.TeamName)
	if err != nil {
		return info, err
	}

	return keybase1.InviteLinkDetails{
		InviteID:          inviteID,
		InviterResetOrDel: resp.InviterResetOrDel,
		InviterUID:        resp.InviterUID,
		InviterUsername:   resp.InviterUsername,
		IsMember:          resp.IsMember,
		TeamAvatars:       resp.TeamAvatars,
		TeamDesc:          resp.TeamDescription,
		TeamID:            resp.TeamID,
		TeamIsOpen:        resp.TeamIsOpen,
		TeamName:          teamName,
		TeamNumMembers:    resp.TeamNumMembers,
	}, nil
}
