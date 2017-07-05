package teams

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// There are a lot of TODOs in this file. Many of them are critical before team sigchains can be used safely.

// Create a new user/version pair.
func NewUserVersion(uid keybase1.UID, eldestSeqno keybase1.Seqno) keybase1.UserVersion {
	return keybase1.UserVersion{
		Uid:         uid,
		EldestSeqno: eldestSeqno,
	}
}

func ParseUserVersion(s string) (res keybase1.UserVersion, err error) {
	parts := strings.Split(s, "%")
	if len(parts) == 1 {
		// default to seqno 1
		parts = append(parts, "1")
	}
	if len(parts) != 2 {
		return res, fmt.Errorf("invalid user version: %s", s)
	}
	uid, err := libkb.UIDFromHex(parts[0])
	if err != nil {
		return res, err
	}
	eldestSeqno, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return res, fmt.Errorf("invalid eldest seqno: %s", err)
	}
	return keybase1.UserVersion{
		Uid:         uid,
		EldestSeqno: keybase1.Seqno(eldestSeqno),
	}, nil
}

const TeamSigChainPlayerSupportedLinkVersion = 2

// Accessor wrapper for keybase1.TeamSigChainState
type TeamSigChainState struct {
	inner keybase1.TeamSigChainState
}

func (t TeamSigChainState) DeepCopy() TeamSigChainState {
	return TeamSigChainState{
		inner: t.inner.DeepCopy(),
	}
}

func (t TeamSigChainState) GetID() keybase1.TeamID {
	return t.inner.Id
}

func (t TeamSigChainState) GetName() keybase1.TeamName {
	return t.inner.Name
}

func (t TeamSigChainState) IsSubteam() bool {
	return t.inner.ParentID != nil
}

// Only non-nil if this is a subteam.
func (t TeamSigChainState) GetParentID() *keybase1.TeamID {
	return t.inner.ParentID
}

func (t TeamSigChainState) GetLatestSeqno() keybase1.Seqno {
	return t.inner.LastSeqno
}

func (t TeamSigChainState) GetLatestLinkID() keybase1.LinkID {
	return t.inner.LastLinkID
}

func (t TeamSigChainState) GetLatestLibkbLinkID() (libkb.LinkID, error) {
	return libkb.ImportLinkID(t.GetLatestLinkID())
}

func (t TeamSigChainState) GetLinkIDBySeqno(seqno keybase1.Seqno) (keybase1.LinkID, error) {
	l1, ok := t.inner.LinkIDs[seqno]
	if !ok {
		return l1, fmt.Errorf("seqno %v not in chain", seqno)
	}
	return l1, nil
}

func (t TeamSigChainState) GetLibkbLinkIDBySeqno(seqno keybase1.Seqno) (l2 libkb.LinkID, err error) {
	l1, err := t.GetLinkIDBySeqno(seqno)
	if err != nil {
		return l2, err
	}
	return libkb.ImportLinkID(l1)
}

func (t TeamSigChainState) GetLatestGeneration() keybase1.PerTeamKeyGeneration {
	return keybase1.PerTeamKeyGeneration(len(t.inner.PerTeamKeys))
}

func (t TeamSigChainState) GetUserRole(user keybase1.UserVersion) (keybase1.TeamRole, error) {
	return t.getUserRole(user), nil
}

func (t TeamSigChainState) GetUserLogPoint(user keybase1.UserVersion) *keybase1.UserLogPoint {
	points := t.inner.UserLog[user]
	if len(points) == 0 {
		return nil
	}
	tmp := points[len(points)-1].DeepCopy()
	return &tmp
}

func (t TeamSigChainState) GetAdminUserLogPoint(user keybase1.UserVersion) *keybase1.UserLogPoint {
	ret := t.GetUserLogPoint(user)
	if ret == nil {
		return nil
	}
	if ret.Role != keybase1.TeamRole_ADMIN && ret.Role != keybase1.TeamRole_OWNER {
		return nil
	}
	return ret
}

func (t TeamSigChainState) getUserRole(user keybase1.UserVersion) keybase1.TeamRole {
	points := t.inner.UserLog[user]
	if len(points) == 0 {
		return keybase1.TeamRole_NONE
	}
	role := points[len(points)-1].Role
	return role
}

