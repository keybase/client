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

func findReaderDowngrade(points []keybase1.UserLogPoint) *keybase1.SignatureMetadata {
	for _, p := range points {
		if !p.Role.IsReaderOrAbove() {
			return &p.SigMeta
		}
	}
	return nil
}

// AssertWasReaderAt asserts that user (uv) was a reader or above at the team at the given
// SigChainLocation (scl). Thus, we start at the point given, go backwards until we find a promotion,
// the go forwards to make sure there wasn't a demotion before the specified time. If there
// was, we return a PermissionError. If no adminship was found at all, we return a PermissionError.
// NOTE: This is a copy-pasta of AssertWasAdminAt, but I became sad about having to factor out
// the commonality, so decided copy-paste was easiest.
func (t TeamSigChainState) AssertWasReaderAt(uv keybase1.UserVersion, scl keybase1.SigChainLocation) (err error) {
	points := t.inner.UserLog[uv]
	for i := len(points) - 1; i >= 0; i-- {
		point := points[i]
		// OK great, we found an admin point in the log that's less than or equal to the
		// given one
		if point.SigMeta.SigChainLocation.LessThanOrEqualTo(scl) && point.Role.IsReaderOrAbove() {
			// But now we reverse and go forward, and check that it wasn't revoked or downgraded.
			// If so, that's a problem!
			if right := findReaderDowngrade(points[(i + 1):]); right != nil && right.SigChainLocation.LessThanOrEqualTo(scl) {
				return NewPermissionError(t.GetID(), uv, "permission was downgraded too soon!")
			}
			return nil
		}
	}
	return NewPermissionError(t.GetID(), uv, "not found")
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

func (t *TeamSigChainState) informNewInvite(i keybase1.TeamInvite) {
	t.inner.ActiveInvites[i.Id] = i
}

func (t *TeamSigChainState) informCanceledInvite(i keybase1.TeamInviteID) {
	delete(t.inner.ActiveInvites, i)
}

func (t *TeamSigChainState) informCompletedInvite(i keybase1.TeamInviteID) {
	delete(t.inner.ActiveInvites, i)
}

func (t *TeamSigChainState) getLastSubteamPoint(id keybase1.TeamID) *keybase1.SubteamLogPoint {
	if len(t.inner.SubteamLog[id]) > 0 {
		return &t.inner.SubteamLog[id][len(t.inner.SubteamLog[id])-1]
	}
	return nil
}

// Inform the SubteamLog of a subteam name change.
// Links must be added in order by seqno for each subteam (asserted here).
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

type TeamIDAndName struct {
	ID   keybase1.TeamID
	Name keybase1.TeamName
}

// Only call this on a Team that has been loaded with NeedAdmin.
// Otherwise, you might get incoherent answers due to links that
// were stubbed over the life of the cached object.
func (t *TeamSigChainState) ListSubteams() (res []TeamIDAndName) {
	for subteamID, points := range t.inner.SubteamLog {
		if len(points) == 0 {
			// this should never happen
			continue
		}
		lastPoint := points[len(points)-1]
		res = append(res, TeamIDAndName{
			ID:   subteamID,
			Name: lastPoint.Name,
		})
	}
	return res
}

func (t *TeamSigChainState) HasActiveInvite(name, typ string) (bool, error) {
	i, err := t.FindActiveInvite(name, typ)
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); ok {
			return false, nil
		}
		return false, err
	}
	if i != nil {
		return true, nil
	}
	return false, nil
}

func (t *TeamSigChainState) FindActiveInvite(name, typ string) (*keybase1.TeamInvite, error) {
	for _, invite := range t.inner.ActiveInvites {
		styp, err := invite.Type.String()
		if err != nil {
			return nil, err
		}
		if invite.Name == keybase1.TeamInviteName(name) && styp == typ {
			return &invite, nil
		}
	}
	return nil, libkb.NotFoundError{}
}

