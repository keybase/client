package team

import (
	"crypto/sha256"
	"encoding/json"
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type SCTeamName string
type SCTeamID string

// A (username, seqno) pair.
// The username is adorned with "%n" at the end
// where n is the seqno IF the seqno is not 1.
type SCTeamMember string

type SCTeamSection struct {
	ID         *SCTeamID      `json:"id,omitempty"`
	Name       *SCTeamName    `json:"name,omitempty"`
	Members    *SCTeamMembers `json:"members,omitempty"`
	Parent     *SCTeamParent  `json:"parent,omitempty"`
	Subteam    *SCSubteam     `json:"subteam,omitempty"`
	PerTeamKey *SCPerTeamKey  `json:"per_team_key,omitempty"`
}

type SCTeamMembers struct {
	Owners  *[]SCTeamMember `json:"owner,omitempty"`
	Admins  *[]SCTeamMember `json:"admin,omitempty"`
	Writers *[]SCTeamMember `json:"writer,omitempty"`
	Readers *[]SCTeamMember `json:"reader,omitempty"`
}

type SCTeamParent struct {
	ID    SCTeamID `json:"id"`
	Seqno int      `json:"seqno"`
}

type SCSubteam struct {
	ID   SCTeamID   `json:"id"`
	Name SCTeamName `json:"name"`
}

type SCPerTeamKey struct {
	Generation int          `json:"generation"`
	EncKID     keybase1.KID `json:"encryption_kid"`
	SigKID     keybase1.KID `json:"signing_kid"`
	ReverseSig string       `json:"reverse_sig"`
}

// Non-team-specific stuff below the line
// -------------------------

type SCChainLink struct {
	Seqno libkb.Seqno `json:"seqno"`
	Sig   string      `json:"sig"`
	// string containing json of a SCChainLinkPayload.
	Payload string `json:"payload_json"`
	// uid of the signer
	UID     keybase1.UID `json:"uid"`
	Version int          `json:"version"`
}

func (link *SCChainLink) PayloadHash() libkb.LinkID {
	if link.Payload == "" {
		return nil
	}
	h := sha256.Sum256([]byte(link.Payload))
	return h[:]
}

func (link *SCChainLink) UnmarshalPayload() (res SCChainLinkPayload, err error) {
	if len(link.Payload) == 0 {
		return res, errors.New("empty payload")
	}
	err = json.Unmarshal([]byte(link.Payload), &res)
	return res, err
}

type SCChainLinkPayload struct {
	Body     SCPayloadBody `json:"body,omitempty"`
	Ctime    int           `json:"ctime,omitempty"`
	ExpireIn int           `json:"expire_in,omitempty"`
	Prev     *string       `json:"prev,omitempty"`
	SeqType  int           `json:"seq_type,omitempty"`
	Seqno    libkb.Seqno   `json:"seqno,omitempty"`
	Tag      string        `json:"tag,omitempty"`
}

type SCPayloadBody struct {
	Key     *SCKeySection `json:"key,omitempty"`
	Type    string        `json:"type,omitempty"`
	Version int           `json:"version"`

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