// AssertBecameAdminAt asserts that the user (uv) became admin at the SigChainLocation given.
// Figure out when this admin permission was revoked, if at all. If the promotion event
// wasn't found as specified, then return an AdminPermissionError. In addition, we return
// a bookend object, in the success case, to convey when the adminship was downgraded, if at all.
func (t TeamSigChainState) AssertBecameAdminAt(uv keybase1.UserVersion, scl keybase1.SigChainLocation) (ret proofTermBookends, err error) {
	points := t.inner.UserLog[uv]
	linkMap := t.inner.LinkIDs
	for i := len(points) - 1; i >= 0; i-- {
		point := points[i]
		if point.SigMeta.SigChainLocation.Eq(scl) {
			if !point.Role.IsAdminOrAbove() {
				return ret, NewAdminPermissionError(t.GetID(), uv, "not admin permission")
			}
			ret.left = newProofTerm(t.GetID().AsUserOrTeam(), point.SigMeta, linkMap)
			r := findAdminDowngrade(points[(i + 1):])
			if r != nil {
				tmp := newProofTerm(t.GetID().AsUserOrTeam(), *r, linkMap)
				ret.right = &tmp
			}
			return ret, nil
		}
	}
	return ret, NewAdminPermissionError(t.GetID(), uv, "not found")
}

func findAdminDowngrade(points []keybase1.UserLogPoint) *keybase1.SignatureMetadata {
	for _, p := range points {
		if !p.Role.IsAdminOrAbove() {
			return &p.SigMeta
		}
	}
	return nil
}

// AssertWasAdminAt asserts that user (uv) was an admin (or owner) at the team at the given
// SigChainLocation (scl). Thus, we start at the point given, go backwards until we find a promotion,
// the go forwards to make sure there wasn't a demotion before the specified time. If there
// was, we return an AdminPermissionError. If no adminship was found at all, we return a AdminPermissionError.
func (t TeamSigChainState) AssertWasAdminAt(uv keybase1.UserVersion, scl keybase1.SigChainLocation) (err error) {
	points := t.inner.UserLog[uv]
	for i := len(points) - 1; i >= 0; i-- {
		point := points[i]
		// OK great, we found an admin point in the log that's less than or equal to the
		// given one
		if point.SigMeta.SigChainLocation.LessThanOrEqualTo(scl) && point.Role.IsAdminOrAbove() {
			// But now we reverse and go forward, and check that it wasn't revoked or downgraded.
			// If so, that's a problem!
			if right := findAdminDowngrade(points[(i + 1):]); right != nil && right.SigChainLocation.LessThanOrEqualTo(scl) {
				return NewAdminPermissionError(t.GetID(), uv, "admin permission was downgraded too soon!")
			}
			return nil
		}
	}
	return NewAdminPermissionError(t.GetID(), uv, "not found")
}

func (t TeamSigChainState) GetUsersWithRole(role keybase1.TeamRole) (res []keybase1.UserVersion, err error) {
	if role == keybase1.TeamRole_NONE {
		return nil, errors.New("cannot get users with NONE role")
	}
	for uv := range t.inner.UserLog {
		if t.getUserRole(uv) == role {
			res = append(res, uv)
		}
	}
	return res, nil
}

func (t TeamSigChainState) GetLatestPerTeamKey() (keybase1.PerTeamKey, error) {
	res, ok := t.inner.PerTeamKeys[keybase1.PerTeamKeyGeneration(len(t.inner.PerTeamKeys))]
	if !ok {
		// if this happens it's a programming error
		return res, errors.New("per-team-key not found")
	}
	return res, nil
}

func (t TeamSigChainState) GetPerTeamKeyAtGeneration(gen keybase1.PerTeamKeyGeneration) (keybase1.PerTeamKey, error) {
	res, ok := t.inner.PerTeamKeys[gen]
	if !ok {
		return keybase1.PerTeamKey{}, libkb.NotFoundError{Msg: fmt.Sprintf("per-team-key not found for generation %d", gen)}
	}
	return res, nil
}

func (t TeamSigChainState) HasAnyStubbedLinks() bool {
	for _, v := range t.inner.StubbedLinks {
		if v {
			return true
		}
	}
	return false
}

func (t TeamSigChainState) IsLinkFullyPresent(seqno keybase1.Seqno) bool {
	if seqno > t.inner.LastSeqno {
		return false
	}
	return !t.inner.StubbedLinks[seqno]
}

func (t TeamSigChainState) HasStubbedSeqno(seqno keybase1.Seqno) bool {
	return t.inner.StubbedLinks[seqno]
}

func (t TeamSigChainState) GetSubteamName(id keybase1.TeamID) (*keybase1.TeamName, error) {
	lastPoint := t.getLastSubteamPoint(id)
	if lastPoint != nil {
		return &lastPoint.Name, nil
	}
	return nil, fmt.Errorf("subteam not found: %v", id.String())
}

