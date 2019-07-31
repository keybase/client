// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams/hidden"
)

// AddMemberTx helps build a transaction that may contain multiple
// team sigchain links. The caller can use the transaction to add users
// to a team whether they be pukful, pukless, or social assertions.
// Behind the scenes cryptomembers and invites may be removed if
// they are for stale versions of the addees.
// Not threadsafe.
type AddMemberTx struct {
	team     *Team
	payloads []txPayload

	// completedInvites is used to mark completed invites, so they are
	// skipped in sweeping methods.
	completedInvites map[keybase1.TeamInviteID]bool
	// lastChangeForUID holds index of last tx.payloads payload that
	// affects given uid.
	lastChangeForUID map[keybase1.UID]int

	// Override whether the team key is rotated.
	SkipKeyRotation *bool
}

type txPayloadTag string

const txPayloadTagCryptomembers txPayloadTag = "cryptomembers" // -> *keybase1.TeamChangeReq
const txPayloadTagInviteSocial txPayloadTag = "invitesocial"   // -> *SCTeamInvites
const txPayloadTagInviteKeybase txPayloadTag = "invitekeybase" // -> *SCTeamInvites

type txPayload struct {
	Tag txPayloadTag
	// txPayload holds either of: *SCTeamInvites or
	// *keybase1.TeamChangeReq.
	Val interface{}
}

func CreateAddMemberTx(t *Team) *AddMemberTx {
	return &AddMemberTx{
		team:             t,
		completedInvites: make(map[keybase1.TeamInviteID]bool),
		lastChangeForUID: make(map[keybase1.UID]int),
	}
}

func (tx *AddMemberTx) DebugPayloads() (res []interface{}) {
	for _, v := range tx.payloads {
		res = append(res, v.Val)
	}
	return res
}

func (tx *AddMemberTx) IsEmpty() bool {
	return len(tx.payloads) == 0
}

// Internal AddMemberTx methods. They should not be used by consumers
// of AddMemberTx API. Users of this API should avoid lowercase
// methods and fields at all cost, even from same package.

func (tx *AddMemberTx) findPayload(tag txPayloadTag, forUID keybase1.UID) interface{} {
	minSeqno := 0
	hasUID := !forUID.IsNil()
	if hasUID {
		minSeqno = tx.lastChangeForUID[forUID]
	}

	for i, v := range tx.payloads {
		if i >= minSeqno && v.Tag == tag {
			if hasUID && i > minSeqno {
				tx.lastChangeForUID[forUID] = i
			}
			return v.Val
		}
	}

	if hasUID {
		tx.lastChangeForUID[forUID] = len(tx.payloads)
	}
	ret := txPayload{
		Tag: tag,
	}
	switch tag {
	case txPayloadTagCryptomembers:
		ret.Val = &keybase1.TeamChangeReq{}
	case txPayloadTagInviteKeybase, txPayloadTagInviteSocial:
		ret.Val = &SCTeamInvites{}
	default:
		panic(fmt.Sprintf("Unexpected tag %q", tag))
	}
	tx.payloads = append(tx.payloads, ret)
	return ret.Val
}

func (tx *AddMemberTx) inviteKeybasePayload(forUID keybase1.UID) *SCTeamInvites {
	return tx.findPayload(txPayloadTagInviteKeybase, forUID).(*SCTeamInvites)
}

func (tx *AddMemberTx) inviteSocialPayload(forUID keybase1.UID) *SCTeamInvites {
	return tx.findPayload(txPayloadTagInviteSocial, forUID).(*SCTeamInvites)
}

func (tx *AddMemberTx) changeMembershipPayload(forUID keybase1.UID) *keybase1.TeamChangeReq {
	return tx.findPayload(txPayloadTagCryptomembers, forUID).(*keybase1.TeamChangeReq)
}

// Methods modifying payloads are supposed to always succeed given the
// preconditions are satisfied. If not, the usual result is either a
// no-op or an invalid transaction that is rejected by team player
// pre-check or by the server. Public methods should make sure that
// internal methods are always called with these preconditions
// satisfied.

func (tx *AddMemberTx) removeMember(uv keybase1.UserVersion) {
	// Precondition: UV is a cryptomember.
	payload := tx.changeMembershipPayload(uv.Uid)
	payload.None = append(payload.None, uv)
}

func (tx *AddMemberTx) addMember(uv keybase1.UserVersion, role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) error {
	// Preconditions: UV is a PUKful user, role is valid enum value
	// and not NONE.
	payload := tx.changeMembershipPayload(uv.Uid)
	err := payload.AddUVWithRole(uv, role, botSettings)
	return err
}

