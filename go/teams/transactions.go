// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"errors"
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

func (tx *AddMemberTx) SweepMembers(uid keybase1.UID) {
	team := tx.team
	for chainUv := range team.chain().inner.UserLog {
		if chainUv.Uid == uid && team.chain().getUserRole(chainUv) != keybase1.TeamRole_NONE {
			tx.RemoveMember(chainUv)
		}
	}
}

func (tx *AddMemberTx) SweepKeybaseInvites(uid keybase1.UID) {
	team := tx.team
	for _, invite := range team.chain().inner.ActiveInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid == uid {
				tx.CancelInvite(invite.Id)
			}
		}
	}
}

func (tx *AddMemberTx) AddMemberTransaction(ctx context.Context, username string, role keybase1.TeamRole) error {
	team := tx.team
	g := team.G()

	inviteRequired := false
	normalizedUsername, uv, err := loadUserVersionPlusByUsername(ctx, g, username)
	g.Log.CDebugf(ctx, "AddMemberTransaction: loaded user %q -> (%q, %v, %v)", username, normalizedUsername, uv, err)
	if err != nil {
		if err == errInviteRequired {
			inviteRequired = true
			g.Log.CDebugf(ctx, "Invite required for %v", uv)
		} else {
			return err
		}
	}

	// Do not do partial updates here. If error is returned, it is
	// assumed that tx is untouched, and caller can continue with
	// other attempts. This is used in batch member adds, when even if
	// some users can't be added, it skips them and continues with
	// others.

	if team.IsMember(ctx, uv) {
		if inviteRequired {
			return fmt.Errorf("user is already member but we got errInviteRequired")
		}
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a member of team %q",
			normalizedUsername, team.Name())}
	}

	curInvite, err := team.chain().FindActiveInvite(uv.TeamInviteName(), keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_KEYBASE))
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); !ok {
			return err
		}
		curInvite = nil
	}
	if curInvite != nil && inviteRequired {
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a pukless member of team %q",
			normalizedUsername, team.Name())}
	}

	// TODO: Complete invite using curInvite in tx.AddMember branch.
	// Or decide if we want this - maybe complete_invites should be
	// reserved for "real" invite resolutions, as in these that come
	// from SBS handler.

	tx.SweepMembers(uv.Uid)        // Sweep all existing crypto members
	tx.SweepKeybaseInvites(uv.Uid) // Sweep all existing keybase type invites

	if inviteRequired {
		return tx.CreateInvite(uv, role)
	}
	return tx.AddMember(uv, role)
}

func (tx *AddMemberTx) Post(ctx context.Context) (err error) {
	if len(tx.payloads) == 0 {
		return errors.New("there are no signatures to post")
	}

	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, "AddMemberTx.Post", func() error { return err })()
	g.Log.CDebugf(ctx, "AddMemberTx: Attempting to post %d signatures", len(tx.payloads))

	// Initialize key manager.
	if _, err := team.SharedSecret(ctx); err != nil {
		return err
	}

	// Make sure we know recent merkle root.
	if err := team.ForceMerkleRootUpdate(ctx); err != nil {
		return err
	}

	// Get admin permission, we will use the same one for all sigs.
	admin, err := team.getAdminPermission(ctx, true)
	if err != nil {
		return err
	}

	var sections []SCTeamSection
	memSet := newMemberSet()

	for _, p := range tx.payloads {
		section := SCTeamSection{
			ID:       SCTeamID(team.ID),
			Admin:    admin,
			Implicit: team.IsImplicit(),
			Public:   team.IsPublic(),
		}

		switch payload := p.(type) {
		case *keybase1.TeamChangeReq:
			// TODO: Do subteam + req.Owners check

			// We need memberSet for this particular payload, but also keep a
			// memberSet for entire transaction to generate boxes afterwards.
			payloadMemberSet, err := newMemberSetChange(ctx, g, *payload)
			if err != nil {
				return err
			}

			// TODO: Instead of loading members twice, have a "append"
			// function in memberSet.
			if err := memSet.loadMembers(ctx, g, *payload, true /* forcePoll */); err != nil {
				return err
			}

			section.Members, err = payloadMemberSet.Section()
			if err != nil {
				return err
			}

			section.CompletedInvites = payload.CompletedInvites
			sections = append(sections, section)
		case *SCTeamInvites:
			entropy, err := makeSCTeamEntropy()
			if err != nil {
				return err
			}

			section.Invites = payload
			section.Entropy = entropy
			sections = append(sections, section)
		default:
			return fmt.Errorf("Unhandled case in AddMemberTx.Post, unknown type: %T", p)
		}
	}

	var merkleRoot *libkb.MerkleRoot
	var lease *libkb.Lease

	downgrades, err := team.getDowngradedUsers(ctx, memSet)
	if len(downgrades) != 0 {
		lease, merkleRoot, err = libkb.RequestDowngradeLeaseByTeam(ctx, g, team.ID, downgrades)
		if err != nil {
			return err
		}
		defer func() {
			err := libkb.CancelDowngradeLease(ctx, g, lease.LeaseID)
			if err != nil {
				g.Log.CWarningf(ctx, "Failed to cancel downgrade lease: %s", err.Error())
			}
		}()
	}

	secretBoxes, implicitAdminBoxes, perTeamKeySection, err := team.recipientBoxes(ctx, memSet)
	if err != nil {
		return err
	}

	if perTeamKeySection != nil {
		// We have a new per team key, find first TeamChangeReq
		// section created and add perTeamKeySection.
		// TODO: Should it be the first ChangeMembership sig or the last?
		for i, v := range tx.payloads {
			if _, ok := v.(*keybase1.TeamChangeReq); ok {
				sections[i].PerTeamKey = perTeamKeySection
				break
			}
		}
	}

	nextSeqno := team.NextSeqno()
	latestLinkID := team.chain().GetLatestLinkID()

	var readySigs []libkb.SigMultiItem
	for i, section := range sections {
		var linkType libkb.LinkType
		switch tx.payloads[i].(type) {
		case *keybase1.TeamChangeReq:
			linkType = libkb.LinkTypeChangeMembership
		case *SCTeamInvites:
			linkType = libkb.LinkTypeInvite
		}

		sigMultiItem, linkID, err := team.sigTeamItemRaw(ctx, section, linkType, nextSeqno, latestLinkID, merkleRoot)
		if err != nil {
			return err
		}

		g.Log.CDebugf(ctx, "AddMemberTx: Prepared signature %d: Type: %v SeqNo: %d Hash: %q", i, linkType, nextSeqno, linkID)

		nextSeqno++
		latestLinkID = linkID
		readySigs = append(readySigs, sigMultiItem)
	}

	payload := libkb.JSONPayload{}
	payload["sigs"] = readySigs
	if lease != nil {
		payload["downgrade_lease_id"] = lease.LeaseID
	}
	if len(implicitAdminBoxes) != 0 {
		payload["implicit_team_keys"] = implicitAdminBoxes
	}
	if secretBoxes != nil {
		payload["per_team_key"] = secretBoxes
	}

	return team.postMulti(payload)
}
