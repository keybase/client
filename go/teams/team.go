package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type TeamBox struct {
	Nonce           string
	SenderKID       keybase1.KID `json:"sender_kid"`
	Generation      int
	Ctext           string
	PerUserKeySeqno keybase1.Seqno `json:"per_user_key_seqno"`
}

type Team struct {
	Chain *TeamSigChainState
	Box   TeamBox
}

func (t *Team) UsernamesWithRole(role keybase1.TeamRole) ([]libkb.NormalizedUsername, error) {
	uvs, err := t.Chain.GetUsersWithRole(role)
	if err != nil {
		return nil, err
	}
	names := make([]libkb.NormalizedUsername, len(uvs))
	for i, uv := range uvs {
		names[i] = uv.Username
	}
	return names, nil
}

func (t *Team) Members() (keybase1.TeamMembers, error) {
	var members keybase1.TeamMembers

	x, err := t.UsernamesWithRole(keybase1.TeamRole_OWNER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Owners = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_ADMIN)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Admins = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_WRITER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Writers = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_READER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Readers = libkb.NormalizedUsernamesToStrings(x)

	return members, nil
}