func (tx *AddMemberTx) addMemberAndCompleteInvite(uv keybase1.UserVersion,
	role keybase1.TeamRole, inviteID keybase1.TeamInviteID) error {
	// Preconditions: UV is a PUKful user, role is valid and not NONE, invite
	// exists. Role is not RESTRICTEDBOT as botSettings are set to nil.
	payload := tx.changeMembershipPayload(uv.Uid)
	err := payload.AddUVWithRole(uv, role, nil)
	payload.CompleteInviteID(inviteID, uv.PercentForm())
	return err
}

func appendToInviteList(inv SCTeamInvite, list *[]SCTeamInvite) *[]SCTeamInvite {
	var tmp []SCTeamInvite
	if list != nil {
		tmp = *list
	}
	tmp = append(tmp, inv)
	return &tmp
}

// createKeybaseInvite queues Keybase-type invite for given UV and role.
func (tx *AddMemberTx) createKeybaseInvite(uv keybase1.UserVersion, role keybase1.TeamRole) error {
	// Preconditions: UV is a PUKless user, and not already in the
	// team, role is valid enum value and not NONE or OWNER.
	return tx.createInvite("keybase", uv.TeamInviteName(), role, uv.Uid)
}

// createInvite queues an invite for invite name with role.
func (tx *AddMemberTx) createInvite(typ string, name keybase1.TeamInviteName, role keybase1.TeamRole, uid keybase1.UID) error {
	var payload *SCTeamInvites
	if typ == "keybase" {
		payload = tx.inviteKeybasePayload(uid)
	} else {
		payload = tx.inviteSocialPayload(uid)
	}

	invite := SCTeamInvite{
		Type: typ,
		Name: name,
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
		// TODO HOTPOT-460 add support for BOT invites
		return fmt.Errorf("invalid role for invite %v", role)
	}
	return nil
}

// sweepCryptoMembers will queue "removes" for all cryptomembers with given UID.
// exceptAdminsRemovingOwners - But don't try to remove owners if we are admin.
func (tx *AddMemberTx) sweepCryptoMembers(ctx context.Context, uid keybase1.UID,
	exceptAdminsRemovingOwners bool) {
	team := tx.team
	var myRole keybase1.TeamRole
	if exceptAdminsRemovingOwners {
		var err error
		myRole, err = tx.team.myRole(ctx)
		if err != nil {
			myRole = keybase1.TeamRole_NONE
		}
	}
	for chainUv := range team.chain().inner.UserLog {
		chainRole := team.chain().getUserRole(chainUv)
		if chainUv.Uid.Equal(uid) && chainRole != keybase1.TeamRole_NONE {
			if exceptAdminsRemovingOwners && myRole == keybase1.TeamRole_ADMIN && chainRole == keybase1.TeamRole_OWNER {
				// Skip if we're an admin and they're an owner.
				continue
			}
			tx.removeMember(chainUv)
		}
	}
}

// sweepCryptoMembersOlderThan will queue "removes" for all cryptomembers
// with same UID as given and EldestSeqno lower than in given UV.
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
	allInvites := team.GetActiveAndObsoleteInvites()
	for _, invite := range allInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid.Equal(uid) && !tx.completedInvites[invite.Id] {
				tx.CancelInvite(invite.Id, uid)
			}
		}
	}
}

