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

// AddMemberTx helps build a transaction that may contain multiple team
// sigchain links. The caller can use the transaction to add users to a team
// whether they be PUKful or PUKless users, social or server-trust assertions.
//
// Behind the scenes cryptomembers and invites may be removed if they are for
// stale versions of the addees.
//
// Not thread-safe.
type AddMemberTx struct {
	team     *Team
	payloads []txPayload

	// Error state: if a transaction operation failed and tainted the
	// transaction, do not allow posting. We try to never get in a state when
	// we modify a transaction and then realize there's an issue, but if this
	// happens, make sure `Post` can't be called on such tx later.
	err error

	// completedInvites is used to mark completed invites, so they are
	// skipped in sweeping methods.
	completedInvites map[keybase1.TeamInviteID]bool

	// keep track of how many multiple-use invites have been used so far
	usedInviteCount map[keybase1.TeamInviteID]int

	// lastChangeForUID holds index of last tx.payloads payload that
	// affects given uid.
	lastChangeForUID map[keybase1.UID]int

	// Consumer can set the following to affect AddMemberTx operation:

	// Allow adding users who do not have active Per User Key. Users without
	// PUK will be added using a 'team.invite' link with type='keybase'
	// invites.
	//
	// If this setting is 'false' (which is the default), it forces AddMemberTx
	// to never add type='keybase' invites, and only `team.change_membership`
	// is allowed for adding Keybase users as members. Calls to AddMember*
	// functions that with a user that does not have a PUK result in an error.
	AllowPUKless bool

	// Do not return an error when trying to "add a member" who is already
	// member of the team but has a different role.
	//
	// This does not affect team invites (including PUK-less users). For
	// simplicity, their role can't be changed using AddMemberTx right now.
	AllowRoleChanges bool

	// Override whether the team key is rotated.
	SkipKeyRotation *bool

	// EmailInviteMsg is used for sending a welcome message in email invites
	EmailInviteMsg *string
}

// TransactionTaintedError is used for unrecoverable error where we fail to add
// a member and irreversibly break the transaction while doing so.
type TransactionTaintedError struct {
	inner error
}

func (e TransactionTaintedError) Error() string {
	return fmt.Sprintf("Transaction is in error state: %s", e.inner)
}

// UserPUKlessError is returned when an attempt is made to add a PUKless user
// to a transaction that has AllowPUKless=false.
type UserPUKlessError struct {
	username string
	uv       keybase1.UserVersion
}

func (e UserPUKlessError) Error() string {
	var userStr string
	if e.username != "" {
		userStr = fmt.Sprintf("%s (%s)", e.username, e.uv.String())
	} else {
		userStr = e.uv.String()
	}
	return fmt.Sprintf("User %s does not have a PUK, cannot be added to this transaction", userStr)
}

type txPayloadTag int

const (
	txPayloadTagCryptomembers txPayloadTag = iota
	txPayloadTagInviteSocial
	txPayloadTagInviteKeybase
)

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
		usedInviteCount:  make(map[keybase1.TeamInviteID]int),
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
	if err != nil {
		tx.err = TransactionTaintedError{err}
		err = tx.err
	}
	return err
}

