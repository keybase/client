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

	completedInvites map[keybase1.TeamInviteID]bool
}

func CreateAddMemberTx(t *Team) *AddMemberTx {
	return &AddMemberTx{
		team:             t,
		completedInvites: make(map[keybase1.TeamInviteID]bool),
	}
}

func (tx *AddMemberTx) DebugPayloads() []interface{} {
	return tx.payloads
}

func (tx *AddMemberTx) IsEmpty() bool {
	return len(tx.payloads) == 0
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

func (tx *AddMemberTx) removeMember(uv keybase1.UserVersion) {
	payload := tx.changeMembershipPayload()
	payload.None = append(payload.None, uv)
}

func (tx *AddMemberTx) addMember(uv keybase1.UserVersion, role keybase1.TeamRole) {
	payload := tx.changeMembershipPayload()
	payload.AddUVWithRole(uv, role)
}

func (tx *AddMemberTx) addMemberAndCompleteInvite(uv keybase1.UserVersion,
	role keybase1.TeamRole, inviteID keybase1.TeamInviteID) {
	payload := tx.changeMembershipPayload()
	payload.AddUVWithRole(uv, role)
	payload.CompleteInviteID(inviteID, uv.PercentForm())
}

func (tx *AddMemberTx) CancelInvite(id keybase1.TeamInviteID) {
	payload := tx.invitePayload()
	if payload.Cancel == nil {
		payload.Cancel = &[]SCTeamInviteID{SCTeamInviteID(id)}
	} else {
		tmp := append(*payload.Cancel, SCTeamInviteID(id))
		payload.Cancel = &tmp
	}
}

func appendToInviteList(inv SCTeamInvite, list *[]SCTeamInvite) *[]SCTeamInvite {
	var tmp []SCTeamInvite
	if list != nil {
		tmp = *list
	}
	tmp = append(tmp, inv)
	return &tmp
}

func (tx *AddMemberTx) createInvite(ctx context.Context, uv keybase1.UserVersion, role keybase1.TeamRole) {
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
		tx.team.G().Log.CWarningf(ctx, "Unexpected role in tx.createInvite(%v, %v)", uv, role)
	}
}

// sweepCryptoMembers will queue "removes" for all cryptomembers with given
// UID.
func (tx *AddMemberTx) sweepCryptoMembers(uid keybase1.UID) {
	team := tx.team
	for chainUv := range team.chain().inner.UserLog {
		if chainUv.Uid.Equal(uid) && team.chain().getUserRole(chainUv) != keybase1.TeamRole_NONE {
			tx.removeMember(chainUv)
		}
	}
}

func (tx *AddMemberTx) sweepCryptoMembersOlderThan(uv keybase1.UserVersion) {
	team := tx.team
	for chainUv := range team.chain().inner.UserLog {
		if chainUv.Uid.Equal(uv.Uid) &&
			chainUv.EldestSeqno < uv.EldestSeqno &&
			team.chain().getUserRole(chainUv) != keybase1.TeamRole_NONE {
			tx.removeMember(chainUv)
		}
	}
}

// sweepKeybaseInvites will queue "cancels" for all keybase-type
// invites (PUKless members) for given UID.
func (tx *AddMemberTx) sweepKeybaseInvites(uid keybase1.UID) {
	team := tx.team
	for _, invite := range team.chain().inner.ActiveInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid.Equal(uid) && !tx.completedInvites[invite.Id] {
				tx.CancelInvite(invite.Id)
			}
		}
	}
}

func (tx *AddMemberTx) findChangeReqForUV(uv keybase1.UserVersion) *keybase1.TeamChangeReq {
	for _, v := range tx.payloads {
		if req, ok := v.(*keybase1.TeamChangeReq); ok {
			for _, x := range req.GetAllAdds() {
				if x.Eq(uv) {
					return req
				}
			}
		}
	}

	return nil
}