// Inform the UserLog of a user's role.
// Mutates the UserLog.
// Must be called with seqno's and events in correct order.
// Idempotent if called correctly.
func (t *TeamSigChainState) inform(u keybase1.UserVersion, role keybase1.TeamRole, sigMeta keybase1.SignatureMetadata) {
	currentRole := t.getUserRole(u)
	if currentRole == role {
		// no change in role, now new checkpoint needed
		return
	}
	t.inner.UserLog[u] = append(t.inner.UserLog[u], keybase1.UserLogPoint{
		Role:    role,
		SigMeta: sigMeta,
	})
}

func (t *TeamSigChainState) getLastSubteamPoint(id keybase1.TeamID) *keybase1.SubteamLogPoint {
	if len(t.inner.SubteamLog[id]) > 0 {
		return &t.inner.SubteamLog[id][len(t.inner.SubteamLog[id])-1]
	}
	return nil
}

// Inform the SubteamLog of a subteam name change.
// Links must be added in order by seqno for each subteam.
// Links for different subteams can interleave.
// Mutates the SubteamLog.
func (t *TeamSigChainState) informSubteam(id keybase1.TeamID, name keybase1.TeamName, seqno keybase1.Seqno) error {
	lastPoint := t.getLastSubteamPoint(id)
	if lastPoint != nil && lastPoint.Seqno.Eq(seqno) {
		return fmt.Errorf("re-entry into subteam log for seqno: %v", seqno)
	}
	if lastPoint != nil && seqno < lastPoint.Seqno {
		return fmt.Errorf("cannot add to subteam log out of order: %v < %v", seqno, lastPoint.Seqno)
	}
	err := t.checkSubteamCollision(id, name, seqno)
	if err != nil {
		return err
	}
	t.inner.SubteamLog[id] = append(t.inner.SubteamLog[id], keybase1.SubteamLogPoint{
		Name:  name,
		Seqno: seqno,
	})
	return nil
}

// Check that there is no other subteam with this name at this seqno.
func (t *TeamSigChainState) checkSubteamCollision(id keybase1.TeamID, name keybase1.TeamName, seqno keybase1.Seqno) error {
	for otherID, points := range t.inner.SubteamLog {
		if otherID.Eq(id) {
			continue
		}
		// Get the other team's name at the time of the caller's update.
		var otherName keybase1.TeamName
		for _, point := range points {
			if point.Seqno < seqno {
				otherName = point.Name
			}
		}
		if otherName.Eq(name) {
			return fmt.Errorf("multiple subteams named %v at seqno %v: %v, %v",
				name.String(), seqno, id.String(), otherID.String())
		}
	}
	return nil
}

// Threadsafe handle to a local model of a team sigchain.
type TeamSigChainPlayer struct {
	libkb.Contextified
	sync.Mutex

	// information about the reading user
	reader keybase1.UserVersion

	storedState *TeamSigChainState
}

// Load a team chain from the perspective of uid.
func NewTeamSigChainPlayer(g *libkb.GlobalContext, reader keybase1.UserVersion) *TeamSigChainPlayer {
	return &TeamSigChainPlayer{
		Contextified: libkb.NewContextified(g),
		reader:       reader,
		storedState:  nil,
	}
}

func NewTeamSigChainPlayerWithState(g *libkb.GlobalContext, reader keybase1.UserVersion, state TeamSigChainState) *TeamSigChainPlayer {
	res := NewTeamSigChainPlayer(g, reader)
	res.storedState = &state
	return res
}

func (t *TeamSigChainPlayer) GetState() (res TeamSigChainState, err error) {
	t.Lock()
	defer t.Unlock()

	if t.storedState != nil {
		// The caller shouldn't modify the returned value, but that's really easy to screw up
		// so DeepCopy to defend our internal state.
		return t.storedState.DeepCopy(), nil
	}
	return res, fmt.Errorf("no links loaded")
}

func (t *TeamSigChainPlayer) AddChainLinks(ctx context.Context, links []SCChainLink) error {
	t.Lock()
	defer t.Unlock()

	return t.addChainLinksCommon(ctx, links)
}

// Add links.
// Used to check stubbed links, but that is now the responsibility of loader.
// This interface will change to do single links soon.
// If this returns an error, the TeamSigChainPlayer was not modified.
func (t *TeamSigChainPlayer) addChainLinksCommon(ctx context.Context, links []SCChainLink) error {
	if len(links) == 0 {
		return errors.New("no chainlinks to add")
	}

	var state *TeamSigChainState
	if t.storedState != nil {
		state = t.storedState
	}

	for _, link := range links {
		newState, err := t.addChainLinkCommon(ctx, state, link)
		if err != nil {
			if state == nil {
				return fmt.Errorf("at beginning: %v", err)
			}
			return fmt.Errorf("at seqno %v: %v", state.GetLatestSeqno(), err)
		}
		state = &newState
	}

	// Accept the new state
	t.storedState = state
	return nil
}

