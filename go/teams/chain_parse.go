package teams

import (
	"encoding/json"
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type SCTeamName string
type SCTeamID string
type SCTeamInviteID string

func (s SCTeamID) ToTeamID() (keybase1.TeamID, error) { return keybase1.TeamIDFromString(string(s)) }

// A (username, seqno) pair.
// The username is adorned with "%n" at the end
// where n is the seqno IF the seqno is not 1.
type SCTeamMember keybase1.UserVersion

type SCTeamSection struct {
	ID               SCTeamID                               `json:"id"`
	Name             *SCTeamName                            `json:"name,omitempty"`
	Members          *SCTeamMembers                         `json:"members,omitempty"`
	Parent           *SCTeamParent                          `json:"parent,omitempty"`
	Subteam          *SCSubteam                             `json:"subteam,omitempty"`
	PerTeamKey       *SCPerTeamKey                          `json:"per_team_key,omitempty"`
	Admin            *SCTeamAdmin                           `json:"admin,omitempty"`
	Invites          *SCTeamInvites                         `json:"invites,omitempty"`
	CompletedInvites map[keybase1.TeamInviteID]keybase1.UID `json:"completed_invites,omitempty"`
	Implicit         bool                                   `json:"is_implicit,omitempty"`
	Public           bool                                   `json:"is_public,omitempty"`
}

type SCTeamMembers struct {
	Owners  *[]SCTeamMember `json:"owner,omitempty"`
	Admins  *[]SCTeamMember `json:"admin,omitempty"`
	Writers *[]SCTeamMember `json:"writer,omitempty"`
	Readers *[]SCTeamMember `json:"reader,omitempty"`
	None    *[]SCTeamMember `json:"none,omitempty"`
}

type SCTeamInvites struct {
	Owners  *[]SCTeamInvite   `json:"owner,omitempty"`
	Admins  *[]SCTeamInvite   `json:"admin,omitempty"`
	Writers *[]SCTeamInvite   `json:"writer,omitempty"`
	Readers *[]SCTeamInvite   `json:"reader,omitempty"`
	Cancel  *[]SCTeamInviteID `json:"cancel,omitempty"`
}

type SCTeamInvite struct {
	Type string         `json:"type"`
	Name string         `json:"name"`
	ID   SCTeamInviteID `json:"id"`
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
}

func (a SCTeamAdmin) SigChainLocation() keybase1.SigChainLocation {
	return keybase1.SigChainLocation{
		Seqno:   a.Seqno,
		SeqType: a.SeqType,
	}
}

func (s *SCTeamMember) UnmarshalJSON(b []byte) (err error) {
	uv, err := ParseUserVersion(keybase1.Unquote(b))
	if err != nil {
		return err
	}
	*s = SCTeamMember(uv)
	return nil
}

func (s *SCTeamMember) MarshalJSON() (b []byte, err error) {
	return keybase1.Quote(keybase1.UserVersion(*s).PercentForm()), nil
}

// Non-team-specific stuff below the line
// -------------------------

type SCChainLink struct {
	Seqno keybase1.Seqno `json:"seqno"`
	Sig   string         `json:"sig"`
	// string containing json of a SCChainLinkPayload.
	Payload string `json:"payload_json"`
	// uid of the signer
	UID     keybase1.UID `json:"uid"`
	Version int          `json:"version"`
}

func (link *SCChainLink) UnmarshalPayload() (res SCChainLinkPayload, err error) {
	if len(link.Payload) == 0 {
		return res, errors.New("empty payload")
	}
	err = json.Unmarshal([]byte(link.Payload), &res)
	return res, err
}

type SCChainLinkPayload struct {
	Body     SCPayloadBody    `json:"body,omitempty"`
	Ctime    int              `json:"ctime,omitempty"`
	ExpireIn int              `json:"expire_in,omitempty"`
	Prev     *string          `json:"prev,omitempty"`
	SeqType  keybase1.SeqType `json:"seq_type,omitempty"`
	Seqno    keybase1.Seqno   `json:"seqno,omitempty"`
	Tag      string           `json:"tag,omitempty"`
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
	Version    int                 `json:"version"`

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

func (i SCTeamInvite) TeamInvite(g *libkb.GlobalContext, r keybase1.TeamRole, inviter keybase1.UserVersion) (keybase1.TeamInvite, error) {
	id, err := i.ID.TeamInviteID()
	if err != nil {
		return keybase1.TeamInvite{}, err
	}
	typ, err := keybase1.TeamInviteTypeFromString(string(i.Type), g.Env.GetRunMode() == libkb.DevelRunMode)
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