func (tx *AddMemberTx) addMemberAndCompleteInvite(uv keybase1.UserVersion,
	role keybase1.TeamRole, inviteID keybase1.TeamInviteID) error {
	// Preconditions: UV is a PUKful user, role is valid and not NONE, invite
	// exists. Role is not RESTRICTEDBOT as botSettings are set to nil.
	payload := tx.changeMembershipPayload(uv.Uid)
	err := payload.AddUVWithRole(uv, role, nil /* botSettings */)
	if err != nil {
		tx.err = TransactionTaintedError{err}
		err = tx.err
	}
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
		tx.err = TransactionTaintedError{fmt.Errorf("invalid role for invite %v", role)}
		return tx.err
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

// addMemberByUPKV2 is an internal method to add user once we have current
// incarnation of UPAK. Public APIs are AddMemberByUV and AddMemberByUsername
// that load UPAK and pass it to this function to continue membership changes.
//
// Return value `invite` is true if user was PUK-less and was added as
// keybase-type invite.
func (tx *AddMemberTx) addMemberByUPKV2(ctx context.Context, user keybase1.UserPlusKeysV2, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) (invite bool, err error) {
	team := tx.team
	g := team.G()

	uv := NewUserVersion(user.Uid, user.EldestSeqno)
	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.addMemberByUPKV2(name:%q uv:%v, %v) to team: %q",
		user.Username, uv, role, team.Name()), &err)()

	if user.Status == keybase1.StatusCode_SCDeleted {
		return false, libkb.UserDeletedError{Msg: fmt.Sprintf("User %q (%s) is deleted", user.Username, uv.Uid)}
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

		if !tx.AllowPUKless {
			return false, UserPUKlessError{username: user.Username, uv: uv}
		}
	}

	normalizedUsername := libkb.NewNormalizedUsername(user.Username)

	currentRole, err := team.MemberRole(ctx, uv)
	if err != nil {
		return false, err
	}

	if currentRole != keybase1.TeamRole_NONE {
		if !hasPUK {
			return false, fmt.Errorf("user %s (uv %s) is already a member of %s, yet they don't have a PUK",
				normalizedUsername, uv, team.Name())
		}
		if tx.AllowRoleChanges {
			if currentRole == role {
				// No-op team.change_membership links that don't change
				// member's role are legal, but we are trying to avoid
				// them. Caller can catch this error and move onwards,
				// it doesn't taint the transaction.
				return false, libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a member of team %s with role %s",
					normalizedUsername, team.Name(), role.HumanString())}
			}
		} else {
			return false, libkb.ExistsError{Msg: fmt.Sprintf("user %s is already a member of team %s",
				normalizedUsername, team.Name())}
		}
	}

	if existingUV, err := team.UserVersionByUID(ctx, uv.Uid); err == nil {
		// There is an edge case where user is in the middle of resetting
		// (after reset, before provisioning) and has EldestSeqno=0.
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

	if !hasPUK {
		// An admin is only allowed to remove an owner UV when, in the same
		// link, replacing them with a 'newer' UV with a greater eldest seqno.
		// So, if we're an admin re-adding an owner who does not yet have a PUK
		// then don't try to remove the owner's pre-reset UV. Note that the old
		// owner UV will still be removed in the transaction during SBS
		// resolution when they get a PUK later.
		tx.sweepCryptoMembers(ctx, uv.Uid, true /* exceptAdminsRemovingOwners */)
	} else {
		// This might be a role change, only sweep UVs with EldestSeqno older
		// than one currently being added, so it doesn't sweep the same UV we
		// are currently adding.
		tx.sweepCryptoMembersOlderThan(uv)
	}

	if !hasPUK {
		if err = tx.createKeybaseInvite(uv, role); err != nil {
			return false, err
		}
		return true /* invite */, nil
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
	for _, inviteMD := range team.chain().ActiveInvites() {
		invite := inviteMD.Invite
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

// AddMemberByUV will add member by UV and role. It checks if given UV is valid
// (that we don't have outdated EldestSeqno), and if user has PUK, and if not,
// it properly handles that by adding Keybase-type invite. It also cleans up
// old invites and memberships.
func (tx *AddMemberTx) AddMemberByUV(ctx context.Context, uv keybase1.UserVersion, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.AddMemberByUV(%v,%v) to team %q", uv, role, team.Name()), &err)()
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

// AddMemberByUsername will add member by username and role. It checks if given
// username can become crypto member or a PUKless member. It will also clean up
// old invites and memberships if necessary.
func (tx *AddMemberTx) AddMemberByUsername(ctx context.Context, username string, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) (err error) {
	team := tx.team
	mctx := team.MetaContext(ctx)

	defer mctx.Trace(fmt.Sprintf("AddMemberTx.AddMemberByUsername(%s,%v) to team %q", username, role, team.Name()), &err)()

	upak, err := engine.ResolveAndCheck(mctx, username, true /* useTracking */)
	if err != nil {
		return err
	}
	_, err = tx.addMemberByUPKV2(ctx, upak, role, botSettings)
	return err
}

// preprocessAssertion takes an input assertion and determines if this is a
// valid Keybase-style assertion. If it's an email (or phone) assertion, we
// assert that it only has one part (and isn't a+b compound). If there is only
// one factor in the assertion, then that's returned as single. Otherwise,
// single is nil.
func preprocessAssertion(mctx libkb.MetaContext, assertionStr string) (isServerTrustInvite bool, single libkb.AssertionURL, full libkb.AssertionExpression, err error) {
	assertion, err := externals.AssertionParseAndOnly(mctx, assertionStr)
	if err != nil {
		return false, nil, nil, err
	}
	urls := assertion.CollectUrls(nil)
	if len(urls) == 1 {
		single = urls[0]
	}
	for _, u := range urls {
		if u.IsServerTrust() {
			isServerTrustInvite = true
		}
	}
	if isServerTrustInvite && len(urls) > 1 {
		return false, nil, nil, NewMixedServerTrustAssertionError()
	}
	return isServerTrustInvite, single, assertion, nil
}

// resolveServerTrustAssertion resolves server-trust assertion. The possible
// outcomes are:
// 1) assertion resolves to a user: userFound=true, non-empty upak.
// 2) assertion did not resolve to a user: userFound=false, empty upak.
// 3) we got a server error when resolving, abort.
func resolveServerTrustAssertion(mctx libkb.MetaContext, assertion string) (upak keybase1.UserPlusKeysV2, userFound bool, err error) {
	user, resolveRes, err := mctx.G().Resolver.ResolveUser(mctx, assertion)
	if err != nil {
		if shouldPreventTeamCreation(err) {
			// Resolution failed because of server error, do not try to invite
			// because it might be a resolvable assertion. We don't know if
			// that assertion resolves to a user. Should abort anything we are
			// trying to do.
			return upak, false, err
		}
		// Assertion did not resolve, but we didn't get error preventing us
		// from inviting either. Invite assertion to the team.
		return upak, false, nil
	}

	if !resolveRes.IsServerTrust() {
		return upak, false, fmt.Errorf("Unexpected non server-trust resolution returned: %q", assertion)
	}
	upak, err = engine.ResolveAndCheck(mctx, user.Username, true /* useTracking */)
	if err != nil {
		return upak, false, err
	}
	// Success - assertion server-trust resolves to upak, we can just add them
	// as a member.
	return upak, true, nil
}

// AddMemberCandidate is created by ResolveUPKV2FromAssertion and should be
// passed to AddOrInviteMemberCandidate.
type AddMemberCandidate struct {
	SourceAssertion string

	// Assertion parsing results:
	Full   libkb.AssertionExpression // always set
	Single libkb.AssertionURL        // not nil if assertion was a single (not compound)

	// If resolved to a Keybase user, KeybaseUser is non-nil.
	KeybaseUser *keybase1.UserPlusKeysV2

	// Resolved user might be PUKless, so adding them might still result in an
	// invite (type=keybase). If KeybaseUser is nil, adding that candidate
	// shall result in social invite for Single assertion, provided by source
	// assertion was not compound. If it was, that person can't be added.
}

func (a AddMemberCandidate) DebugString() string {
	if a.KeybaseUser != nil {
		return fmt.Sprintf("User=%q, IsSingle=%t", a.KeybaseUser.Username, a.Single != nil)
	}
	return fmt.Sprintf("User=nil, IsSingle=%t", a.Single != nil)
}

// ResolveUPKV2FromAssertion creates an AddMemberCandidate struct by parsing
// and attempting to resolve an assertion. This result can be then passed to
// AddOrInviteMemberCandidate to queue adding that person in the transaction.
// ResolveUPKV2FromAssertion itself does not modify the transaction.
//
// If your use case is:
//   - you have an assertion,
//   - that should be resolved,
//   - and based on the resolution it should either add it to the transaction or
//     not,
//
// this is the way to go.
//
// See documentation of AddOrInviteMemberByAssertion to find out what assertion
// types are supported.
//
// AddOrInviteMemberByAssertion does the same thing internally, but you don't
// get to check resolution result until after transaction is modified.
func (tx *AddMemberTx) ResolveUPKV2FromAssertion(m libkb.MetaContext, assertion string) (ret AddMemberCandidate, err error) {
	isServerTrustInvite, single, full, err := preprocessAssertion(m, assertion)
	if err != nil {
		return ret, err
	}

	ret.SourceAssertion = assertion
	ret.Full = full
	ret.Single = single

	if isServerTrustInvite {
		// Server-trust assertions (`phone`/`email`): ask server if it resolves
		// to a user.
		upak, userFound, err := resolveServerTrustAssertion(m, assertion)
		if err != nil {
			return ret, err
		}
		if userFound {
			ret.KeybaseUser = &upak
		}
	} else {
		// Normal assertion: resolve and verify.
		upak, err := engine.ResolveAndCheck(m, assertion, true /* useTracking */)
		if err != nil {
			if rErr, ok := err.(libkb.ResolutionError); !ok || (rErr.Kind != libkb.ResolutionErrorNotFound) {
				return ret, err
			}
			// Resolution not found - fall through with nil KeybaseUser.
		} else {
			ret.KeybaseUser = &upak
		}
	}

	return ret, nil
}

// AddOrInviteMemberCandidate adds a member using AddMemberCandidate struct
// that can be obtained by calling ResolveUPKV2FromAssertion with assertion
// string.
func (tx *AddMemberTx) AddOrInviteMemberCandidate(ctx context.Context, candidate AddMemberCandidate, role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) (
	username libkb.NormalizedUsername, uv keybase1.UserVersion, invite bool, err error) {
	team := tx.team
	mctx := team.MetaContext(ctx)

	defer mctx.Trace(fmt.Sprintf("AddMemberTx.AddOrInviteMemberCandidate(%q,keybaseUser=%t,%v) to team %q",
		candidate.SourceAssertion, candidate.KeybaseUser != nil, role, team.Name()), &err)()

	if candidate.KeybaseUser != nil {
		// We have a user and can add them to a team, no invite required.
		username = libkb.NewNormalizedUsername(candidate.KeybaseUser.Username)
		uv = candidate.KeybaseUser.ToUserVersion()
		invite, err = tx.addMemberByUPKV2(ctx, *candidate.KeybaseUser, role, botSettings)
		mctx.Debug("Adding Keybase user: %s (isInvite=%v)", username, invite)
		return username, uv, invite, err
	}

	// We are on invite path here.

	if candidate.Single == nil {
		// Compound assertions are invalid at this point.
		return "", uv, false, NewCompoundInviteError(candidate.SourceAssertion)
	}

	typ, name := candidate.Single.ToKeyValuePair()
	mctx.Debug("team %s invite sbs member %s/%s", team.Name(), typ, name)

	// Sanity checks:
	// Can't do SBS invite with role=OWNER.
	if role.IsOrAbove(keybase1.TeamRole_OWNER) {
		return "", uv, false, NewAttemptedInviteSocialOwnerError(candidate.SourceAssertion)
	}
	inviteName := keybase1.TeamInviteName(name)
	// Can't invite if invite for same SBS assertion already exists in that
	// team.
	existing, err := tx.team.HasActiveInvite(mctx, inviteName, typ)
	if err != nil {
		return "", uv, false, err
	}
	if existing {
		return "", uv, false, libkb.ExistsError{
			Msg: fmt.Sprintf("Invite for %q already exists", candidate.Single.String()),
		}
	}

	// All good - add invite to tx.
	if err = tx.createInvite(typ, inviteName, role, "" /* uid */); err != nil {
		return "", uv, false, err
	}
	return "", uv, true, nil

}

// AddOrInviteMemberByAssertion adds an assertion to the team. It can
// handle three major cases:
//
//  1. joe OR joe+foo@reddit WHERE joe is already a keybase user, or the
//     assertions map to a unique Keybase user
//  2. joe@reddit WHERE joe isn't a keybase user, and this is a social
//     invitations
//  3. [bob@gmail.com]@email WHERE server-trust resolution is performed and
//     either TOFU invite is created or resolved member is added. Same works
//     with `@phone`.
//
// **Does** attempt to resolve the assertion, to distinguish between case (1),
// case (2) and an error The return values (uv, username) can both be
// zero-valued if the assertion is not a Keybase user.
func (tx *AddMemberTx) AddOrInviteMemberByAssertion(ctx context.Context, assertion string, role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) (
	username libkb.NormalizedUsername, uv keybase1.UserVersion, invite bool, err error) {
	team := tx.team
	m := team.MetaContext(ctx)

	defer m.Trace(fmt.Sprintf("AddMemberTx.AddOrInviteMemberByAssertion(%s,%v) to team %q", assertion, role, team.Name()), &err)()

	candidate, err := tx.ResolveUPKV2FromAssertion(m, assertion)
	if err != nil {
		return "", uv, false, err
	}
	return tx.AddOrInviteMemberCandidate(ctx, candidate, role, botSettings)
}

// CanConsumeInvite checks if invite can be used. Has to be called before
// calling `ConsumeInviteByID` with that invite ID. Does not modify the
// transaction. When handling team invites, it should be called before
// `ConsumeInviteByID` to assert that invite is still usable (new-style invites
// may be expired or exceeded).
func (tx *AddMemberTx) CanConsumeInvite(ctx context.Context, inviteID keybase1.TeamInviteID) error {
	inviteMD, found := tx.team.chain().FindActiveInviteMDByID(inviteID)
	if !found {
		return fmt.Errorf("failed to find invite being used")
	}
	invite := inviteMD.Invite

	isNewStyle, err := IsNewStyleInvite(invite)
	if err != nil {
		return err
	}

	if isNewStyle {
		// Only need to check new-style invites. Old-style invites cannot have
		// expiration date and can always be one-time use, and wouldn't show up
		// in `FindActiveInviteByID` (because they are not active). New-style
		// invites always stay active.
		alreadyUsedBeforeTransaction := len(inviteMD.UsedInvites)
		alreadyUsed := alreadyUsedBeforeTransaction + tx.usedInviteCount[inviteID]
		if invite.IsUsedUp(alreadyUsed) {
			return NewInviteLinkAcceptanceError("invite has no more uses left; so cannot add by this invite")
		}

		now := tx.team.G().Clock().Now()
		if invite.IsExpired(now) {
			return NewInviteLinkAcceptanceError("invite expired at %v which is before the current time of %v; rejecting", invite.Etime, now)
		}
	} else {
		_, alreadyCompleted := tx.completedInvites[inviteID]
		if alreadyCompleted {
			return fmt.Errorf("invite ID %s was already completed in this transaction", inviteID)
		}
	}

	return nil
}

// ConsumeInviteByID finds a change membership payload and either sets
// "completed invite" or adds am "used invite". `CanConsumeInvite` has to be
// called before this function.
func (tx *AddMemberTx) ConsumeInviteByID(ctx context.Context, inviteID keybase1.TeamInviteID, uv keybase1.UserVersion) error {
	payload := tx.findChangeReqForUV(uv)
	if payload == nil {
		return fmt.Errorf("could not find uv %v in transaction", uv)
	}

	inviteMD, found := tx.team.chain().FindActiveInviteMDByID(inviteID)
	if !found {
		return fmt.Errorf("failed to find invite being used")
	}
	invite := inviteMD.Invite

	isNewStyle, err := IsNewStyleInvite(invite)
	if err != nil {
		return err
	}

	if isNewStyle {
		payload.UseInviteID(inviteID, uv.PercentForm())
		tx.usedInviteCount[inviteID]++
	} else {
		payload.CompleteInviteID(inviteID, uv.PercentForm())
		tx.completedInvites[inviteID] = true
	}

	return nil
}

// CompleteSocialInvitesFor finds all proofs for `uv` and tries to match them
// with active social invites in the team. Any invite that matches the proofs
// and can therefore be "completed" by adding `uv` to the team is marked as
// completed.
//
// The purpose of this function is to complete social invites when user is
// being added outside of SBS handling. There are two cases in which this
// function completes an invite:
//
//  1. An admin is racing SBS handler by adding a user after they add a proof but
//     before server sends out SBS notifications.
//  2. There was more than one social invite that resolved to the same user
//  3. ...or other cases (or bugs) when there are outstanding invites that
//     resolve to a user but they were not added through SBS handler.
//
// Note that (2) is likely still not handled correctly if there are social
// invites that someone who is already in the team adds proofs for.
func (tx *AddMemberTx) CompleteSocialInvitesFor(ctx context.Context, uv keybase1.UserVersion, username string) (err error) {
	team := tx.team
	g := team.G()

	defer g.CTrace(ctx, fmt.Sprintf("AddMemberTx.CompleteSocialInvitesFor(%v,%s)", uv, username), &err)()
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

	for _, inviteMD := range team.chain().ActiveInvites() {
		invite := inviteMD.Invite
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
		if !tx.AllowPUKless {
			return UserPUKlessError{uv: uv}
		}
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

// AddMemberBySBS is very similar in what it does to addMemberByUPKV2
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
		invitee, team.Name()), &err)()

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

	defer g.CTrace(mctx.Ctx(), "AddMemberTx.Post", &err)()

	if tx.err != nil {
		// AddMemberTx operation has irreversibly failed, potentially leaving
		// tx in bad state. Do not post.
		return tx.err
	}

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
			section.UsedInvites = makeSCMapInviteIDUVMap(payload.UsedInvites)

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

			if !tx.AllowPUKless && p.Tag == txPayloadTagInviteKeybase && section.Invites.HasNewInvites() {
				// This means we broke contract somewhere or that tx.AllowPUKless
				// was changed to false after adding PUKless user. Better fail here
				// instead of doing unexpected.
				return fmt.Errorf("Found payload with new Keybase invites but AllowPUKless is false")
			}
		default:
			return fmt.Errorf("Unhandled case in AddMemberTx.Post, unknown tag: %v", p.Tag)
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
			return fmt.Errorf("Unhandled case in AddMemberTx.Post, unknown tag: %v", tx.payloads[i].Tag)
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
		var section SCTeamSection
		section, ratchet, err = team.botSettingsSection(mctx.Ctx(), memSet.restrictedBotSettings, ratchet, merkleRoot)
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
	if tx.EmailInviteMsg != nil {
		payload["email_invite_msg"] = *tx.EmailInviteMsg
	}

	if err := team.postMulti(mctx, payload); err != nil {
		return err
	}

	// nextSeqno-1 should be the sequence number of last link that we sent.
	err = team.notify(mctx.Ctx(), keybase1.TeamChangeSet{MembershipChanged: true}, nextSeqno-1)
	if err != nil {
		mctx.Warning("Failed to send team change notification: %s", err)
	}

	team.storeTeamEKPayload(mctx.Ctx(), teamEKPayload)
	createTeambotKeys(team.G(), team.ID, memSet.restrictedBotRecipientUids())

	return nil
}