// Verify and add a chain link.
// Does not modify self or any arguments.
// The `prevState` argument is nil if this is the first chain link. `prevState` must not be modified in this function.
func (t *TeamSigChainPlayer) addChainLinkCommon(
	ctx context.Context, prevState *TeamSigChainState, link SCChainLink) (
	res TeamSigChainState, err error) {
	oRes, err := t.checkOuterLink(ctx, prevState, link)
	if err != nil {
		return res, fmt.Errorf("team sigchain outer link: %s", err)
	}

	stubbed := oRes.innerLink == nil

	var newState *TeamSigChainState
	if stubbed {
		if prevState == nil {
			return res, errors.New("first link cannot be stubbed")
		}
		newState2 := prevState.DeepCopy()
		newState = &newState2
	} else {
		unLink, err := unpackChainLink(&link)
		if err != nil {
			return res, err
		}
		iRes, err := t.addInnerLink(prevState, unLink, oRes.signingUser, false)
		if err != nil {
			return res, fmt.Errorf("team sigchain inner link: %s", err)
		}
		newState = &iRes.newState
	}

	newState.inner.LastSeqno = oRes.outerLink.Seqno
	newState.inner.LastLinkID = oRes.outerLink.LinkID().Export()
	newState.inner.LinkIDs[oRes.outerLink.Seqno] = oRes.outerLink.LinkID().Export()

	if stubbed {
		newState.inner.StubbedLinks[oRes.outerLink.Seqno] = true
	}

	return *newState, nil
}

type checkOuterLinkResult struct {
	outerLink   libkb.OuterLinkV2WithMetadata
	signingUser keybase1.UserVersion

	// optional inner link info
	innerLink *SCChainLinkPayload
}

type checkInnerLinkResult struct {
	newState TeamSigChainState
}

func (t *TeamSigChainPlayer) checkOuterLink(ctx context.Context, prevState *TeamSigChainState, link SCChainLink) (res checkOuterLinkResult, err error) {
	if prevState == nil {
		if link.Seqno != 1 {
			return res, fmt.Errorf("expected seqno:1 but got:%v", link.Seqno)
		}
	} else {
		if link.Seqno != prevState.inner.LastSeqno+1 {
			return res, fmt.Errorf("expected seqno:%v but got:%v", prevState.inner.LastSeqno+1, link.Seqno)
		}
	}

	if link.Version != TeamSigChainPlayerSupportedLinkVersion {
		return res, fmt.Errorf("expected version:%v but got:%v", TeamSigChainPlayerSupportedLinkVersion, link.Version)
	}

	if len(link.Sig) == 0 {
		return res, errors.New("link has empty sig")
	}
	outerLink, err := libkb.DecodeOuterLinkV2(link.Sig)
	if err != nil {
		return res, err
	}
	res.outerLink = *outerLink

	// TODO CORE-5297 verify the sig. Without this this is all crazy.

	// TODO CORE-5297 verify the signers identity and authorization. Without this this is all crazy.

	// TODO support validating signatures even after account reset.
	//      we need the specified eldest seqno from the server for this.
	// TODO for now just assume seqno=1. Need to do something else to support links made by since-reset users.
	res.signingUser = NewUserVersion(link.UID, 1)

	// check that the outer link matches the server info
	err = outerLink.AssertSomeFields(link.Version, link.Seqno)
	if err != nil {
		return res, err
	}

	if prevState == nil {
		if len(outerLink.Prev) != 0 {
			return res, fmt.Errorf("expected outer nil prev but got:%s", outerLink.Prev)
		}
	} else {
		prevStateLastLinkID, err := libkb.ImportLinkID(prevState.inner.LastLinkID)
		if err != nil {
			return res, fmt.Errorf("invalid prev last link id: %v", err)
		}
		if !outerLink.Prev.Eq(prevStateLastLinkID) {
			return res, fmt.Errorf("wrong outer prev: %s != %s", outerLink.Prev, prevState.inner.LastLinkID)
		}
	}

	if link.Payload == "" {
		// stubbed inner link
		res.innerLink = nil
	} else {
		payload, err := link.UnmarshalPayload()
		if err != nil {
			return res, fmt.Errorf("error unmarshaling link payload: %s", err)
		}
		res.innerLink = &payload
	}

	return res, nil
}