func (tx *AddMemberTx) findChangeReqForUV(uv keybase1.UserVersion) *keybase1.TeamChangeReq {
	for _, v := range tx.payloads {
		if v.Tag == txPayloadTagCryptomembers {
			req := v.Val.(*keybase1.TeamChangeReq)
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
func (tx *AddMemberTx) addMemberByUPKV2(ctx context.Context, user keybase1.UserPlusKeysV2, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) (invite bool, err error) {
	team := tx.team
	g := team.G()

	uv := NewUserVersion(user.Uid, user.EldestSeqno)
	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.addMemberByUPKV2(name:%q uv:%v, %v) to team: %q",
		user.Username, uv, role, team.Name()), func() error { return err })()

	if user.Status == keybase1.StatusCode_SCDeleted {
		return false, fmt.Errorf("User %q (%s) is deleted", user.Username, uv.Uid)
	}

	if role == keybase1.TeamRole_OWNER && team.IsSubteam() {
		return false, NewSubteamOwnersError()
	}

	if err := assertValidNewTeamMemberRole(role); err != nil {
		return false, err
	}

	hasPUK := len(user.PerUserKeys) > 0
	if !hasPUK {
		g.Log.CDebugf(ctx, "Invite required for %v", uv)
	}

	normalizedUsername := libkb.NewNormalizedUsername(user.Username)

	if team.IsMember(ctx, uv) {
		if !hasPUK {
			return false, fmt.Errorf("user %s is already a member of %q, yet they don't have a PUK",
				normalizedUsername, team.Name())
		}
		return false, libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a member of team %q",
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
			return false, fmt.Errorf("newer version of user %s (uid:%s) already exists in the team %q (%v > %v)",
				normalizedUsername, uv.Uid, team.Name(), existingUV.EldestSeqno, uv.EldestSeqno)
		}
	}

	curInvite, err := team.chain().FindActiveInvite(uv.TeamInviteName(), keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_KEYBASE))
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); !ok {
			return false, err
		}
		curInvite = nil
		err = nil
	}
	if curInvite != nil && !hasPUK {
		return false, libkb.ExistsError{Msg: fmt.Sprintf("user %s is already invited to team %q",
			normalizedUsername, team.Name())}
	}

	// No going back after this point!

	tx.sweepKeybaseInvites(uv.Uid)

	// An admin is only allowed to remove an owner UV when, in the same link, replacing them with
	// a 'newer' UV with a greater eldest seqno.
	// So, if we're an admin re-adding an owner who does not yet have a PUK
	// then don't try to remove the owner's pre-reset UV.
	exceptAdminsRemovingOwners := !hasPUK
	tx.sweepCryptoMembers(ctx, uv.Uid, exceptAdminsRemovingOwners)

	if !hasPUK {
		if err = tx.createKeybaseInvite(uv, role); err != nil {
			return false, err
		}
		return true, nil
	}
	if err := tx.addMember(uv, role, botSettings); err != nil {
		return false, err
	}
	return false, nil
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

func assertValidNewTeamMemberRole(role keybase1.TeamRole) error {
	switch role {
	case keybase1.TeamRole_RESTRICTEDBOT,
		keybase1.TeamRole_BOT,
		keybase1.TeamRole_READER,
		keybase1.TeamRole_WRITER,
		keybase1.TeamRole_ADMIN,
		keybase1.TeamRole_OWNER:
		return nil
	default:
		return fmt.Errorf("Unexpected role: %v (%d)", role, int(role))
	}
}

// AddMemberByUsername will add member by UV and role. It checks if
// given UV is valid (that we don't have outdated EldestSeqno), and if
// user has PUK, and if not, it properly handles that by adding
// Keybase-type invite. It also cleans up old invites and memberships.
func (tx *AddMemberTx) AddMemberByUV(ctx context.Context, uv keybase1.UserVersion, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) (err error) {
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

	_, err = tx.addMemberByUPKV2(ctx, current, role, botSettings)
	return err
}

// AddMemberByUsername will add member by username and role. It
// checks if given username can become crypto member or a PUKless
// member. It will also clean up old invites and memberships if
// necessary.
func (tx *AddMemberTx) AddMemberByUsername(ctx context.Context, username string, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) (err error) {
	team := tx.team
	g := team.G()
	m := libkb.NewMetaContext(ctx, g)

	defer m.Trace(fmt.Sprintf("AddMemberTx.AddMemberByUsername(%s,%v) to team %q", username, role, team.Name()), func() error { return err })()

	upak, err := engine.ResolveAndCheck(m, username, true /* useTracking */)
	if err != nil {
		return err
	}
	_, err = tx.addMemberByUPKV2(ctx, upak, role, botSettings)
	return err
}

// preprocessAssertion takes an input assertion and determines if this is a valid Keybase-style assertion.
// If it's an email (or phone) assertion, we assert that it only has one part (and isn't a+b compound).
// If there is only one factor in the assertion, then that's returned. Otherwise, nil.
func preprocessAssertion(m libkb.MetaContext, s string) (isServerTrustInvite bool, single libkb.AssertionURL, err error) {
	a, err := externals.AssertionParseAndOnly(m, s)
	if err != nil {
		return false, nil, err
	}
	urls := a.CollectUrls(nil)
	if len(urls) == 1 {
		single = urls[0]
	}
	for _, u := range urls {
		if u.IsServerTrust() {
			isServerTrustInvite = true
		}
	}
	if isServerTrustInvite && len(urls) > 1 {
		return false, nil, NewMixedServerTrustAssertionError()
	}
	return isServerTrustInvite, single, nil
}

