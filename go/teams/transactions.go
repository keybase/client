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
	payloads []interface{} // *SCTeamInvites or *keybase1.TeamChangeReq
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

func (tx *AddMemberTx) removeMember(uv keybase1.UserVersion) error {
	payload := tx.changeMembershipPayload()
	payload.None = append(payload.None, uv)
	return nil
}

func (tx *AddMemberTx) addMember(uv keybase1.UserVersion, role keybase1.TeamRole) error {
	payload := tx.changeMembershipPayload()
	payload.AddUVWithRole(uv, role)
	return nil
}

func (tx *AddMemberTx) cancelInvite(id keybase1.TeamInviteID) error {
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
	if list != nil {
		tmp = *list
	}
	tmp = append(tmp, inv)
	return &tmp
}

func (tx *AddMemberTx) createInvite(uv keybase1.UserVersion, role keybase1.TeamRole) error {
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
		payload.Owners = appendToInviteList(invite, payload.Owners)
	default:
		return fmt.Errorf("Unexpected role: %v", role)
	}
	return nil
}

// SweepMembers will queue "removes" for all cryptomembers with given
// UID.
func (tx *AddMemberTx) sweepMembers(uid keybase1.UID) {
	team := tx.team
	for chainUv := range team.chain().inner.UserLog {
		if chainUv.Uid == uid && team.chain().getUserRole(chainUv) != keybase1.TeamRole_NONE {
			tx.removeMember(chainUv)
		}
	}
}

// SweepKeybaseInvites will queue "cancels" for all keybase-type
// invites (PUKless members) for given UID.
func (tx *AddMemberTx) sweepKeybaseInvites(uid keybase1.UID) {
	team := tx.team
	for _, invite := range team.chain().inner.ActiveInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid == uid {
				tx.cancelInvite(invite.Id)
			}
		}
	}
}

// AddMemberTransaction will add member by username and role. It
// checks if given username can become crypto member or a PUKless
// member. It will also clean up old invites and memberships if
// necessary.
func (tx *AddMemberTx) AddMemberTransaction(ctx context.Context, username string, role keybase1.TeamRole) error {
	team := tx.team
	g := team.G()

	g.Log.CDebugf(ctx, "AddMemberTransaction(%s, %v) to team %q", username, role, team.Name())

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

	if role == keybase1.TeamRole_OWNER && team.IsSubteam() {
		return NewSubteamOwnersError()
	}

	if team.IsMember(ctx, uv) {
		if inviteRequired {
			return fmt.Errorf("user is already member but we got errInviteRequired")
		}
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a member of team %q",
			normalizedUsername, team.Name())}
	}

	existingUV, err := team.UserVersionByUID(ctx, uv.Uid)
	if err == nil {
		// TODO: Might be able to collapse the two assertions together - the one
		// above with team.IsMember and this one which checking Uid/Eldest.

		// There is an edge case where user is in the middle of
		// resetting (after reset, before provisioning) and has
		// EldestSeqno=0.
		if !inviteRequired && existingUV.EldestSeqno > uv.EldestSeqno {
			return fmt.Errorf("newer version of user %s (uid:%s) already exists in the team %q (%v > %v)",
				normalizedUsername, uv.Uid, team.Name(), existingUV.EldestSeqno, uv.EldestSeqno)
		}
	}

	curInvite, err := team.chain().FindActiveInvite(uv.TeamInviteName(), keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_KEYBASE))
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); !ok {
			return err
		}
		curInvite = nil
	}
	if curInvite != nil && inviteRequired {
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already invited to team %q",
			normalizedUsername, team.Name())}
	}

	// No going back after this point!

	if team.IsImplicit() {
		// Separate logic for sweeping in implicit teams, since memberships
		// there have to be sound for every signature, so we can't post e.g.
		// one sig that removes UV and another that adds invite.

		if inviteRequired {
			tx.sweepKeybaseInvites(uv.Uid)
		} else {
			tx.sweepMembers(uv.Uid)
		}
	} else {
		tx.sweepMembers(uv.Uid)        // Sweep all existing crypto members
		tx.sweepKeybaseInvites(uv.Uid) // Sweep all existing keybase type invites
	}

	if inviteRequired {
		return tx.createInvite(uv, role)
	}
	return tx.addMember(uv, role)
}