// Check and add the inner link.
// `isInflate` is false if this is a new link and true if it is a link
// which has already been added as stubbed.
// Does not modify `prevState` but returns a new state.
func (t *TeamSigChainPlayer) addInnerLink(
	prevState *TeamSigChainState, link *chainLinkUnpacked, signer keybase1.UserVersion,
	isInflate bool) (
	res checkInnerLinkResult, err error) {

	if link.inner == nil {
		return res, NewStubbedError(link)
	}
	payload := *link.inner

	// TODO: this may be superfluous.
	err = link.AssertInnerOuterMatch()
	if err != nil {
		return res, err
	}

	// completely ignore these fields
	_ = payload.Ctime
	_ = payload.ExpireIn
	_ = payload.SeqType

	if payload.Tag != "signature" {
		return res, fmt.Errorf("unrecognized tag: '%s'", payload.Tag)
	}

	if payload.Body.Team == nil {
		return res, errors.New("missing team section")
	}
	team := payload.Body.Team

	if len(team.ID) == 0 {
		return res, errors.New("missing team id")
	}
	teamID, err := keybase1.TeamIDFromString(string(team.ID))
	if err != nil {
		return res, err
	}

	if prevState != nil && !prevState.inner.Id.Equal(teamID) {
		return res, fmt.Errorf("wrong team id: %s != %s", teamID.String(), prevState.inner.Id.String())
	}

	hasPrevState := func(has bool) error {
		if has {
			if prevState == nil {
				return fmt.Errorf("link type '%s' unexpected at beginning", payload.Body.Type)
			}
		} else {
			if prevState != nil {
				return fmt.Errorf("link type '%s' unexpected at seqno:%v", payload.Body.Type, prevState.inner.LastSeqno+1)
			}
		}
		return nil
	}
	hasGeneric := func(hasExpected bool, hasReal bool, attr string) error {
		if hasExpected != hasReal {
			if hasReal {
				return fmt.Errorf("team section contains unexpected %s", attr)
			}
			return fmt.Errorf("missing %s", attr)
		}
		return nil
	}
	hasName := func(has bool) error {
		return hasGeneric(has, team.Name != nil, "name")
	}
	hasMembers := func(has bool) error {
		return hasGeneric(has, team.Members != nil, "members")
	}
	hasParent := func(has bool) error {
		return hasGeneric(has, team.Parent != nil, "parent")
	}
	hasSubteam := func(has bool) error {
		return hasGeneric(has, team.Subteam != nil, "subteam")
	}
	hasPerTeamKey := func(has bool) error {
		return hasGeneric(has, team.PerTeamKey != nil, "per-team-key")
	}
	hasAdmin := func(has bool) error {
		return hasGeneric(has, team.Admin != nil, "admin")
	}
	allowInflate := func(allow bool) error {
		if isInflate && !allow {
			return fmt.Errorf("inflating link type not supported: %v", payload.Body.Type)
		}
		return nil
	}

	switch payload.Body.Type {
	case "team.root":
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(false),
			hasName(true),
			hasMembers(true),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(true),
			hasAdmin(false))
		if err != nil {
			return res, err
		}

		// Check the team name
		teamName, err := keybase1.TeamNameFromString(string(*team.Name))
		if err != nil {
			return res, err
		}
		if !teamName.IsRootTeam() {
			return res, fmt.Errorf("root team has subteam name: %s", teamName)
		}

		// Check the team ID
		// assert that team_name = hash(team_id)
		// this is only true for root teams
		if !teamID.Equal(teamName.ToTeamID()) {
			return res, fmt.Errorf("team id:%s does not match team name:%s", teamID, teamName)
		}
		if teamID.IsSubTeam() {
			return res, fmt.Errorf("malformed root team id")
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, true, false)
		if err != nil {
			return res, err
		}

		perTeamKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, 1)
		if err != nil {
			return res, err
		}

		perTeamKeys := make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKey)
		perTeamKeys[keybase1.PerTeamKeyGeneration(1)] = perTeamKey

		res.newState = TeamSigChainState{
			inner: keybase1.TeamSigChainState{
				Reader:       t.reader,
				Id:           teamID,
				Name:         teamName,
				LastSeqno:    1,
				LastLinkID:   link.LinkID().Export(),
				ParentID:     nil,
				UserLog:      make(map[keybase1.UserVersion][]keybase1.UserLogPoint),
				SubteamLog:   make(map[keybase1.TeamID][]keybase1.SubteamLogPoint),
				PerTeamKeys:  perTeamKeys,
				LinkIDs:      make(map[keybase1.Seqno]keybase1.LinkID),
				StubbedLinks: make(map[keybase1.Seqno]bool),
			}}

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())

		// check that the signer is an owner
		if res.newState.getUserRole(signer) != keybase1.TeamRole_OWNER {
			return res, fmt.Errorf("signer is not an owner: %v (%v)", signer, team.Members.Owners)
		}

		return res, nil
	case "team.change_membership":
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(false),
			hasMembers(true),
			hasParent(false),
			hasSubteam(false))
		if err != nil {
			return res, err
		}

		// Check that the signer is an admin or owner to have permission to make this link.
		signerRole, err := prevState.GetUserRole(signer)
		if err != nil {
			return res, err
		}
		switch signerRole {
		case keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
			// ok
		default:
			return res, fmt.Errorf("link signer does not have permission to change membership: %v is a %v", signer, signerRole)
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, false, true)
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())

		// Note: If someone was removed, the per-team-key should be rotated. This is not checked though.

		if team.PerTeamKey != nil {
			lastKey, err := prevState.GetLatestPerTeamKey()
			if err != nil {
				return res, fmt.Errorf("getting previous per-team-key: %s", err)
			}
			newKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, lastKey.Gen+keybase1.PerTeamKeyGeneration(1))
			if err != nil {
				return res, err
			}
			res.newState.inner.PerTeamKeys[newKey.Gen] = newKey
		}

		return res, nil
	case "team.rotate_key":
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(true))
		if err != nil {
			return res, err
		}

		// Check that the signer is at least a writer to have permission to make this link.
		signerRole, err := prevState.GetUserRole(signer)
		if err != nil {
			return res, err
		}
		switch signerRole {
		case keybase1.TeamRole_WRITER, keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
			// ok
		default:
			return res, fmt.Errorf("link signer does not have permission to rotate key: %v is a %v", signer, signerRole)
		}

		lastKey, err := prevState.GetLatestPerTeamKey()
		if err != nil {
			return res, fmt.Errorf("getting previous per-team-key: %s", err)
		}
		newKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, lastKey.Gen+keybase1.PerTeamKeyGeneration(1))
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()
		res.newState.inner.PerTeamKeys[newKey.Gen] = newKey

		return res, nil
	case "team.leave":
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(false),
			hasAdmin(false))
		if err != nil {
			return res, err
		}

		// Check that the signer is at least a reader.
		// Implicit admins cannot leave a subteam.
		signerRole, err := prevState.GetUserRole(signer)
		if err != nil {
			return res, err
		}
		switch signerRole {
		case keybase1.TeamRole_READER, keybase1.TeamRole_WRITER, keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
			// ok
		default:
			return res, fmt.Errorf("link signer does not have permission to leave: %v is a %v", signer, signerRole)
		}

		// The last owner of a team should not leave.
		// But that's really up to them and the server. We're just reading what has happened.

		res.newState = prevState.DeepCopy()
		res.newState.inform(signer, keybase1.TeamRole_NONE, payload.SignatureMetadata())

		return res, nil
	case "team.new_subteam":
		err = libkb.PickFirstError(
			allowInflate(true),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(true),
			hasPerTeamKey(false))
		if err != nil {
			return res, err
		}

		// Check the subteam ID
		subteamID, err := keybase1.TeamIDFromString(string(team.Subteam.ID))
		if err != nil {
			return res, fmt.Errorf("invalid subteam id: %v", err)
		}
		if !subteamID.IsSubTeam() {
			return res, fmt.Errorf("malformed subteam id")
		}

		// Check the subteam name
		subteamName, err := keybase1.TeamNameFromString(string(team.Subteam.Name))
		if err != nil {
			return res, fmt.Errorf("invalid subteam team name '%s': %v", team.Subteam.Name, err)
		}
		// Assert the team name is direct child of this team's name.
		// (TODO: this can't work, there's work on this in miles/teamloader-names)
		expectedSubteamName, err := prevState.GetName().Append(string(subteamName.LastPart()))
		if err != nil {
			return res, fmt.Errorf("malformed subteam name: %v", err)
		}
		if !expectedSubteamName.Eq(subteamName) {
			return res, fmt.Errorf("subteam name '%s' does not extend parent name '%s'",
				subteamName, prevState.GetName())
		}

		res.newState = prevState.DeepCopy()

		// informSubteam will take care of asserting that these links are inflated
		// in order for each subteam.
		err = res.newState.informSubteam(subteamID, subteamName, link.Seqno())
		if err != nil {
			return res, fmt.Errorf("adding new subteam: %v", err)
		}

		return res, nil
	case "team.subteam_head":
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(false),
			hasName(true),
			hasMembers(true),
			hasParent(true),
			hasSubteam(false),
			hasPerTeamKey(true))
		if err != nil {
			return res, err
		}

		// Check the subteam ID
		if !teamID.IsSubTeam() {
			return res, fmt.Errorf("malformed subteam id")
		}

		// Check parent ID
		parentID, err := keybase1.TeamIDFromString(string(team.Parent.ID))
		if err != nil {
			return res, fmt.Errorf("invalid parent id: %v", err)
		}

		// Check the subteam name
		teamName, err := keybase1.TeamNameFromString(string(*team.Name))
		if err != nil {
			return res, err
		}
		if teamName.IsRootTeam() {
			return res, fmt.Errorf("subteam has root team name: %s", teamName)
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, false, false)
		if err != nil {
			return res, err
		}

		perTeamKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, 1)
		if err != nil {
			return res, err
		}

		perTeamKeys := make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKey)
		perTeamKeys[keybase1.PerTeamKeyGeneration(1)] = perTeamKey

		res.newState = TeamSigChainState{
			inner: keybase1.TeamSigChainState{
				Reader:       t.reader,
				Id:           teamID,
				Name:         teamName,
				LastSeqno:    1,
				LastLinkID:   link.LinkID().Export(),
				ParentID:     &parentID,
				UserLog:      make(map[keybase1.UserVersion][]keybase1.UserLogPoint),
				SubteamLog:   make(map[keybase1.TeamID][]keybase1.SubteamLogPoint),
				PerTeamKeys:  perTeamKeys,
				LinkIDs:      make(map[keybase1.Seqno]keybase1.LinkID),
				StubbedLinks: make(map[keybase1.Seqno]bool),
			}}

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())

		return res, nil
	case "team.subteam_rename":
		return res, fmt.Errorf("subteam renaming not yet supported: %s", payload.Body.Type)
	case "team.invitation":
		return res, fmt.Errorf("invitations not yet supported: %s", payload.Body.Type)
	case "":
		return res, errors.New("empty body type")
	default:
		return res, fmt.Errorf("unsupported link type: %s", payload.Body.Type)
	}
}