func (t *TeamSigChainState) FindActiveInviteByID(id keybase1.TeamInviteID) (keybase1.TeamInvite, bool) {
	invite, found := t.inner.ActiveInvites[id]
	return invite, found
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

// Get the latest state.
// The caller may _not_ modify the returned state.
func (t *TeamSigChainPlayer) GetState() (res TeamSigChainState, err error) {
	t.Lock()
	defer t.Unlock()

	if t.storedState != nil {
		return *t.storedState, nil
	}
	return res, fmt.Errorf("no links loaded")
}

// Add a chain link to the end. It can be stubbed.
// It must have already been partially verified by TeamLoader.
// `signer` may be nil iff link is stubbed.
// If this returns an error, the TeamSigChainPlayer was not modified.
func (t *TeamSigChainPlayer) AppendChainLink(ctx context.Context, link *chainLinkUnpacked, signer *keybase1.UserVersion) error {
	t.Lock()
	defer t.Unlock()

	var prevState *TeamSigChainState
	if t.storedState != nil {
		prevState = t.storedState
	}

	newState, err := t.appendChainLinkHelper(ctx, prevState, link, signer)
	if err != nil {
		if prevState == nil {
			return NewAppendLinkError(link, keybase1.Seqno(0), err)
		}
		return NewAppendLinkError(link, prevState.GetLatestSeqno(), err)
	}

	// Accept the new state
	t.storedState = &newState
	return nil
}

// Add a chain link to the end.
// `signer` may be nil iff link is stubbed.
// Does not modify self or any arguments.
// The `prevState` argument is nil if this is the first chain link. `prevState` must not be modified in this function.
func (t *TeamSigChainPlayer) appendChainLinkHelper(
	ctx context.Context, prevState *TeamSigChainState, link *chainLinkUnpacked, signer *keybase1.UserVersion) (
	res TeamSigChainState, err error) {

	err = t.checkOuterLink(ctx, prevState, link)
	if err != nil {
		return res, fmt.Errorf("team sigchain outer link: %s", err)
	}

	var newState *TeamSigChainState
	if link.isStubbed() {
		if prevState == nil {
			return res, NewStubbedErrorWithNote(link, "first link cannot be stubbed")
		}
		newState2 := prevState.DeepCopy()
		newState = &newState2
	} else {
		if signer == nil || !signer.Uid.Exists() {
			return res, NewInvalidLink(link, "signing user not provided for team link")
		}
		iRes, err := t.addInnerLink(prevState, link, *signer, false)
		if err != nil {
			return res, err
		}
		newState = &iRes.newState
	}

	newState.inner.LastSeqno = link.Seqno()
	newState.inner.LastLinkID = link.LinkID().Export()
	newState.inner.LinkIDs[link.Seqno()] = link.LinkID().Export()

	if link.isStubbed() {
		newState.inner.StubbedLinks[link.Seqno()] = true
	}

	return *newState, nil
}

type checkInnerLinkResult struct {
	newState TeamSigChainState
}

func (t *TeamSigChainPlayer) checkOuterLink(ctx context.Context, prevState *TeamSigChainState, link *chainLinkUnpacked) (err error) {
	if prevState == nil {
		if link.Seqno() != 1 {
			return NewUnexpectedSeqnoError(keybase1.Seqno(1), link.Seqno())
		}
	} else {
		if link.Seqno() != prevState.inner.LastSeqno+1 {
			return NewUnexpectedSeqnoError(prevState.inner.LastSeqno+1, link.Seqno())
		}
	}

	if prevState == nil {
		if len(link.Prev()) != 0 {
			return fmt.Errorf("expected outer nil prev but got:%s", link.Prev())
		}
	} else {
		prevStateLastLinkID, err := libkb.ImportLinkID(prevState.inner.LastLinkID)
		if err != nil {
			return fmt.Errorf("invalid prev last link id: %v", err)
		}
		if !link.Prev().Eq(prevStateLastLinkID) {
			return fmt.Errorf("wrong outer prev: %s != %s", link.Prev(), prevState.inner.LastLinkID)
		}
	}

	return nil
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

	if !signer.Uid.Exists() {
		return res, NewInvalidLink(link, "empty link signer")
	}

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
		return res, NewInvalidLink(link, "unrecognized tag: '%s'", payload.Tag)
	}

	if payload.Body.Team == nil {
		return res, NewInvalidLink(link, "missing team section")
	}
	team := payload.Body.Team

	if len(team.ID) == 0 {
		return res, NewInvalidLink(link, "missing team id")
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
	hasInvites := func(has bool) error {
		return hasGeneric(has, team.Invites != nil, "invite")
	}
	hasCompletedInvites := func(has bool) error {
		return hasGeneric(has, len(team.CompletedInvites) != 0, "completed_invites")
	}
	allowInflate := func(allow bool) error {
		if isInflate && !allow {
			return fmt.Errorf("inflating link type not supported: %v", payload.Body.Type)
		}
		return nil
	}

	switch libkb.LinkType(payload.Body.Type) {
	case libkb.LinkTypeTeamRoot:
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(false),
			hasName(true),
			hasMembers(true),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(true),
			hasAdmin(false),
			hasInvites(false),
			hasCompletedInvites(false))
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
	case libkb.LinkTypeChangeMembership:
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(false),
			hasMembers(true),
			hasParent(false),
			hasInvites(false),
			hasSubteam(false),
			hasInvites(false))
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

		t.completeInvites(&res.newState, team.CompletedInvites)

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
	case libkb.LinkTypeRotateKey:
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(true),
			hasInvites(false),
			hasCompletedInvites(false))
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
	case libkb.LinkTypeLeave:
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(false),
			hasInvites(false),
			hasAdmin(false),
			hasInvites(false),
			hasCompletedInvites(false))
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
	case libkb.LinkTypeNewSubteam:
		err = libkb.PickFirstError(
			allowInflate(true),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(true),
			hasPerTeamKey(false),
			hasInvites(false),
			hasCompletedInvites(false))
		if err != nil {
			return res, err
		}

		// Check the subteam ID
		subteamID, err := t.assertIsSubteamID(string(team.Subteam.ID))
		if err != nil {
			return res, err
		}

		// Check the subteam name
		subteamName, err := t.assertSubteamName(prevState, string(team.Subteam.Name))
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()

		// informSubteam will take care of asserting that these links are inflated
		// in order for each subteam.
		err = res.newState.informSubteam(subteamID, subteamName, link.Seqno())
		if err != nil {
			return res, fmt.Errorf("adding new subteam: %v", err)
		}

		return res, nil
	case libkb.LinkTypeSubteamHead:
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(false),
			hasName(true),
			hasMembers(true),
			hasParent(true),
			hasSubteam(false),
			hasPerTeamKey(true),
			hasInvites(false),
			hasCompletedInvites(false))
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

		// Check the initial subteam name
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
	case libkb.LinkTypeRenameSubteam:
		err = libkb.PickFirstError(
			allowInflate(true),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(true),
			hasPerTeamKey(false),
			hasInvites(false),
			hasCompletedInvites(false))
		if err != nil {
			return res, err
		}

		// Check the subteam ID
		subteamID, err := t.assertIsSubteamID(string(team.Subteam.ID))
		if err != nil {
			return res, err
		}

		// Check the subteam name
		subteamName, err := t.assertSubteamName(prevState, string(team.Subteam.Name))
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()

		// informSubteam will take care of asserting that these links are inflated
		// in order for each subteam.
		err = res.newState.informSubteam(subteamID, subteamName, link.Seqno())
		if err != nil {
			return res, fmt.Errorf("adding new subteam: %v", err)
		}

		return res, nil
	case libkb.LinkTypeRenameUpPointer:
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(true),
			hasMembers(false),
			hasParent(true),
			hasSubteam(false),
			hasPerTeamKey(false),
			hasInvites(false),
			hasCompletedInvites(false))
		if err != nil {
			return res, err
		}

		// These links only occur in subteam.
		if !prevState.IsSubteam() {
			return res, fmt.Errorf("got %v in root team", payload.Body.Type)
		}

		// Sanity check that the parent doesn't claim to have changed.
		parentID, err := keybase1.TeamIDFromString(string(team.Parent.ID))
		if err != nil {
			return res, fmt.Errorf("invvalid parent team id: %v", err)
		}
		if !parentID.Eq(*prevState.GetParentID()) {
			return res, fmt.Errorf("wrong parent team ID: %s != %s", parentID, prevState.GetParentID())
		}

		// Ideally we would assert that the name
		// But we may not have an up-to-date picture at this time of the parent's name.
		// So assert this:
		// - The root team name is the same.
		// - The depth of the new name is the same.
		newName, err := keybase1.TeamNameFromString(string(*team.Name))
		if err != nil {
			return res, fmt.Errorf("invalid team name '%s': %v", *team.Name, err)
		}
		if newName.IsRootTeam() {
			return res, fmt.Errorf("cannot rename to root team name: %v", newName.String())
		}
		if !newName.RootAncestorName().Eq(prevState.GetName().RootAncestorName()) {
			return res, fmt.Errorf("rename cannot change root ancestor team name: %v -> %v", prevState.GetName(), newName)
		}
		if newName.Depth() != prevState.GetName().Depth() {
			return res, fmt.Errorf("rename cannot change team nesting depth: %v -> %v", prevState.GetName(), newName)
		}

		res.newState = prevState.DeepCopy()

		res.newState.inner.Name = newName

		return res, nil
	case libkb.LinkTypeInvite:
		err = libkb.PickFirstError(
			allowInflate(false),
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(false),
			hasInvites(true))
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
			return res, fmt.Errorf("link signer does not have permission to invite: %v is a %v", signer, signerRole)
		}

		additions, cancelations, err := t.sanityCheckInvites(*team.Invites)
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()
		t.updateInvites(&res.newState, additions, cancelations)
		return res, nil
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

