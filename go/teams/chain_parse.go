package teams

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams/hidden"
)

type SCTeamName string
type SCTeamID string
type SCTeamInviteID string
type SCTeamBoxSummaryHash string

// SCTeamEntropy is used to render stubbed out links unguessable.
// Basically, we shove a random 18-byte string into sensitive links.
type SCTeamEntropy string

func (s SCTeamID) ToTeamID() (keybase1.TeamID, error) { return keybase1.TeamIDFromString(string(s)) }

// A (username, seqno) pair.
// The username is adorned with "%n" at the end
// where n is the seqno IF the seqno is not 1.
type SCTeamMember keybase1.UserVersion

type SCMapInviteIDToUV map[keybase1.TeamInviteID]keybase1.UserVersionPercentForm

type SCTeamSection struct {
	ID               SCTeamID               `json:"id"`
	Name             *SCTeamName            `json:"name,omitempty"`
	Members          *SCTeamMembers         `json:"members,omitempty"`
	Parent           *SCTeamParent          `json:"parent,omitempty"`
	Subteam          *SCSubteam             `json:"subteam,omitempty"`
	PerTeamKey       *SCPerTeamKey          `json:"per_team_key,omitempty"`
	Admin            *SCTeamAdmin           `json:"admin,omitempty"`
	Invites          *SCTeamInvites         `json:"invites,omitempty"`
	CompletedInvites SCMapInviteIDToUV      `json:"completed_invites,omitempty"`
	Implicit         bool                   `json:"is_implicit,omitempty"`
	Public           bool                   `json:"is_public,omitempty"`
	Entropy          SCTeamEntropy          `json:"entropy,omitempty"`
	Settings         *SCTeamSettings        `json:"settings,omitempty"`
	KBFS             *SCTeamKBFS            `json:"kbfs,omitempty"`
	BoxSummaryHash   *SCTeamBoxSummaryHash  `json:"box_summary_hash,omitempty"`
	Ratchets         []hidden.SCTeamRatchet `json:"ratchets,omitempty"`
	BotSettings      *[]SCTeamBot           `json:"bot_settings,omitempty"`
}

type SCTeamMembers struct {
	Owners         *[]SCTeamMember `json:"owner,omitempty"`
	Admins         *[]SCTeamMember `json:"admin,omitempty"`
	Writers        *[]SCTeamMember `json:"writer,omitempty"`
	Readers        *[]SCTeamMember `json:"reader,omitempty"`
	Bots           *[]SCTeamMember `json:"bot,omitempty"`
	RestrictedBots *[]SCTeamMember `json:"restricted_bot,omitempty"`
	None           *[]SCTeamMember `json:"none,omitempty"`
}

type SCTeamInvites struct {
	Owners  *[]SCTeamInvite   `json:"owner,omitempty"`
	Admins  *[]SCTeamInvite   `json:"admin,omitempty"`
	Writers *[]SCTeamInvite   `json:"writer,omitempty"`
	Readers *[]SCTeamInvite   `json:"reader,omitempty"`
	Cancel  *[]SCTeamInviteID `json:"cancel,omitempty"`
}

type SCTeamInvite struct {
	Type string                  `json:"type"`
	Name keybase1.TeamInviteName `json:"name"`
	ID   SCTeamInviteID          `json:"id"`
}

type SCTeamParent struct {
	ID      SCTeamID         `json:"id"`
	Seqno   keybase1.Seqno   `json:"seqno"`
	SeqType keybase1.SeqType `json:"seq_type"`
}

type SCSubteam struct {
	ID   SCTeamID   `json:"id"`
	Name SCTeamName `json:"name"`
}

type SCTeamAdmin struct {
	TeamID  SCTeamID         `json:"team_id"`
	Seqno   keybase1.Seqno   `json:"seqno"`
	SeqType keybase1.SeqType `json:"seq_type"`
}

type SCPerTeamKey struct {
	Generation keybase1.PerTeamKeyGeneration `json:"generation"`
	EncKID     keybase1.KID                  `json:"encryption_kid"`
	SigKID     keybase1.KID                  `json:"signing_kid"`
	ReverseSig string                        `json:"reverse_sig"`
	SeedCheck  string                        `json:"seed_check,omitempty"`
}

type SCTeamSettings struct {
	Open *SCTeamSettingsOpen `json:"open,omitempty"`
}

type SCTeamSettingsOpenOptions struct {
	JoinAs string `json:"join_as"`
}

type SCTeamSettingsOpen struct {
	Enabled bool                       `json:"enabled"`
	Options *SCTeamSettingsOpenOptions `json:"options,omitempty"`
}

type SCTeamKBFS struct {
	TLF    *SCTeamKBFSTLF           `json:"tlf,omitempty"`
	Keyset *SCTeamKBFSLegacyUpgrade `json:"legacy_tlf_upgrade,omitempty"`
}