// Add the full inner link for a link that has already been added in stubbed form.
func (t *TeamSigChainPlayer) InflateLink(link *chainLinkUnpacked, signer keybase1.UserVersion) error {
	t.Lock()
	defer t.Unlock()

	state, err := t.inflateLinkHelper(t.storedState, link, signer)
	if err != nil {
		return err
	}

	// Accept the new state
	t.storedState = state
	return nil
}

func (t *TeamSigChainPlayer) inflateLinkHelper(
	prevState *TeamSigChainState, link *chainLinkUnpacked, signer keybase1.UserVersion) (
	*TeamSigChainState, error) {

	if prevState == nil {
		return nil, NewInflateErrorWithNote(link, "cannot inflate link on empty chain")
	}
	if link.isStubbed() {
		return nil, NewStubbedError(link)
	}
	if link.Seqno() > prevState.GetLatestSeqno() {
		return nil, NewInflateErrorWithNote(link,
			fmt.Sprintf("seqno off the chain %v > %v", link.Seqno(), prevState.GetLatestSeqno()))
	}

	// Check the that the link id matches our stubbed.
	seenLinkID, err := prevState.GetLibkbLinkIDBySeqno(link.Seqno())
	if err != nil {
		return nil, err
	}
	if !seenLinkID.Eq(link.LinkID()) {
		return nil, NewInflateErrorWithNote(link,
			fmt.Sprintf("link id mismatch: %v != %v", link.LinkID().String(), seenLinkID.String()))
	}

	// Check that the link has not already been inflated.
	if _, ok := prevState.inner.StubbedLinks[link.Seqno()]; !ok {
		return nil, NewInflateErrorWithNote(link, "already inflated")
	}

	iRes, err := t.addInnerLink(prevState, link, signer, true)
	if err != nil {
		return nil, err
	}

	delete(iRes.newState.inner.StubbedLinks, link.Seqno())

	return &iRes.newState, nil
}