// sanityCheckInvites sanity checks a raw SCTeamInvites section and coerces it into a
// format that we can use. It checks:
//  - that invite IDs are repeated
//  - that <name,type> pairs aren't reused
//  - that IDs parse into proper keybase1.TeamInviteIDs
//  - that the invite type parses into proper TeamInviteType, or that it's an unknown
//    invite that we're OK to not act upon.
// Returns nicely formatted data structures.
func (t *TeamSigChainPlayer) sanityCheckInvites(invites SCTeamInvites) (additions map[keybase1.TeamRole][]keybase1.TeamInvite, cancelations []keybase1.TeamInviteID, err error) {

	type assignment struct {
		i    SCTeamInvite
		role keybase1.TeamRole
	}
	var all []assignment
	additions = make(map[keybase1.TeamRole][]keybase1.TeamInvite)

	if invites.Admins != nil {
		additions[keybase1.TeamRole_ADMIN] = nil
		for _, i := range *invites.Admins {
			all = append(all, assignment{i, keybase1.TeamRole_ADMIN})
		}
	}

	if invites.Writers != nil {
		additions[keybase1.TeamRole_WRITER] = nil
		for _, i := range *invites.Writers {
			all = append(all, assignment{i, keybase1.TeamRole_WRITER})
		}
	}

	if invites.Readers != nil {
		additions[keybase1.TeamRole_READER] = nil
		for _, i := range *invites.Readers {
			all = append(all, assignment{i, keybase1.TeamRole_READER})
		}
	}

	// Set to `true` if it was an addition and `false` if it was a deletion
	byID := make(map[keybase1.TeamInviteID]bool)
	byName := make(map[string]bool)

	keyFunc := func(i SCTeamInvite) string {
		return fmt.Sprintf("%s:%s", i.Type, i.Name)
	}

	if invites.Cancel != nil {
		for _, c := range *invites.Cancel {
			id, err := c.TeamInviteID()
			if err != nil {
				return nil, nil, err
			}
			if byID[id] {
				return nil, nil, NewInviteError(fmt.Sprintf("ID %s appears twice as a cancelation", c))
			}
			byID[id] = false
			cancelations = append(cancelations, id)
		}
	}

	for _, invite := range all {
		res, err := invite.i.TeamInvite(t.G(), invite.role)
		if err != nil {
			return nil, nil, err
		}
		id := res.Id
		_, seen := byID[id]
		if seen {
			return nil, nil, NewInviteError(fmt.Sprintf("Invite ID %s appears twice in invite set", id))
		}
		key := keyFunc(invite.i)
		if byName[key] {
			return nil, nil, NewInviteError(fmt.Sprintf("Invite %s appears twice in invite set", key))
		}
		byName[key] = true
		byID[id] = true
		additions[res.Role] = append(additions[res.Role], res)
	}

	return additions, cancelations, nil
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

func (t *TeamSigChainPlayer) updateInvites(stateToUpdate *TeamSigChainState, additions map[keybase1.TeamRole][]keybase1.TeamInvite, cancelations []keybase1.TeamInviteID) {
	for _, invites := range additions {
		for _, invite := range invites {
			stateToUpdate.informNewInvite(invite)
		}
	}
	for _, cancelation := range cancelations {
		stateToUpdate.informCanceledInvite(cancelation)
	}
}

func (t *TeamSigChainPlayer) completeInvites(stateToUpdate *TeamSigChainState, completed map[keybase1.TeamInviteID]keybase1.UID) {
	for id := range completed {
		stateToUpdate.informCompletedInvite(id)
	}
}

// Check that the subteam name is valid and kind of is a child of this chain.
// Returns the parsed subteam name.
func (t *TeamSigChainPlayer) assertSubteamName(parent *TeamSigChainState, subteamNameStr string) (keybase1.TeamName, error) {
	// Ideally, we would assert the team name is a direct child of this team's name.
	// But the middle parts of the names might be out of date.
	// Instead assert:
	// - The root team name is same.
	// - The subteam is 1 level deeper.
	// - The last part of the parent team's name matches.
	//   (If the subteam is a.b.c.d then c should be the same.)

	subteamName, err := keybase1.TeamNameFromString(subteamNameStr)
	if err != nil {
		return subteamName, fmt.Errorf("invalid subteam team name '%s': %v", subteamNameStr, err)
	}

	if !parent.GetName().RootAncestorName().Eq(subteamName.RootAncestorName()) {
		return subteamName, fmt.Errorf("subteam is of a different root team: %v != %v",
			subteamName.RootAncestorName().String(),
			parent.GetName().RootAncestorName().String())
	}

	expectedDepth := parent.GetName().Depth() + 1
	if subteamName.Depth() != expectedDepth {
		return subteamName, fmt.Errorf("subteam name has depth %v but expected %v",
			subteamName.Depth(), expectedDepth)
	}

	subteamSecondToLastPart := subteamName.Parts[len(subteamName.Parts)-2]
	parentLastPart := parent.GetName().LastPart()
	if !subteamSecondToLastPart.Eq(parentLastPart) {
		return subteamName, fmt.Errorf("subteam name has wrong name for us: %v != %v",
			subteamSecondToLastPart, parentLastPart)
	}

	return subteamName, nil
}

func (t *TeamSigChainPlayer) assertIsSubteamID(subteamIDStr string) (keybase1.TeamID, error) {
	// Check the subteam ID
	subteamID, err := keybase1.TeamIDFromString(string(subteamIDStr))
	if err != nil {
		return subteamID, fmt.Errorf("invalid subteam id: %v", err)
	}
	if !subteamID.IsSubTeam() {
		return subteamID, fmt.Errorf("malformed subteam id")
	}
	return subteamID, nil
}