func (tx *AddMemberTx) CompleteSocialInvitesFor(ctx context.Context, uv keybase1.UserVersion, username string) error {
	team := tx.team
	g := team.G()

	if team.NumActiveInvites() == 0 {
		g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: no active invites in team")
		return nil
	}

	// Find the right payload first
	var payload *keybase1.TeamChangeReq
	for _, v := range tx.payloads {
		if req, ok := v.(*keybase1.TeamChangeReq); ok {
			found := false
			for _, x := range req.GetAllAdds() {
				if x.Eq(uv) {
					found = true
					break
				}
			}
			if found {
				payload = req
				break
			}
		}
	}

	if payload == nil {
		return fmt.Errorf("could not find uv %v in transaction", uv)
	}

	proofs, err := getUserProofs(ctx, g, username)
	if err != nil {
		return err
	}

	actx := g.MakeAssertionContext()

	var completedInvites = map[keybase1.TeamInviteID]keybase1.UserVersionPercentForm{}

	for _, invite := range team.chain().inner.ActiveInvites {
		ityp, err := invite.Type.String()
		if err != nil {
			return err
		}
		category, err := invite.Type.C()
		if err != nil {
			return err
		}

		if category != keybase1.TeamInviteCategory_SBS {
			continue
		}

		proofsWithType := proofs.Get([]string{ityp})

		var proof *libkb.Proof
		for _, p := range proofsWithType {
			if p.Value == string(invite.Name) {
				proof = &p
				break
			}
		}

		if proof == nil {
			continue
		}

		assertionStr := fmt.Sprintf("%s@%s", string(invite.Name), ityp)
		g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: Found proof in user's ProofSet: key: %s value: %q; invite proof is %s", proof.Key, proof.Value, assertionStr)

		resolveResult := g.Resolver.ResolveFullExpressionNeedUsername(ctx, assertionStr)
		g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: Resolve result is: %+v", resolveResult)
		if resolveResult.GetError() != nil || resolveResult.GetUID() != uv.Uid {
			// Cannot resolve invitation or it does not match user
			continue
		}

		parsedAssertion, err := libkb.AssertionParseAndOnly(actx, assertionStr)
		if err != nil {
			return err
		}

		resolvedAssertion := libkb.ResolvedAssertion{
			UID:           uv.Uid,
			Assertion:     parsedAssertion,
			ResolveResult: resolveResult,
		}
		if err := verifyResolveResult(ctx, g, resolvedAssertion); err == nil {
			completedInvites[invite.Id] = uv.PercentForm()
			g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: Found completed invite: %s -> %v", invite.Id, uv)
		}
	}

	// After checking everything, mutate payload.
	g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: checked invites without errors, adding %d complete(s)", len(completedInvites))
	if len(completedInvites) > 0 {
		if payload.CompletedInvites == nil {
			payload.CompletedInvites = make(map[keybase1.TeamInviteID]keybase1.UserVersionPercentForm)
		}
		for i, v := range completedInvites {
			payload.CompletedInvites[i] = v
		}
	}

	return nil
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

	// Transform payloads to SCTeamSections.
	for _, p := range tx.payloads {
		section := SCTeamSection{
			ID:       SCTeamID(team.ID),
			Admin:    admin,
			Implicit: team.IsImplicit(),
			Public:   team.IsPublic(),
		}

		switch payload := p.(type) {
		case *keybase1.TeamChangeReq:
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

	// If memSet has any downgrades, request downgrade lease.
	var merkleRoot *libkb.MerkleRoot
	var lease *libkb.Lease

	downgrades, err := team.getDowngradedUsers(ctx, memSet)
	if len(downgrades) != 0 {
		lease, merkleRoot, err = libkb.RequestDowngradeLeaseByTeam(ctx, g, team.ID, downgrades)
		if err != nil {
			return err
		}
		// Always cancel lease so we don't leave any hanging.
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

	// Take payloads and team sections and generate chain of signatures.
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
		default:
			return fmt.Errorf("Unhandled case in AddMemberTx.Post, unknown type: %T", tx.payloads[i])
		}

		sigMultiItem, linkID, err := team.sigTeamItemRaw(ctx, section, linkType,
			nextSeqno, latestLinkID, merkleRoot)
		if err != nil {
			return err
		}

		g.Log.CDebugf(ctx, "AddMemberTx: Prepared signature %d: Type: %v SeqNo: %d Hash: %q",
			i, linkType, nextSeqno, linkID)

		nextSeqno++
		latestLinkID = linkID
		readySigs = append(readySigs, sigMultiItem)
	}

	if err := team.precheckLinksToPost(ctx, readySigs); err != nil {
		g.Log.CDebugf(ctx, "Precheck failed: %v", err)
		return err
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

	if err := team.postMulti(payload); err != nil {
		return err
	}

	team.notify(ctx, keybase1.TeamChangeSet{MembershipChanged: true})

	return nil
}