// Check that all the users are formatted correctly.
// Check that there are no duplicate members.
// Do not check that all removals are members. That should be true, but not strictly enforced when reading.
// `requireOwners` is whether owners must exist.
// `allowRemovals` is whether removals are allowed.
// `firstLink` is whether this is seqno=1. In which case owners must exist (for root team). And removals must not exist.
// Rotates to a map which has entries for the roles that actually appeared in the input, even if they are empty lists.
// In other words, if the input has only `admin -> []` then the output will have only `admin` in the map.
func (t *TeamSigChainPlayer) sanityCheckMembers(members SCTeamMembers, requireOwners bool, allowRemovals bool) (map[keybase1.TeamRole][]keybase1.UserVersion, error) {
	type assignment struct {
		m    SCTeamMember
		role keybase1.TeamRole
	}
	var all []assignment

	if requireOwners {
		if members.Owners == nil {
			return nil, fmt.Errorf("team has no owner list: %+v", members)
		}
		if len(*members.Owners) < 1 {
			return nil, fmt.Errorf("team has no owners: %+v", members)
		}
	}
	if !allowRemovals {
		if members.None != nil && len(*members.None) != 0 {
			return nil, fmt.Errorf("team has removals in link: %+v", members)
		}
	}

	// Map from roles to users.
	res := make(map[keybase1.TeamRole][]keybase1.UserVersion)

	if members.Owners != nil {
		res[keybase1.TeamRole_OWNER] = nil
		for _, m := range *members.Owners {
			all = append(all, assignment{m, keybase1.TeamRole_OWNER})
		}
	}
	if members.Admins != nil {
		res[keybase1.TeamRole_ADMIN] = nil
		for _, m := range *members.Admins {
			all = append(all, assignment{m, keybase1.TeamRole_ADMIN})
		}
	}
	if members.Writers != nil {
		res[keybase1.TeamRole_WRITER] = nil
		for _, m := range *members.Writers {
			all = append(all, assignment{m, keybase1.TeamRole_WRITER})
		}
	}
	if members.Readers != nil {
		res[keybase1.TeamRole_READER] = nil
		for _, m := range *members.Readers {
			all = append(all, assignment{m, keybase1.TeamRole_READER})
		}
	}
	if members.None != nil {
		res[keybase1.TeamRole_NONE] = nil
		for _, m := range *members.None {
			all = append(all, assignment{m, keybase1.TeamRole_NONE})
		}
	}

	// Set of users who have already been seen.
	seen := make(map[keybase1.UserVersion]bool)

	for _, pair := range all {
		uv := keybase1.UserVersion(pair.m)

		if seen[uv] {
			return nil, fmt.Errorf("duplicate UID in members: %s", uv.Uid)
		}

		res[pair.role] = append(res[pair.role], uv)

		seen[uv] = true
	}

	return res, nil
}

