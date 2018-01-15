// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type AddMemberTx struct {
	team     *Team
	payloads []interface{}
}

func CreateAddMemberTx(t *Team) *AddMemberTx {
	return &AddMemberTx{team: t}
}

func (tx *AddMemberTx) DebugPayloads() []interface{} {
	return tx.payloads
}

func (tx *AddMemberTx) invitePayload() *SCTeamInvites {
	for _, v := range tx.payloads {
		if ret, ok := v.(*SCTeamInvites); ok {
			return ret
		}
	}

	ret := &SCTeamInvites{}
	tx.payloads = append(tx.payloads, ret)
	return ret
}

func (tx *AddMemberTx) changeMembershipPayload() *keybase1.TeamChangeReq {
	for _, v := range tx.payloads {
		if ret, ok := v.(*keybase1.TeamChangeReq); ok {
			return ret
		}
	}

	ret := &keybase1.TeamChangeReq{}
	tx.payloads = append(tx.payloads, ret)
	return ret
}

func (tx *AddMemberTx) RemoveMember(uv keybase1.UserVersion) error {
	payload := tx.changeMembershipPayload()
	payload.None = append(payload.None, uv)
	return nil
}

func (tx *AddMemberTx) AddMember(uv keybase1.UserVersion, role keybase1.TeamRole) error {
	payload := tx.changeMembershipPayload()
	payload.AddUVWithRole(uv, role)
	return nil
}

func (tx *AddMemberTx) CancelInvite(id keybase1.TeamInviteID) error {
	payload := tx.invitePayload()
	if payload.Cancel == nil {
		payload.Cancel = &[]SCTeamInviteID{SCTeamInviteID(id)}
	} else {
		tmp := append(*payload.Cancel, SCTeamInviteID(id))
		payload.Cancel = &tmp
	}
	return nil
}

func appendToInviteList(inv SCTeamInvite, list *[]SCTeamInvite) *[]SCTeamInvite {
	var tmp []SCTeamInvite
	if list == nil {
		tmp = []SCTeamInvite{inv}
	} else {
		tmp = append(*list, inv)
	}
	return &tmp
}

func (tx *AddMemberTx) CreateInvite(uv keybase1.UserVersion, role keybase1.TeamRole) error {
	payload := tx.invitePayload()

	invite := SCTeamInvite{
		Type: "keybase",
		Name: uv.TeamInviteName(),
		ID:   NewInviteID(),
	}

	switch role {
	case keybase1.TeamRole_READER:
		payload.Readers = appendToInviteList(invite, payload.Readers)
	case keybase1.TeamRole_WRITER:
		payload.Writers = appendToInviteList(invite, payload.Writers)
	case keybase1.TeamRole_ADMIN:
		payload.Admins = appendToInviteList(invite, payload.Admins)
	case keybase1.TeamRole_OWNER:
		return fmt.Errorf("Cannot add invites as owners")
	default:
		return fmt.Errorf("Unexpected role: %v", role)
	}
	return nil
}

func (tx *AddMemberTx) SweepMembers(uv keybase1.UserVersion) {
	team := tx.team
	for chainUv := range team.chain().inner.UserLog {
		if chainUv.Uid == uv.Uid && team.chain().getUserRole(chainUv) != keybase1.TeamRole_NONE {
			tx.RemoveMember(chainUv)
		}
	}
}

func (tx *AddMemberTx) SweepKeybaseInvites(uv keybase1.UserVersion) {
	team := tx.team
	for _, invite := range team.chain().inner.ActiveInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err != nil {
			if inviteUv.Uid == uv.Uid {
				tx.CancelInvite(invite.Id)
			}
		}
	}
}

func (tx *AddMemberTx) AddMemberTransaction(ctx context.Context, g *libkb.GlobalContext, username string, role keybase1.TeamRole) error {
	inviteRequired := false
	normalizedUsername, uv, err := loadUserVersionPlusByUsername(ctx, g, username)
	if err != nil {
		if err == errInviteRequired {
			inviteRequired = true
			g.Log.CDebugf(ctx, "Invite required for %+v", uv)
		} else {
			return err
		}
	}

	// Do not do partial updates here. If error is returned, it is
	// assumed that tx is untouched, and caller can continue with
	// other attempts. This is used in batch member adds, when even if
	// some users can't be added, it skips them and continues with
	// others.

	team := tx.team

	if team.IsMember(ctx, uv) {
		if inviteRequired {
			return fmt.Errorf("user is already member but we got errInviteRequired")
		}
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a member of team %q",
			normalizedUsername, team.Name())}
	}

	curInvite, err := team.FindActiveInvite(uv.TeamInviteName(), "keybase")
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); !ok {
			return err
		} else {
			curInvite = nil
		}
	}
	if curInvite != nil && inviteRequired {
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a pukless member of team %q",
			normalizedUsername, team.Name())}
	}
	// TODO: Complete invite using curInvite in tx.AddMember branch.

	tx.SweepMembers(uv)        // Sweep all existing crypto members
	tx.SweepKeybaseInvites(uv) // Sweep all existing keybase type invites

	if inviteRequired {
		tx.CreateInvite(uv, role)
	} else {
		tx.AddMember(uv, role)
	}
	return nil
}