type SCTeamKBFSTLF struct {
	ID keybase1.TLFID `json:"id"`
}

type SCTeamKBFSLegacyUpgrade struct {
	AppType          keybase1.TeamApplication             `json:"app_type"`
	TeamGeneration   keybase1.PerTeamKeyGeneration        `json:"team_generation"`
	LegacyGeneration int                                  `json:"legacy_generation"`
	KeysetHash       keybase1.TeamEncryptedKBFSKeysetHash `json:"encrypted_keyset_hash"`
}

type SCTeamBotUV struct {
	UID         keybase1.UID   `json:"uid"`
	EldestSeqno keybase1.Seqno `json:"eldest_seqno"`
}

type SCTeamBot struct {
	Bot SCTeamBotUV `json:"bot"`
	// Should the bot be summoned for !-commands
	Cmds bool `json:"cmds"`
	// Should the bot be summoned for @-mentions
	Mentions bool `json:"mentions"`
	// Phrases that should trigger the bot to be keyed for content. Will be
	// check as a valid regex.
	Triggers *[]string `json:"triggers,omitempty"`
	// Conversations the bot can participate in, `nil` indicates all
	Convs *[]string `json:"convs,omitempty"`
}

func ToSCTeamBotUV(uv keybase1.UserVersion) SCTeamBotUV {
	return SCTeamBotUV{
		UID:         uv.Uid,
		EldestSeqno: uv.EldestSeqno,
	}
}

func (u SCTeamBotUV) ToUserVersion() keybase1.UserVersion {
	return keybase1.UserVersion{
		Uid:         u.UID,
		EldestSeqno: u.EldestSeqno,
	}
}

func (i SCTeamInvites) Len() int {
	size := 0
	if i.Owners != nil {
		size += len(*i.Owners)
	}
	if i.Admins != nil {
		size += len(*i.Admins)
	}
	if i.Writers != nil {
		size += len(*i.Writers)
	}
	if i.Readers != nil {
		size += len(*i.Readers)
	}
	if i.Cancel != nil {
		size += len(*i.Cancel)
	}
	return size
}

func (a SCTeamAdmin) SigChainLocation() keybase1.SigChainLocation {
	return keybase1.SigChainLocation{
		Seqno:   a.Seqno,
		SeqType: a.SeqType,
	}
}

func (s *SCTeamMember) UnmarshalJSON(b []byte) (err error) {
	uv, err := keybase1.ParseUserVersion(keybase1.UserVersionPercentForm(keybase1.Unquote(b)))
	if err != nil {
		return err
	}
	*s = SCTeamMember(uv)
	return nil
}

func (s *SCTeamMember) MarshalJSON() (b []byte, err error) {
	return keybase1.Quote(keybase1.UserVersion(*s).PercentForm().String()), nil
}

// Non-team-specific stuff below the line
// -------------------------

type SCChainLink struct {
	Seqno        keybase1.Seqno   `json:"seqno"`
	Sig          string           `json:"sig"`
	SigV2Payload string           `json:"s2"`
	Payload      string           `json:"payload_json"` // String containing json of a SCChainLinkPayload
	UID          keybase1.UID     `json:"uid"`          // UID of the signer
	EldestSeqno  keybase1.Seqno   `json:"eldest_seqno"` // Eldest seqn of the signer
	Version      libkb.SigVersion `json:"version"`
}

func (link *SCChainLink) UnmarshalPayload() (res SCChainLinkPayload, err error) {
	if len(link.Payload) == 0 {
		return res, errors.New("empty payload")
	}
	err = json.Unmarshal([]byte(link.Payload), &res)
	return res, err
}

type SCChainLinkPayload struct {
	Body                SCPayloadBody                `json:"body,omitempty"`
	Ctime               int                          `json:"ctime,omitempty"`
	ExpireIn            int                          `json:"expire_in,omitempty"`
	Prev                *string                      `json:"prev,omitempty"`
	SeqType             keybase1.SeqType             `json:"seq_type,omitempty"`
	Seqno               keybase1.Seqno               `json:"seqno,omitempty"`
	Tag                 string                       `json:"tag,omitempty"`
	IgnoreIfUnsupported libkb.SigIgnoreIfUnsupported `json:"ignore_if_unsupported,omitempty"`
}

func (s SCChainLinkPayload) SigChainLocation() keybase1.SigChainLocation {
	return keybase1.SigChainLocation{
		Seqno:   s.Seqno,
		SeqType: s.SeqType,
	}
}

type SCMerkleRootSection struct {
	Ctime    int               `json:"ctime"`
	Seqno    keybase1.Seqno    `json:"seqno"`
	HashMeta keybase1.HashMeta `json:"hash_meta"`
}

func (sr SCMerkleRootSection) ToMerkleRootV2() keybase1.MerkleRootV2 {
	return keybase1.MerkleRootV2{
		Seqno:    sr.Seqno,
		HashMeta: sr.HashMeta,
	}
}