func (t *TeamSigChainPlayer) checkPerTeamKey(link SCChainLink, perTeamKey SCPerTeamKey, expectedGeneration keybase1.PerTeamKeyGeneration) (res keybase1.PerTeamKey, err error) {
	// check the per-team-key
	if perTeamKey.Generation != expectedGeneration {
		return res, fmt.Errorf("per-team-key generation must start at 1 but got:%d", perTeamKey.Generation)
	}

	// validate signing kid
	sigKey, err := libkb.ImportNaclSigningKeyPairFromHex(perTeamKey.SigKID.String())
	if err != nil {
		return res, fmt.Errorf("invalid per-team-key signing KID: %s", perTeamKey.SigKID)
	}

	// validate encryption kid
	_, err = libkb.ImportNaclDHKeyPairFromHex(perTeamKey.EncKID.String())
	if err != nil {
		return res, fmt.Errorf("invalid per-team-key encryption KID: %s", perTeamKey.EncKID)
	}

	// verify the reverse sig
	// jw is the expected reverse sig contents
	jw, err := jsonw.Unmarshal([]byte(link.Payload))
	if err != nil {
		return res, libkb.NewReverseSigError("per-team-key reverse sig: failed to parse payload: %s", err)
	}
	err = libkb.VerifyReverseSig(t.G(), sigKey, "body.team.per_team_key.reverse_sig", jw, perTeamKey.ReverseSig)
	if err != nil {
		return res, libkb.NewReverseSigError("per-team-key reverse sig: %s", err)
	}

	return keybase1.PerTeamKey{
		Gen:    perTeamKey.Generation,
		Seqno:  link.Seqno,
		SigKID: perTeamKey.SigKID,
		EncKID: perTeamKey.EncKID,
	}, nil
}

// Update `userLog` with the membership in roleUpdates.
// The `NONE` list removes users.
// The other lists add users.
func (t *TeamSigChainPlayer) updateMembership(stateToUpdate *TeamSigChainState, roleUpdates map[keybase1.TeamRole][]keybase1.UserVersion, sigMeta keybase1.SignatureMetadata) {
	for role, uvs := range roleUpdates {
		for _, uv := range uvs {
			stateToUpdate.inform(uv, role, sigMeta)
		}
	}
}