// AddMemberByAssertionOrEmail adds an assertion to the team. It can handle
// three major cases:
//  1. joe OR joe+foo@reddit WHERE joe is already a keybase user, or the assertions map to a unique keybase user
//  2. joe@reddit WHERE joe isn't a keybase user, and this is a social invitations
//  3. [bob@gmail.com]@email WHERE there's an email-based invitation in play
// **Does** attempt to resolve the assertion, to distinguish between case (1), case (2) and an error
// The return values (uv, username) can both be zero-valued if the assertion is not a keybase user.
func (tx *AddMemberTx) AddMemberByAssertionOrEmail(ctx context.Context, assertion string, role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) (
	username libkb.NormalizedUsername, uv keybase1.UserVersion, invite bool, err error) {
	team := tx.team
	g := team.G()
	m := libkb.NewMetaContext(ctx, g)

	defer m.Trace(fmt.Sprintf("AddMemberTx.AddMemberByAssertionOrEmail(%s,%v) to team %q", assertion, role, team.Name()), func() error { return err })()

	isServerTrustInvite, single, err := preprocessAssertion(m, assertion)
	if err != nil {
		return "", uv, false, err
	}

	var doInvite bool
	var upak keybase1.UserPlusKeysV2

	if isServerTrustInvite {
		doInvite = true
	} else {
		upak, err = engine.ResolveAndCheck(m, assertion, true /* useTracking */)
		if err != nil {
			if rErr, ok := err.(libkb.ResolutionError); !ok || (rErr.Kind != libkb.ResolutionErrorNotFound) {
				return "", uv, false, err
			}
			doInvite = true
		}
	}

	if !doInvite {
		username = libkb.NewNormalizedUsername(upak.Username)
		invite, err = tx.addMemberByUPKV2(ctx, upak, role, botSettings)
		m.Debug("Adding keybase member: %s (isInvite=%v)", username, invite)
		return username, uv, invite, err
	}

	if single == nil {
		return "", uv, false, NewCompoundInviteError(assertion)
	}

	typ, name := single.ToKeyValuePair()
	m.Debug("team %s invite sbs member %s/%s", team.Name(), typ, name)
	if role.IsOrAbove(keybase1.TeamRole_OWNER) {
		return "", uv, false, NewAttemptedInviteSocialOwnerError(assertion)
	}
	if err = tx.createInvite(typ, keybase1.TeamInviteName(name), role, "" /* uid */); err != nil {
		return "", uv, false, err
	}
	return "", uv, true, nil
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

	proofs, identifyOutcome, err := getUserProofsNoTracking(ctx, g, username)
	if err != nil {
		return err
	}

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

		g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: Found proof in user's ProofSet: key: %s value: %q", proof.Key, proof.Value)
		proofErr := identifyOutcome.GetRemoteCheckResultFor(ityp, string(invite.Name))
		g.Log.CDebugf(ctx, "CompleteSocialInvitesFor: proof result -> %v", proofErr)
		if proofErr == nil {
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

func (tx *AddMemberTx) ReAddMemberToImplicitTeam(ctx context.Context, uv keybase1.UserVersion, hasPUK bool, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) error {
	if !tx.team.IsImplicit() {
		return fmt.Errorf("ReAddMemberToImplicitTeam only works on implicit teams")
	}
	if err := assertValidNewTeamMemberRole(role); err != nil {
		return err
	}

	if hasPUK {
		if err := tx.addMember(uv, role, botSettings); err != nil {
			return err
		}
		tx.sweepCryptoMembers(ctx, uv.Uid, false)
		if err := tx.completeAllKeybaseInvitesForUID(uv); err != nil {
			return err
		}
	} else {
		if err := tx.createKeybaseInvite(uv, role); err != nil {
			return err
		}
		tx.sweepKeybaseInvites(uv.Uid)
		// We cannot sweep crypto members here because we need to ensure that
		// we are only posting one link, and if we want to add a pukless
		// member, it has to be invite link. Otherwise we would attempt to
		// remove the old member without adding a new one. So old crypto
		// members have to stay for now. However, old crypto member should be
		// swept when Keybase-type invite goes through SBS handler and invited
		// member becomes a real crypto dude.
	}

	if len(tx.payloads) != 1 {
		return errors.New("ReAddMemberToImplicitTeam tried to create more than one link")
	}

	return nil
}

func (tx *AddMemberTx) CancelInvite(id keybase1.TeamInviteID, forUID keybase1.UID) {
	payload := tx.inviteKeybasePayload(forUID)
	if payload.Cancel == nil {
		payload.Cancel = &[]SCTeamInviteID{SCTeamInviteID(id)}
	} else {
		tmp := append(*payload.Cancel, SCTeamInviteID(id))
		payload.Cancel = &tmp
	}
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

	if err := assertValidNewTeamMemberRole(role); err != nil {
		return err
	}

	// Mark that we will be completing inviteID so sweepKeybaseInvites
	// does not cancel it if it happens to be keybase-type.
	tx.completedInvites[invitee.InviteID] = true

	tx.sweepKeybaseInvites(uv.Uid)
	tx.sweepCryptoMembersOlderThan(uv)

	if err := tx.addMemberAndCompleteInvite(uv, role, invitee.InviteID); err != nil {
		return err
	}
	return nil
}

func (tx *AddMemberTx) Post(mctx libkb.MetaContext) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(mctx.Ctx(), "AddMemberTx.Post", func() error { return err })()
	if len(tx.payloads) == 0 {
		return errors.New("there are no signatures to post")
	}

	g.Log.CDebugf(mctx.Ctx(), "AddMemberTx: Attempting to post %d signatures", len(tx.payloads))

	// Initialize key manager.
	if _, err := team.SharedSecret(mctx.Ctx()); err != nil {
		return err
	}

	// Make sure we know recent merkle root.
	if err := team.ForceMerkleRootUpdate(mctx.Ctx()); err != nil {
		return err
	}

	// Get admin permission, we will use the same one for all sigs.
	admin, err := team.getAdminPermission(mctx.Ctx())
	if err != nil {
		return err
	}

	var sections []SCTeamSection
	memSet := newMemberSet()
	var sectionsWithBoxSummaries []int
	var ratchet *hidden.Ratchet

	// Transform payloads to SCTeamSections.
	for i, p := range tx.payloads {
		section := SCTeamSection{
			ID:       SCTeamID(team.ID),
			Admin:    admin,
			Implicit: team.IsImplicit(),
			Public:   team.IsPublic(),
		}

		// Only add a ratchet to the first link in the sequence, it doesn't make sense
		// to add more than one, and it may as well be the first.
		if ratchet == nil {
			ratchet, err = team.makeRatchet(mctx.Ctx())
			if err != nil {
				return err
			}
		}
		section.Ratchets = ratchet.ToTeamSection()

		switch p.Tag {
		case txPayloadTagCryptomembers:
			payload := p.Val.(*keybase1.TeamChangeReq)
			// We need memberSet for this particular payload, but also keep a
			// memberSet for entire transaction to generate boxes afterwards.
			payloadMemberSet, err := newMemberSetChange(mctx.Ctx(), g, *payload)
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

			// If there are additions, then there will be a new key involved.
			// If there are deletions, then we'll be rotating. So either way,
			// this section needs a box summary.
			sectionsWithBoxSummaries = append(sectionsWithBoxSummaries, i)
		case txPayloadTagInviteKeybase, txPayloadTagInviteSocial:
			entropy, err := makeSCTeamEntropy()
			if err != nil {
				return err
			}

			section.Invites = p.Val.(*SCTeamInvites)
			if section.Invites.Len() == 0 {
				return fmt.Errorf("invalid invite, 0 members invited")
			}
			section.Entropy = entropy
			sections = append(sections, section)
		default:
			return fmt.Errorf("Unhandled case in AddMemberTx.Post, unknown tag: %s", p.Tag)
		}
	}

	// If memSet has any downgrades, request downgrade lease.
	var merkleRoot *libkb.MerkleRoot
	var lease *libkb.Lease

	downgrades, err := team.getDowngradedUsers(mctx.Ctx(), memSet)
	if err != nil {
		return err
	}
	if len(downgrades) != 0 {
		lease, merkleRoot, err = libkb.RequestDowngradeLeaseByTeam(mctx.Ctx(), g, team.ID, downgrades)
		if err != nil {
			return err
		}
		// Always cancel lease so we don't leave any hanging.
		defer func() {
			err := libkb.CancelDowngradeLease(mctx.Ctx(), g, lease.LeaseID)
			if err != nil {
				g.Log.CWarningf(mctx.Ctx(), "Failed to cancel downgrade lease: %s", err.Error())
			}
		}()
	}

	var skipKeyRotation bool
	if tx.SkipKeyRotation != nil {
		skipKeyRotation = *tx.SkipKeyRotation
	} else {
		skipKeyRotation = team.CanSkipKeyRotation()
	}
	secretBoxes, implicitAdminBoxes, perTeamKeySection, teamEKPayload, err := team.recipientBoxes(mctx.Ctx(), memSet, skipKeyRotation)
	if err != nil {
		return err
	}

	// For all sections that we previously did add/remove members for, let's
	for _, s := range sectionsWithBoxSummaries {
		err = addSummaryHash(&sections[s], secretBoxes)
		if err != nil {
			return err
		}
	}

	if perTeamKeySection != nil {
		// We have a new per team key, find first TeamChangeReq
		// section that removes users and add it there.
		found := false
		for i, v := range tx.payloads {
			if v.Tag == txPayloadTagCryptomembers {
				req := v.Val.(*keybase1.TeamChangeReq)
				if len(req.None) > 0 {
					sections[i].PerTeamKey = perTeamKeySection
					found = true
					break
				}
			}
		}
		if !found {
			return fmt.Errorf("AddMemberTx.Post got a PerTeamKey but couldn't find a link with None to attach it")
		}
	}

	var teamEKBoxes *[]keybase1.TeamEkBoxMetadata
	if teamEKPayload == nil {
		ekLib := g.GetEKLib()
		if ekLib != nil && len(memSet.recipients) > 0 {
			uids := memSet.recipientUids()
			teamEKBoxes, err = ekLib.BoxLatestTeamEK(mctx, team.ID, uids)
			if err != nil {
				return err
			}
		}
	}

	// Take payloads and team sections and generate chain of signatures.
	nextSeqno := team.NextSeqno()
	latestLinkID := team.chain().GetLatestLinkID()

	var readySigs []libkb.SigMultiItem
	for i, section := range sections {
		var linkType libkb.LinkType
		switch tx.payloads[i].Tag {
		case txPayloadTagCryptomembers:
			linkType = libkb.LinkTypeChangeMembership
		case txPayloadTagInviteKeybase, txPayloadTagInviteSocial:
			linkType = libkb.LinkTypeInvite
		default:
			return fmt.Errorf("Unhandled case in AddMemberTx.Post, unknown tag: %s", tx.payloads[i].Tag)
		}

		sigMultiItem, linkID, err := team.sigTeamItemRaw(mctx.Ctx(), section, linkType,
			nextSeqno, latestLinkID, merkleRoot)
		if err != nil {
			return err
		}

		g.Log.CDebugf(mctx.Ctx(), "AddMemberTx: Prepared signature %d: Type: %v SeqNo: %d Hash: %q",
			i, linkType, nextSeqno, linkID)

		nextSeqno++
		latestLinkID = linkID
		readySigs = append(readySigs, sigMultiItem)
	}

	// Add a single bot_settings link if we are adding any RESTRICTEDBOT members
	if len(memSet.restrictedBotSettings) > 0 {
		section, err := team.botSettingsSection(mctx.Ctx(), memSet.restrictedBotSettings, merkleRoot)
		if err != nil {
			return err
		}
		sigMultiItem, linkID, err := team.sigTeamItemRaw(mctx.Ctx(), section, libkb.LinkTypeTeamBotSettings,
			nextSeqno, latestLinkID, merkleRoot)
		if err != nil {
			return err
		}

		g.Log.CDebugf(mctx.Ctx(), "AddMemberTx: Prepared bot_settings signature: SeqNo: %d Hash: %q",
			nextSeqno, linkID)
		nextSeqno++
		readySigs = append(readySigs, sigMultiItem)
	}

	if err := team.precheckLinksToPost(mctx.Ctx(), readySigs); err != nil {
		g.Log.CDebugf(mctx.Ctx(), "Precheck failed: %v", err)
		return err
	}

	payloadArgs := sigPayloadArgs{
		secretBoxes:         secretBoxes,
		lease:               lease,
		implicitAdminBoxes:  implicitAdminBoxes,
		teamEKPayload:       teamEKPayload,
		teamEKBoxes:         teamEKBoxes,
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}
	payload := team.sigPayload(readySigs, payloadArgs)

	if err := team.postMulti(mctx, payload); err != nil {
		return err
	}

	team.notify(mctx.Ctx(), keybase1.TeamChangeSet{MembershipChanged: true}, nextSeqno-1)

	team.storeTeamEKPayload(mctx.Ctx(), teamEKPayload)
	createTeambotKeys(team.G(), team.ID, memSet.restrictedBotRecipientUids())

	return nil
}