type SCPayloadBody struct {
	Key        *SCKeySection       `json:"key,omitempty"`
	Type       string              `json:"type,omitempty"`
	MerkleRoot SCMerkleRootSection `json:"merkle_root"`
	Version    libkb.SigVersion    `json:"version"`

	Team *SCTeamSection `json:"team,omitempty"`
}

type SCKeySection struct {
	KID       keybase1.KID `json:"kid"`
	UID       keybase1.UID `json:"uid"`
	Username  string       `json:"username,omitempty"`
	EldestKID keybase1.KID `json:"eldest_kid"`
	Host      string       `json:"host,omitempty"`
}

// Parse a chain link from a string. Just parses, does not validate.
func ParseTeamChainLink(link string) (res SCChainLink, err error) {
	err = json.Unmarshal([]byte(link), &res)
	return res, err
}

func (s SCChainLinkPayload) TeamAdmin() *SCTeamAdmin {
	t := s.Body.Team
	if t == nil {
		return nil
	}
	return t.Admin
}

func (s SCChainLinkPayload) Ratchets() []hidden.SCTeamRatchet {
	t := s.Body.Team
	if t == nil {
		return nil
	}
	return t.Ratchets
}

func (s SCChainLinkPayload) TeamID() (keybase1.TeamID, error) {
	t := s.Body.Team
	if t == nil {
		return keybase1.TeamID(""), errors.New("no team section")
	}
	return t.ID.ToTeamID()
}

func (i SCTeamInviteID) TeamInviteID() (keybase1.TeamInviteID, error) {
	return keybase1.TeamInviteIDFromString(string(i))
}

func (i SCTeamInviteID) Eq(i2 keybase1.TeamInviteID) bool {
	tmp, err := i.TeamInviteID()
	if err != nil {
		return false
	}
	return tmp.Eq(i2)
}

func (i SCTeamInvite) TeamInvite(mctx libkb.MetaContext, r keybase1.TeamRole, inviter keybase1.UserVersion) (keybase1.TeamInvite, error) {
	id, err := i.ID.TeamInviteID()
	if err != nil {
		return keybase1.TeamInvite{}, err
	}
	typ, err := TeamInviteTypeFromString(mctx, string(i.Type))
	if err != nil {
		return keybase1.TeamInvite{}, err
	}
	return keybase1.TeamInvite{
		Id:      id,
		Role:    r,
		Type:    typ,
		Name:    keybase1.TeamInviteName(i.Name),
		Inviter: inviter,
	}, nil
}

func CreateTeamSettings(open bool, joinAs keybase1.TeamRole) (SCTeamSettings, error) {
	if !open {
		return SCTeamSettings{
			Open: &SCTeamSettingsOpen{
				Enabled: false,
			},
		}, nil
	}

	var roleStr string
	switch joinAs {
	case keybase1.TeamRole_READER:
		roleStr = "reader"
	case keybase1.TeamRole_WRITER:
		roleStr = "writer"
	default:
		return SCTeamSettings{}, fmt.Errorf("%v is not a valid joinAs role for open team", joinAs)
	}

	return SCTeamSettings{
		Open: &SCTeamSettingsOpen{
			Enabled: true,
			Options: &SCTeamSettingsOpenOptions{
				JoinAs: roleStr,
			},
		},
	}, nil
}

func CreateTeamBotSettings(bots map[keybase1.UserVersion]keybase1.TeamBotSettings) ([]SCTeamBot, error) {
	var res []SCTeamBot
	for bot, botSettings := range bots {
		// Sanity check the triggers are valid
		for _, trigger := range botSettings.Triggers {
			if _, err := regexp.Compile(trigger); err != nil {
				return nil, err
			}
		}
		// Sanity check the conversation IDs are well formed
		for _, convID := range botSettings.Convs {
			if _, err := chat1.MakeConvID(convID); err != nil {
				return nil, err
			}
		}
		var convs, triggers *[]string
		if len(botSettings.Triggers) > 0 {
			triggers = &(botSettings.Triggers)
		}
		if len(botSettings.Convs) > 0 {
			convs = &(botSettings.Convs)
		}
		res = append(res, SCTeamBot{
			Bot:      ToSCTeamBotUV(bot),
			Cmds:     botSettings.Cmds,
			Mentions: botSettings.Mentions,
			Triggers: triggers,
			Convs:    convs,
		})
	}
	return res, nil
}

func (n SCTeamName) LastPart() (string, error) {
	x, err := keybase1.TeamNameFromString(string(n))
	if err != nil {
		return "", err
	}
	return string(x.LastPart()), nil
}

func (h SCTeamBoxSummaryHash) BoxSummaryHash() keybase1.BoxSummaryHash {
	return keybase1.BoxSummaryHash(string(h))
}