// addMemberByUPKV2 is an internal method to add user once we have
// current incarnation of UPAK. Public APIs are AddMemberByUV and
// AddMemberByUsername that load UPAK and pass it to this function
// to continue membership changes.
func (tx *AddMemberTx) addMemberByUPKV2(ctx context.Context, user keybase1.UserPlusKeysV2, role keybase1.TeamRole) (err error) {
	team := tx.team
	g := team.G()

	uv := NewUserVersion(user.Uid, user.EldestSeqno)
	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.addMemberByUPKV2(name:%q uv:%v, %v) to team: %q",
		user.Username, uv, role, team.Name()), func() error { return err })()

	if user.Status == keybase1.StatusCode_SCDeleted {
		return fmt.Errorf("User %q (%s) is deleted", user.Username, uv.Uid)
	}

	if role == keybase1.TeamRole_OWNER && team.IsSubteam() {
		return NewSubteamOwnersError()
	}

	hasPUK := len(user.PerUserKeys) > 0
	if !hasPUK {
		g.Log.CDebugf(ctx, "Invite required for %v", uv)
	}

	normalizedUsername := libkb.NewNormalizedUsername(user.Username)

	if team.IsMember(ctx, uv) {
		if !hasPUK {
			return fmt.Errorf("user %s is already a member of %q, yet they don't have a PUK",
				normalizedUsername, team.Name())
		}
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a member of team %q",
			normalizedUsername, team.Name())}
	}

	if existingUV, err := team.UserVersionByUID(ctx, uv.Uid); err == nil {
		// TODO: Might be able to collapse the two assertions together
		// - the one above with team.IsMember and this one which
		// checking Uid/Eldest.

		// There is an edge case where user is in the middle of
		// resetting (after reset, before provisioning) and has
		// EldestSeqno=0.
		if hasPUK && existingUV.EldestSeqno > uv.EldestSeqno {
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
		err = nil
	}
	if curInvite != nil && !hasPUK {
		return libkb.ExistsError{Msg: fmt.Sprintf("user %s is already invited to team %q",
			normalizedUsername, team.Name())}
	}

	// No going back after this point!

	tx.sweepKeybaseInvites(uv.Uid)
	tx.sweepCryptoMembers(uv.Uid)

	if !hasPUK {
		tx.createInvite(ctx, uv, role)
	} else {
		tx.addMember(uv, role)
	}
	return nil
}

// AddMemberByUsername will add member by UV and role. It checks if
// given UV is valid (that we don't have outdated EldestSeqno), and if
// user has PUK, and if not, it properly handles that by adding
// Keybase-type invite. It also cleans up old invites and memberships.
func (tx *AddMemberTx) AddMemberByUV(ctx context.Context, uv keybase1.UserVersion, role keybase1.TeamRole) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.AddMemberByUV(%v,%v) to team %q", uv, role, team.Name()), func() error { return err })()
	upak, err := loadUPAK2(ctx, g, uv.Uid, true /* forcePoll */)
	if err != nil {
		return err
	}

	current := upak.Current
	if uv.EldestSeqno != current.EldestSeqno {
		return fmt.Errorf("Bad eldestseqno for %s: expected %d, got %d", uv.Uid, current.EldestSeqno, uv.EldestSeqno)
	}

	return tx.addMemberByUPKV2(ctx, current, role)
}

// AddMemberByUsername will add member by username and role. It
// checks if given username can become crypto member or a PUKless
// member. It will also clean up old invites and memberships if
// necessary.
func (tx *AddMemberTx) AddMemberByUsername(ctx context.Context, username string, role keybase1.TeamRole) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.AddMemberByUsername(%s,%v) to team %q", username, role, team.Name()), func() error { return err })()

	res := g.Resolver.ResolveWithBody(username)
	if err := res.GetError(); err != nil {
		return err
	}

	upak, err := loadUPAK2(ctx, g, res.GetUID(), true /* forcePoll */)
	if err != nil {
		return err
	}

	return tx.addMemberByUPKV2(ctx, upak.Current, role)
}

func (tx *AddMemberTx) CompleteInviteByID(ctx context.Context, inviteID keybase1.TeamInviteID, uv keybase1.UserVersion) error {
	payload := tx.findChangeReqForUV(uv)
	if payload == nil {
		return fmt.Errorf("could not find uv %v in transaction", uv)
	}

	payload.CompleteInviteID(inviteID, uv.PercentForm())
	return nil
}

func (tx *AddMemberTx) CompleteSocialInvitesFor(ctx context.Context, uv keybase1.UserVersion, username string) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.CompleteSocialInvitesFor(%v,%s)", uv, username), func() error { return err })()
	if team.NumActiveInvites() == 0 {
		g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: no active invites in team")
		return nil
	}

	// Find the right payload first
	payload := tx.findChangeReqForUV(uv)
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

func (tx *AddMemberTx) completeAllKeybaseInvitesForUID(uv keybase1.UserVersion) error {
	// Find the right payload first
	payload := tx.findChangeReqForUV(uv)
	if payload == nil {
		return fmt.Errorf("could not find uv %v in transaction", uv)
	}

	team := tx.team
	for _, invite := range team.chain().inner.ActiveInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid.Equal(uv.Uid) {
				if payload.CompletedInvites == nil {
					payload.CompletedInvites = make(map[keybase1.TeamInviteID]keybase1.UserVersionPercentForm)
				}
				payload.CompletedInvites[invite.Id] = uv.PercentForm()
			}
		}
	}

	return nil
}

func (tx *AddMemberTx) ReAddMemberToImplicitTeam(ctx context.Context, uv keybase1.UserVersion, hasPUK bool, role keybase1.TeamRole) error {
	if hasPUK {
		tx.addMember(uv, role)
		tx.sweepCryptoMembers(uv.Uid)
		if err := tx.completeAllKeybaseInvitesForUID(uv); err != nil {
			return err
		}
	} else {
		tx.createInvite(ctx, uv, role)
		tx.sweepKeybaseInvites(uv.Uid)
		// We cannot sweep crypto members here because we need to
		// ensure that we are only posting one link, and if we want to
		// add pukless member, it has to be invite link. So old crypto
		// members have to stay for now. However, old crypto member
		// should be sweeped when Keybase-type invite goes through SBS
		// handler and invited member becomes a real crypto dude.
	}

	if len(tx.payloads) != 1 {
		return errors.New("ReAddMemberToImplicitTeam tried to create more than one link")
	}

	return nil
}

// AddMemberBySBS is very similar in what it does to addMemberByUPAKV2
// (or AddMemberBy* family of functions), but it has easier job
// because it only adds cryptomembers and fails on PUKless users. It
// also sets invite referenced by `invitee.InviteID` as Completed by
// UserVersion from `invitee` in the same ChangeMembership link that
// adds the user to the team.
//
// AddMemberBySBS assumes that member role is already checked by the
// caller, so it might generate invalid signature if invitee is
// already a member with same role.
func (tx *AddMemberTx) AddMemberBySBS(ctx context.Context, invitee keybase1.TeamInvitee, role keybase1.TeamRole) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.AddMemberBySBS(%v) to team: %q",
		invitee, team.Name()), func() error { return err })()

	uv := NewUserVersion(invitee.Uid, invitee.EldestSeqno)
	upak, err := loadUPAK2(ctx, g, uv.Uid, true /* forcePoll */)
	if err != nil {
		return err
	}

	user := upak.Current
	if uv.EldestSeqno != user.EldestSeqno {
		return fmt.Errorf("Bad eldestseqno for %s: expected %d, got %d", uv.Uid, user.EldestSeqno, uv.EldestSeqno)
	}

	if len(user.PerUserKeys) == 0 {
		return fmt.Errorf("Cannot add PUKless user %q (%s) for SBS", user.Username, uv.Uid)
	}

	if user.Status == keybase1.StatusCode_SCDeleted {
		return fmt.Errorf("User %q (%s) is deleted", user.Username, uv.Uid)
	}

	if role == keybase1.TeamRole_OWNER && team.IsSubteam() {
		return NewSubteamOwnersError()
	}

	// Mark that we will be completing inviteID so sweepKeybaseInvites
	// does not cancel it if it happens to be keybase-type.
	tx.completedInvites[invitee.InviteID] = true

	tx.sweepKeybaseInvites(uv.Uid)
	tx.sweepCryptoMembersOlderThan(uv)

	tx.addMemberAndCompleteInvite(uv, role, invitee.InviteID)
	return nil
}

func (tx *AddMemberTx) Post(ctx context.Context) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, "AddMemberTx.Post", func() error { return err })()
	if len(tx.payloads) == 0 {
		return errors.New("there are no signatures to post")
	}

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

			memSet.appendMemberSet(payloadMemberSet)

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
	if err != nil {
		return err
	}
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
		// section that removes users and add it there.
		found := false
		for i, v := range tx.payloads {
			if req, ok := v.(*keybase1.TeamChangeReq); ok && len(req.None) > 0 {
				sections[i].PerTeamKey = perTeamKeySection
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("AddMemberTx.Post got a PerTeamKey but couldn't find a link with None to attach it")
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
