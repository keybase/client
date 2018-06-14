package teams

import (
	"errors"
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// Create a new user/version pair.
func NewUserVersion(uid keybase1.UID, eldestSeqno keybase1.Seqno) keybase1.UserVersion {
	return keybase1.NewUserVersion(uid, eldestSeqno)
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

func (t TeamSigChainState) IsSubteam() bool {
	return t.inner.ParentID != nil
}

func (t TeamSigChainState) IsImplicit() bool {
	return t.inner.Implicit
}

func (t TeamSigChainState) IsPublic() bool {
	return t.inner.Public
}

func (t TeamSigChainState) IsOpen() bool {
	return t.inner.Open
}

func (t TeamSigChainState) LatestLastNamePart() keybase1.TeamNamePart {
	return t.inner.NameLog[len(t.inner.NameLog)-1].LastPart
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

func (t TeamSigChainState) GetLatestKBFSGeneration(appType keybase1.TeamApplication) (int, error) {
	info, ok := t.inner.TlfLegacyUpgrade[appType]
	if !ok {
		return 0, errors.New("no KBFS keys available")
	}
	return info.LegacyGeneration, nil
}

func (t TeamSigChainState) GetUserRole(user keybase1.UserVersion) (keybase1.TeamRole, error) {
	return t.getUserRole(user), nil
}

// Get the user's role right after link at seqno was processed.
func (t TeamSigChainState) GetUserRoleAtSeqno(user keybase1.UserVersion, seqno keybase1.Seqno) (keybase1.TeamRole, error) {
	role := keybase1.TeamRole_NONE
	if seqno <= 0 {
		return role, fmt.Errorf("seqno %v is less than 1", seqno)
	}
	for _, point := range t.inner.UserLog[user] {
		if point.SigMeta.SigChainLocation.Seqno > seqno {
			return role, nil
		}
		role = point.Role
	}
	return role, nil
}

func (t TeamSigChainState) GetUserLogPoint(user keybase1.UserVersion) *keybase1.UserLogPoint {
	points := t.inner.UserLog[user]
	if len(points) == 0 {
		return nil
	}
	tmp := points[len(points)-1].DeepCopy()
	return &tmp
}

// GetLastUserLogPointWithPredicate gets the last user logpoint in the series for which the given
// predicate is true.
func (t TeamSigChainState) GetLastUserLogPointWithPredicate(user keybase1.UserVersion, f func(keybase1.UserLogPoint) bool) *keybase1.UserLogPoint {
	points := t.inner.UserLog[user]
	if len(points) == 0 {
		return nil
	}
	for i := len(points) - 1; i >= 0; i-- {
		if f(points[i]) {
			tmp := points[i].DeepCopy()
			return &tmp
		}
	}
	return nil
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

// assertBecameAdminAt asserts that the user (uv) became admin at the SigChainLocation given.
// Figure out when this admin permission was revoked, if at all. If the promotion event
// wasn't found as specified, then return an AdminPermissionError. In addition, we return
// a bookend object, in the success case, to convey when the adminship was downgraded, if at all.
func (t TeamSigChainState) assertBecameAdminAt(uv keybase1.UserVersion, scl keybase1.SigChainLocation) (ret proofTermBookends, err error) {
	points := t.inner.UserLog[uv]
	linkMap := t.inner.LinkIDs
	for i := len(points) - 1; i >= 0; i-- {
		point := points[i]
		if point.SigMeta.SigChainLocation.Eq(scl) {
			if !point.Role.IsAdminOrAbove() {
				return ret, NewAdminPermissionError(t.GetID(), uv, "not admin permission")
			}
			ret.left = newProofTerm(t.GetID().AsUserOrTeam(), point.SigMeta, linkMap)
			r := findRoleDowngrade(points[(i+1):], keybase1.TeamRole_ADMIN)
			if r != nil {
				tmp := newProofTerm(t.GetID().AsUserOrTeam(), *r, linkMap)
				ret.right = &tmp
			}
			return ret, nil
		}
	}
	return ret, NewAdminPermissionError(t.GetID(), uv, "not found")
}

// Find a point where the role is taken away.
func findRoleDowngrade(points []keybase1.UserLogPoint, role keybase1.TeamRole) *keybase1.SignatureMetadata {
	for _, p := range points {
		if !p.Role.IsOrAbove(role) {
			return &p.SigMeta
		}
	}
	return nil
}

// AssertWasRoleOrAboveAt asserts that user `uv` had `role` or above on the
// team just after the given SigChainLocation `scl`.
// We start at the point given, go backwards until we find a promotion,
// then go forwards to make sure there wasn't a demotion before the specified time.
// If there was, return a PermissionError. If no adminship was found at all, return a PermissionError.
func (t TeamSigChainState) AssertWasRoleOrAboveAt(uv keybase1.UserVersion,
	role keybase1.TeamRole, scl keybase1.SigChainLocation) (err error) {
	mkErr := func(format string, args ...interface{}) error {
		msg := fmt.Sprintf(format, args...)
		if role.IsOrAbove(keybase1.TeamRole_ADMIN) {
			return NewAdminPermissionError(t.GetID(), uv, msg)
		}
		return NewPermissionError(t.GetID(), uv, msg)
	}
	if scl.Seqno < keybase1.Seqno(0) {
		return mkErr("negative seqno: %v", scl.Seqno)
	}
	points := t.inner.UserLog[uv]
	for i := len(points) - 1; i >= 0; i-- {
		point := points[i]
		if err := point.SigMeta.SigChainLocation.Comparable(scl); err != nil {
			return mkErr(err.Error())
		}
		if point.SigMeta.SigChainLocation.LessThanOrEqualTo(scl) && point.Role.IsOrAbove(role) {
			// OK great, we found a point with the role in the log that's less than or equal to the given one.
			// But now we reverse and go forward, and check that it wasn't revoked or downgraded.
			// If so, that's a problem!
			if right := findRoleDowngrade(points[(i+1):], role); right != nil && right.SigChainLocation.LessThanOrEqualTo(scl) {
				return mkErr("%v permission was downgraded too soon!", role)
			}
			return nil
		}
	}
	return mkErr("%v role point not found", role)
}

func (t TeamSigChainState) AssertWasReaderAt(uv keybase1.UserVersion, scl keybase1.SigChainLocation) (err error) {
	return t.AssertWasRoleOrAboveAt(uv, keybase1.TeamRole_READER, scl)
}

func (t TeamSigChainState) AssertWasWriterAt(uv keybase1.UserVersion, scl keybase1.SigChainLocation) (err error) {
	return t.AssertWasRoleOrAboveAt(uv, keybase1.TeamRole_WRITER, scl)
}

func (t TeamSigChainState) AssertWasAdminAt(uv keybase1.UserVersion, scl keybase1.SigChainLocation) (err error) {
	return t.AssertWasRoleOrAboveAt(uv, keybase1.TeamRole_ADMIN, scl)
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

func (t TeamSigChainState) GetUsersWithRoleOrAbove(role keybase1.TeamRole) (res []keybase1.UserVersion, err error) {
	if role == keybase1.TeamRole_NONE {
		return nil, errors.New("cannot get users with NONE role")
	}
	for uv := range t.inner.UserLog {
		if t.getUserRole(uv).IsOrAbove(role) {
			res = append(res, uv)
		}
	}
	return res, nil
}

func (t TeamSigChainState) GetLatestUVWithUID(uid keybase1.UID) (res keybase1.UserVersion, err error) {
	found := false
	for uv := range t.inner.UserLog {
		if uv.Uid == uid && t.getUserRole(uv) != keybase1.TeamRole_NONE && (!found || res.EldestSeqno < uv.EldestSeqno) {
			res = uv
			found = true
		}
	}

	if !found {
		return keybase1.UserVersion{}, errors.New("did not find user with given uid")
	}
	return res.DeepCopy(), nil
}

func (t TeamSigChainState) GetAllUVsWithUID(uid keybase1.UID) (res []keybase1.UserVersion) {
	for uv := range t.inner.UserLog {
		if uv.Uid == uid && t.getUserRole(uv) != keybase1.TeamRole_NONE {
			res = append(res, uv)
		}
	}
	return res
}

func (t TeamSigChainState) GetLatestPerTeamKey() (keybase1.PerTeamKey, error) {
	res, ok := t.inner.PerTeamKeys[keybase1.PerTeamKeyGeneration(len(t.inner.PerTeamKeys))]
	if !ok {
		// if this happens it's a programming error
		return res, errors.New("per-team-key not found")
	}
	return res, nil
}

func (t *TeamSigChainState) GetLatestPerTeamKeyCTime() keybase1.UnixTime {
	return t.inner.PerTeamKeyCTime
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

// Whether the link has been processed and is not stubbed.
func (t TeamSigChainState) IsLinkFilled(seqno keybase1.Seqno) bool {
	if seqno > t.inner.LastSeqno {
		return false
	}
	if seqno < 0 {
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
	delete(t.inner.ObsoleteInvites, i)
}

func (t *TeamSigChainState) informCompletedInvite(i keybase1.TeamInviteID) {
	delete(t.inner.ActiveInvites, i)
	delete(t.inner.ObsoleteInvites, i)
}

func (t *TeamSigChainState) findAndObsoleteInviteForUser(uid keybase1.UID) {
	for id, invite := range t.inner.ActiveInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid == uid {
				delete(t.inner.ActiveInvites, id)
				t.inner.ObsoleteInvites[id] = invite
			}
		}
	}
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
// Name collisions are allowed here. They are allowed because you might
// be removed a subteam and then its future name changes and deletion would be stubbed.
// See ListSubteams for details.
func (t *TeamSigChainState) informSubteam(id keybase1.TeamID, name keybase1.TeamName, seqno keybase1.Seqno) error {
	lastPoint := t.getLastSubteamPoint(id)
	if lastPoint != nil && lastPoint.Seqno.Eq(seqno) {
		return fmt.Errorf("re-entry into subteam log for seqno: %v", seqno)
	}
	if lastPoint != nil && seqno < lastPoint.Seqno {
		return fmt.Errorf("cannot add to subteam log out of order: %v < %v", seqno, lastPoint.Seqno)
	}
	if lastPoint != nil && lastPoint.Name.IsNil() {
		return fmt.Errorf("cannot process subteam rename because %v was deleted at seqno %v", id, lastPoint.Seqno)
	}
	t.inner.SubteamLog[id] = append(t.inner.SubteamLog[id], keybase1.SubteamLogPoint{
		Name:  name,
		Seqno: seqno,
	})
	return nil
}

// Inform the SubteamLog of a subteam deletion.
// Links must be added in order by seqno for each subteam (asserted here).
// Links for different subteams can interleave.
// Mutates the SubteamLog.
func (t *TeamSigChainState) informSubteamDelete(id keybase1.TeamID, seqno keybase1.Seqno) error {
	lastPoint := t.getLastSubteamPoint(id)
	if lastPoint != nil && lastPoint.Seqno.Eq(seqno) {
		return fmt.Errorf("re-entry into subteam log for seqno: %v", seqno)
	}
	if lastPoint != nil && seqno < lastPoint.Seqno {
		return fmt.Errorf("cannot add to subteam log out of order: %v < %v", seqno, lastPoint.Seqno)
	}
	// Don't check for deleting the same team twice. Just allow it.
	t.inner.SubteamLog[id] = append(t.inner.SubteamLog[id], keybase1.SubteamLogPoint{
		Seqno: seqno,
	})
	return nil
}

// Only call this on a Team that has been loaded with NeedAdmin.
// Otherwise, you might get incoherent answers due to links that
// were stubbed over the life of the cached object.
//
// For subteams that you were removed from, this list may
// still include them because your removal was stubbed.
// The list will not contain duplicate names.
// Since this should only be called when you are an admin,
// none of that should really come up, but it's here just to be less fragile.
func (t *TeamSigChainState) ListSubteams() (res []keybase1.TeamIDAndName) {
	type Entry struct {
		ID   keybase1.TeamID
		Name keybase1.TeamName
		// Seqno of the last cached rename of this team
		Seqno keybase1.Seqno
	}
	// Use a map to deduplicate names. If there is a subteam name
	// collision, take the one with the latest (parent) seqno
	// modifying its name.
	// A collision could occur if you were removed from a team
	// and miss its renaming or deletion to stubbing.
	resMap := make(map[string] /*TeamName*/ Entry)
	for subteamID, points := range t.inner.SubteamLog {
		if len(points) == 0 {
			// this should never happen
			continue
		}
		lastPoint := points[len(points)-1]
		if lastPoint.Name.IsNil() {
			// the subteam has been deleted
			continue
		}
		entry := Entry{
			ID:    subteamID,
			Name:  lastPoint.Name,
			Seqno: lastPoint.Seqno,
		}
		existing, ok := resMap[entry.Name.String()]
		replace := !ok || (entry.Seqno >= existing.Seqno)
		if replace {
			resMap[entry.Name.String()] = entry
		}
	}
	for _, entry := range resMap {
		res = append(res, keybase1.TeamIDAndName{
			Id:   entry.ID,
			Name: entry.Name,
		})
	}
	return res
}

// Check that a subteam rename occurred just so.
// That the subteam `subteamID` got a new name `newName` at exactly `seqno` in this,
// the parent, chain.
// Note this only checks against the last part of `newName` because mid-team renames are such a pain.
// This is currently linear in the number of times that subteam has been renamed.
// It should be easy to add an index if need be.
func (t *TeamSigChainState) SubteamRenameOccurred(
	subteamID keybase1.TeamID, newName keybase1.TeamName, seqno keybase1.Seqno) error {

	points := t.inner.SubteamLog[subteamID]
	if len(points) == 0 {
		return fmt.Errorf("subteam %v has no name log", subteamID)
	}
	for _, point := range points {
		if point.Seqno == seqno {
			if point.Name.LastPart().Eq(newName.LastPart()) {
				// found it!
				return nil
			}
		}
		if point.Seqno > seqno {
			break
		}
	}
	return fmt.Errorf("subteam %v did not have rename entry in log: %v %v",
		subteamID, newName, seqno)
}

func (t *TeamSigChainState) NumActiveInvites() int {
	return len(t.inner.ActiveInvites)
}

func (t *TeamSigChainState) HasActiveInvite(name keybase1.TeamInviteName, typ keybase1.TeamInviteType) (bool, error) {
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

func (t *TeamSigChainState) FindActiveInvite(name keybase1.TeamInviteName, typ keybase1.TeamInviteType) (*keybase1.TeamInvite, error) {
	for _, active := range t.inner.ActiveInvites {
		if active.Name == name && active.Type.Eq(typ) {
			return &active, nil
		}
	}
	return nil, libkb.NotFoundError{}
}

func (t *TeamSigChainState) FindActiveInviteByID(id keybase1.TeamInviteID) (keybase1.TeamInvite, bool) {
	invite, found := t.inner.ActiveInvites[id]
	return invite, found
}

func (t *TeamSigChainState) IsInviteObsolete(id keybase1.TeamInviteID) bool {
	_, ok := t.inner.ObsoleteInvites[id]
	return ok
}

// FindActiveKeybaseInvite finds and returns *first* Keybase-type
// invite for given UID. Ordering here is not guaranteed, caller
// shouldn't assume that returned invite will be the oldest/newest one
// for the UID.
func (t *TeamSigChainState) FindActiveKeybaseInvite(uid keybase1.UID) (keybase1.TeamInvite, keybase1.UserVersion, bool) {
	for _, invite := range t.inner.ActiveInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid.Equal(uid) {
				return invite, inviteUv, true
			}
		}
	}
	return keybase1.TeamInvite{}, keybase1.UserVersion{}, false
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
func (t *TeamSigChainPlayer) AppendChainLink(ctx context.Context, link *chainLinkUnpacked, signer *signerX) error {
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
	ctx context.Context, prevState *TeamSigChainState, link *chainLinkUnpacked, signer *signerX) (
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
		if signer == nil || !signer.signer.Uid.Exists() {
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
	prevState *TeamSigChainState, link *chainLinkUnpacked, signer signerX,
	isInflate bool) (
	res checkInnerLinkResult, err error) {

	if link.inner == nil {
		return res, NewStubbedError(link)
	}
	payload := *link.inner

	if !signer.signer.Uid.Exists() {
		return res, NewInvalidLink(link, "empty link signer")
	}

	// This may be superfluous.
	err = link.AssertInnerOuterMatch()
	if err != nil {
		return res, err
	}

	// completely ignore these fields
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

	if teamID.IsPublic() != team.Public {
		return res, fmt.Errorf("link specified public:%v but ID is public:%v",
			team.Public, teamID.IsPublic())
	}

	if prevState != nil && !prevState.inner.Id.Equal(teamID) {
		return res, fmt.Errorf("wrong team id: %s != %s", teamID.String(), prevState.inner.Id.String())
	}

	if prevState != nil && prevState.IsImplicit() != team.Implicit {
		return res, fmt.Errorf("link specified implicit:%v but team was already implicit:%v",
			team.Implicit, prevState.IsImplicit())
	}

	if prevState != nil && prevState.IsPublic() != team.Public {
		return res, fmt.Errorf("link specified public:%v but team was already public:%v",
			team.Implicit, prevState.IsImplicit())
	}

	if team.Public && (!team.Implicit || (prevState != nil && !prevState.IsImplicit())) {
		return res, fmt.Errorf("public non-implicit teams are not supported")
	}

	err = t.checkSeqnoToAdd(prevState, link.Seqno(), isInflate)
	if err != nil {
		return res, err
	}
	// When isInflate then it is likely prevSeqno != prevState.GetLatestSeqno()
	prevSeqno := link.Seqno() - 1

	allowInflate := func(allow bool) error {
		if isInflate && !allow {
			return fmt.Errorf("inflating link type not supported: %v", payload.Body.Type)
		}
		return nil
	}
	allowInImplicitTeam := func(allow bool) error {
		if team.Implicit && !allow {
			return NewImplicitTeamOperationError(payload.Body.Type)
		}
		return nil
	}
	enforceFirstInChain := func(firstInChain bool) error {
		if firstInChain {
			if prevState != nil {
				return fmt.Errorf("link type '%s' unexpected at seqno:%v", payload.Body.Type, prevState.inner.LastSeqno+1)
			}
		} else {
			if prevState == nil {
				return fmt.Errorf("link type '%s' unexpected at beginning", payload.Body.Type)
			}
		}
		return nil
	}
	enforceGeneric := func(name string, rule Tristate, hasReal bool) error {
		switch rule {
		case TristateDisallow:
			if hasReal {
				return fmt.Errorf("sigchain link contains unexpected '%s'", name)
			}
		case TristateRequire:
			if !hasReal {
				return fmt.Errorf("sigchain link missing %s", name)
			}
		case TristateOptional:
		default:
			return fmt.Errorf("unsupported tristate (fault): %v", rule)
		}
		return nil
	}
	enforce := func(rules LinkRules) error {
		return libkb.PickFirstError(
			enforceGeneric("name", rules.Name, team.Name != nil),
			enforceGeneric("members", rules.Members, team.Members != nil),
			enforceGeneric("parent", rules.Parent, team.Parent != nil),
			enforceGeneric("subteam", rules.Subteam, team.Subteam != nil),
			enforceGeneric("per-team-key", rules.PerTeamKey, team.PerTeamKey != nil),
			enforceGeneric("admin", rules.Admin, team.Admin != nil),
			enforceGeneric("invites", rules.Invites, team.Invites != nil),
			enforceGeneric("completed-invites", rules.CompletedInvites, team.CompletedInvites != nil),
			enforceGeneric("settings", rules.Settings, team.Settings != nil),
			enforceGeneric("kbfs", rules.KBFS, team.KBFS != nil),
			allowInImplicitTeam(rules.AllowInImplicitTeam),
			allowInflate(rules.AllowInflate),
			enforceFirstInChain(rules.FirstInChain),
		)
	}

	checkAdmin := func(op string) (signerIsExplicitOwner bool, err error) {
		signerRole, err := prevState.GetUserRoleAtSeqno(signer.signer, prevSeqno)
		if err != nil {
			signerRole = keybase1.TeamRole_NONE
		}
		signerIsExplicitOwner = signerRole == keybase1.TeamRole_OWNER
		if signerRole.IsAdminOrAbove() || signer.implicitAdmin {
			return signerIsExplicitOwner, nil
		}
		return signerIsExplicitOwner, fmt.Errorf("link signer does not have permission to %s: %v is a %v", op, signer, signerRole)
	}

	checkExplicitWriter := func(op string) (err error) {
		signerRole, err := prevState.GetUserRoleAtSeqno(signer.signer, prevSeqno)
		if err != nil {
			signerRole = keybase1.TeamRole_NONE
		}
		if !signerRole.IsWriterOrAbove() {
			return fmt.Errorf("link signer does not have writer permission to %s: %v is a %v", op, signer, signerRole)
		}
		return nil
	}

	switch libkb.LinkType(payload.Body.Type) {
	case libkb.LinkTypeTeamRoot:
		err = enforce(LinkRules{
			Name:                TristateRequire,
			Members:             TristateRequire,
			PerTeamKey:          TristateRequire,
			Invites:             TristateOptional,
			Settings:            TristateOptional,
			AllowInImplicitTeam: true,
			FirstInChain:        true,
		})
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

		// Whether this is an implicit team
		isImplicit := teamName.IsImplicit()
		if isImplicit != team.Implicit {
			return res, fmt.Errorf("link specified implicit:%v but name specified implicit:%v",
				team.Implicit, isImplicit)
		}

		// Check the team ID
		// assert that team_name = hash(team_id)
		// this is only true for root teams
		if !teamID.Equal(teamName.ToTeamID(team.Public)) {
			return res, fmt.Errorf("team id:%s does not match team name:%s", teamID, teamName)
		}
		if teamID.IsSubTeam() {
			return res, fmt.Errorf("malformed root team id")
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, sanityCheckMembersOptions{
			requireOwners:       true,
			allowRemovals:       false,
			onlyOwnersOrReaders: isImplicit,
		})
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
				Implicit:     isImplicit,
				Public:       team.Public,
				RootAncestor: teamName.RootAncestorName(),
				NameDepth:    teamName.Depth(),
				NameLog: []keybase1.TeamNameLogPoint{{
					LastPart: teamName.LastPart(),
					Seqno:    1,
				}},
				LastSeqno:        1,
				LastLinkID:       link.LinkID().Export(),
				ParentID:         nil,
				UserLog:          make(map[keybase1.UserVersion][]keybase1.UserLogPoint),
				SubteamLog:       make(map[keybase1.TeamID][]keybase1.SubteamLogPoint),
				PerTeamKeys:      perTeamKeys,
				PerTeamKeyCTime:  keybase1.UnixTime(payload.Ctime),
				LinkIDs:          make(map[keybase1.Seqno]keybase1.LinkID),
				StubbedLinks:     make(map[keybase1.Seqno]bool),
				ActiveInvites:    make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
				ObsoleteInvites:  make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
				TlfLegacyUpgrade: make(map[keybase1.TeamApplication]keybase1.TeamLegacyTLFUpgradeChainInfo),
			}}

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())

		if team.Invites != nil {
			if isImplicit {
				additions, cancelations, err := t.sanityCheckInvites(signer.signer, *team.Invites, sanityCheckInvitesOptions{
					implicitTeam: isImplicit,
				})
				if err != nil {
					return res, err
				}
				t.updateInvites(&res.newState, additions, cancelations)
			} else {
				return res, fmt.Errorf("invites not allowed in root link")
			}
		}

		// check that the signer is an owner
		if res.newState.getUserRole(signer.signer) != keybase1.TeamRole_OWNER {
			return res, fmt.Errorf("signer is not an owner: %v (%v)", signer, team.Members.Owners)
		}

		if settings := team.Settings; settings != nil {
			err = t.parseTeamSettings(settings, &res.newState)
			if err != nil {
				return res, err
			}
		}

		return res, nil
	case libkb.LinkTypeChangeMembership:
		err = enforce(LinkRules{
			Members:             TristateRequire,
			PerTeamKey:          TristateOptional,
			Admin:               TristateOptional,
			CompletedInvites:    TristateOptional,
			AllowInImplicitTeam: true,
		})
		if err != nil {
			return res, err
		}

		// Check that the signer is at least an ADMIN or is an IMPLICIT ADMIN to have permission to make this link.
		var signerIsExplicitOwner bool
		signerIsExplicitOwner, err = checkAdmin("change membership")
		if err != nil {
			return res, err
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, sanityCheckMembersOptions{
			disallowOwners:      prevState.IsSubteam(),
			allowRemovals:       true,
			onlyOwnersOrReaders: prevState.IsImplicit(),
		})
		if err != nil {
			return res, err
		}

		// Only owners can add more owners.
		if (len(roleUpdates[keybase1.TeamRole_OWNER]) > 0) && !signerIsExplicitOwner {
			return res, fmt.Errorf("non-owner cannot add owners")
		}

		// Only owners can remove owners.
		if t.roleUpdatesDemoteOwners(prevState, roleUpdates) && !signerIsExplicitOwner {
			return res, fmt.Errorf("non-owner cannot demote owners")
		}

		if prevState.IsImplicit() {
			// In implicit teams there are only 2 kinds of membership changes allowed:
			// 1. Resolve an invite. Adds 1 user and completes 1 invite.
			//    Though sometimes a new user is not added, due to a conflict.
			// 2. Accept a reset user. Adds 1 user and removes 1 user.
			//    Where the new one has the same UID and role as the old and a greater EldestSeqno.

			// Here's a case that is not straightforward:
			// There is an impteam alice,leland%2,bob@twitter.
			// Leland resets and then proves bob@twitter. On the team chain alice accepts Leland's reset.
			// So she removes leland%2, adds leland%3, and completes the bob@twitter invite.

			// Here's another:
			// There is an impteam leland#bob@twitter.
			// Leland proves bob@twitter. On the team chain leland completes the invite.
			// Now it's just leland.

			// Check that the invites being completed are all active.
			// For non-implicit teams we are more lenient, but here we need the counts to match up.
			invitees := make(map[keybase1.UID]bool)
			parsedCompletedInvites := make(map[keybase1.TeamInviteID]keybase1.UserVersion)
			for inviteID, invitee := range team.CompletedInvites {
				_, ok := prevState.inner.ActiveInvites[inviteID]
				if !ok {
					return res, NewImplicitTeamOperationError("completed invite %v but was not active",
						inviteID)
				}
				uv, err := keybase1.ParseUserVersion(invitee)
				if err != nil {
					return res, err
				}
				invitees[uv.Uid] = true
				parsedCompletedInvites[inviteID] = uv
			}
			nCompleted := len(team.CompletedInvites)

			// Check these two properties:
			// - Every removal must come with an addition of a successor. Ignore role.
			// - Every addition must either be paired with a removal, or resolve an invite. Ignore role.
			// This is a coarse check that ignores role changes.

			type removal struct {
				uv        keybase1.UserVersion
				satisfied bool
			}
			removals := make(map[keybase1.UID]removal)
			for _, uv := range roleUpdates[keybase1.TeamRole_NONE] {
				removals[uv.Uid] = removal{uv: uv}
			}
			var nCompletedExpected int
			additions := make(map[keybase1.UID]bool)
			// Every addition must either be paired with a removal or resolve an invite.
			for _, uv := range append(roleUpdates[keybase1.TeamRole_OWNER], roleUpdates[keybase1.TeamRole_READER]...) {
				removal, ok := removals[uv.Uid]
				if ok {
					if removal.uv.EldestSeqno >= uv.EldestSeqno {
						return res, NewImplicitTeamOperationError("replaced with older eldest seqno: %v -> %v",
							removal.uv.EldestSeqno, uv.EldestSeqno)
					}
					removal.satisfied = true
					removals[uv.Uid] = removal
					if invitees[uv.Uid] && uv.EldestSeqno > removal.uv.EldestSeqno {
						// If we are removing someone that is also a completed invite, then it must
						// be replacing a reset user with a new version. Expect an invite in this case.
						nCompletedExpected++
						additions[uv.Uid] = true
					}
				} else {
					// This is a new user, so must be a completed invite.
					nCompletedExpected++
					additions[uv.Uid] = true
				}
			}
			// All removals must have come with successor.
			for _, r := range removals {
				if !r.satisfied {
					return res, NewImplicitTeamOperationError("removal without addition for %v", r.uv)
				}
			}
			// Completed invites that do not bring in new members mean
			// SBS consolidations.
			for _, uv := range parsedCompletedInvites {
				_, ok := additions[uv.Uid]
				if !ok {
					if prevState.getUserRole(uv) == keybase1.TeamRole_NONE {
						return res, NewImplicitTeamOperationError("trying to moot invite but there is no member for %v", uv)
					}
					nCompleted--
				}
			}
			// The number of completed invites must match.
			if nCompletedExpected != nCompleted {
				return res, NewImplicitTeamOperationError("illegal membership change: %d != %d",
					nCompletedExpected, nCompleted)
			}
		}

		res.newState = prevState.DeepCopy()

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())

		t.completeInvites(&res.newState, team.CompletedInvites)
		t.obsoleteInvites(&res.newState, roleUpdates, payload.SignatureMetadata())

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
			res.newState.inner.PerTeamKeyCTime = keybase1.UnixTime(payload.Ctime)
		}

		return res, nil
	case libkb.LinkTypeRotateKey:
		err = enforce(LinkRules{
			PerTeamKey:          TristateRequire,
			Admin:               TristateOptional,
			AllowInImplicitTeam: true,
		})
		if err != nil {
			return res, err
		}

		// Check that the signer is at least a writer to have permission to make this link.
		if !signer.implicitAdmin {
			signerRole, err := prevState.GetUserRoleAtSeqno(signer.signer, prevSeqno)
			if err != nil {
				return res, err
			}
			switch signerRole {
			case keybase1.TeamRole_WRITER, keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
				// ok
			default:
				return res, fmt.Errorf("link signer does not have permission to rotate key: %v is a %v", signer, signerRole)
			}
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
		res.newState.inner.PerTeamKeyCTime = keybase1.UnixTime(payload.Ctime)

		return res, nil
	case libkb.LinkTypeLeave:
		err = enforce(LinkRules{ /* Just about everything is restricted. */ })
		if err != nil {
			return res, err
		}

		// Check that the signer is at least a reader.
		// Implicit admins cannot leave a subteam.
		signerRole, err := prevState.GetUserRoleAtSeqno(signer.signer, prevSeqno)
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
		res.newState.inform(signer.signer, keybase1.TeamRole_NONE, payload.SignatureMetadata())

		return res, nil
	case libkb.LinkTypeNewSubteam:
		err = enforce(LinkRules{
			Subteam:      TristateRequire,
			Admin:        TristateOptional,
			AllowInflate: true,
		})
		if err != nil {
			return res, err
		}

		// Check the subteam ID
		subteamID, err := t.assertIsSubteamID(string(team.Subteam.ID))
		if err != nil {
			return res, err
		}

		// Check the subteam name
		subteamName, err := t.assertSubteamName(prevState, link.Seqno(), string(team.Subteam.Name))
		if err != nil {
			return res, err
		}

		_, err = checkAdmin("make subteam")
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
		err = enforce(LinkRules{
			Name:         TristateRequire,
			Members:      TristateRequire,
			Parent:       TristateRequire,
			PerTeamKey:   TristateRequire,
			Admin:        TristateOptional,
			Settings:     TristateOptional,
			FirstInChain: true,
		})
		if err != nil {
			return res, err
		}

		if team.Public {
			return res, fmt.Errorf("public subteams are not supported")
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
		if teamName.IsImplicit() || team.Implicit {
			return res, NewImplicitTeamOperationError(payload.Body.Type)
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, sanityCheckMembersOptions{
			disallowOwners: true,
			allowRemovals:  false,
		})
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
				Implicit:     false,
				Public:       false,
				RootAncestor: teamName.RootAncestorName(),
				NameDepth:    teamName.Depth(),
				NameLog: []keybase1.TeamNameLogPoint{{
					LastPart: teamName.LastPart(),
					Seqno:    1,
				}},
				LastSeqno:       1,
				LastLinkID:      link.LinkID().Export(),
				ParentID:        &parentID,
				UserLog:         make(map[keybase1.UserVersion][]keybase1.UserLogPoint),
				SubteamLog:      make(map[keybase1.TeamID][]keybase1.SubteamLogPoint),
				PerTeamKeys:     perTeamKeys,
				PerTeamKeyCTime: keybase1.UnixTime(payload.Ctime),
				LinkIDs:         make(map[keybase1.Seqno]keybase1.LinkID),
				StubbedLinks:    make(map[keybase1.Seqno]bool),
				ActiveInvites:   make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
				ObsoleteInvites: make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
			}}

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())
		if settings := team.Settings; settings != nil {
			err = t.parseTeamSettings(settings, &res.newState)
			if err != nil {
				return res, err
			}
		}

		return res, nil
	case libkb.LinkTypeRenameSubteam:
		err = enforce(LinkRules{
			Subteam:      TristateRequire,
			Admin:        TristateOptional,
			AllowInflate: true,
		})
		if err != nil {
			return res, err
		}

		_, err = checkAdmin("rename subteam")
		if err != nil {
			return res, err
		}

		// Check the subteam ID
		subteamID, err := t.assertIsSubteamID(string(team.Subteam.ID))
		if err != nil {
			return res, err
		}

		// Check the subteam name
		subteamName, err := t.assertSubteamName(prevState, link.Seqno(), string(team.Subteam.Name))
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
		err = enforce(LinkRules{
			Name:   TristateRequire,
			Parent: TristateRequire,
			Admin:  TristateOptional,
		})
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
			return res, fmt.Errorf("invalid parent team id: %v", err)
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
		if !newName.RootAncestorName().Eq(prevState.inner.RootAncestor) {
			return res, fmt.Errorf("rename cannot change root ancestor team name: %v -> %v", prevState.inner.RootAncestor, newName)
		}
		if newName.Depth() != prevState.inner.NameDepth {
			return res, fmt.Errorf("rename cannot change team nesting depth: %v -> %v", prevState.inner.NameDepth, newName)
		}

		res.newState = prevState.DeepCopy()

		res.newState.inner.NameLog = append(res.newState.inner.NameLog, keybase1.TeamNameLogPoint{
			LastPart: newName.LastPart(),
			Seqno:    link.Seqno(),
		})

		return res, nil
	case libkb.LinkTypeDeleteSubteam:
		err = enforce(LinkRules{
			Subteam:      TristateRequire,
			Admin:        TristateOptional,
			AllowInflate: true,
		})
		if err != nil {
			return res, err
		}

		_, err = checkAdmin("delete subteam")
		if err != nil {
			return res, err
		}

		// Check the subteam ID
		subteamID, err := t.assertIsSubteamID(string(team.Subteam.ID))
		if err != nil {
			return res, err
		}

		// Check the subteam name
		_, err = t.assertSubteamName(prevState, link.Seqno(), string(team.Subteam.Name))
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()

		err = res.newState.informSubteamDelete(subteamID, link.Seqno())
		if err != nil {
			return res, fmt.Errorf("error deleting subteam: %v", err)
		}

		return res, nil
	case libkb.LinkTypeInvite:
		err = enforce(LinkRules{
			Admin:               TristateOptional,
			Invites:             TristateRequire,
			AllowInImplicitTeam: true,
		})
		if err != nil {
			return res, err
		}

		_, err = checkAdmin("invite")
		if err != nil {
			return res, err
		}

		additions, cancelations, err := t.sanityCheckInvites(signer.signer, *team.Invites, sanityCheckInvitesOptions{
			implicitTeam: prevState.IsImplicit(),
		})
		if err != nil {
			return res, err
		}

		if prevState.IsImplicit() {
			// Check to see if the additions were previously members of the team
			checkImpteamInvites := func() error {
				addedUIDs := make(map[keybase1.UID]bool)
				for _, invites := range additions {
					for _, invite := range invites {
						cat, err := invite.Type.C()
						if err != nil {
							return err
						}
						if cat == keybase1.TeamInviteCategory_KEYBASE {
							uv, err := invite.KeybaseUserVersion()
							if err != nil {
								return err
							}
							addedUIDs[uv.Uid] = true
							_, err = prevState.GetLatestUVWithUID(uv.Uid)
							if err == nil {
								// Found crypto member in previous
								// state, we are good!
								continue
							}
							_, _, found := prevState.FindActiveKeybaseInvite(uv.Uid)
							if found {
								// Found PUKless member in previous
								// state, still fine!
								continue
							}
							// Neither crypto member nor PUKless member
							// found, we can't allow this addition.
							return fmt.Errorf("Not found previous version of user %s", uv.Uid)
						}
						return fmt.Errorf("invalid invite type in implicit team: %v", cat)
					}
				}

				var cancelledUVs []keybase1.UserVersion
				for _, inviteID := range cancelations {
					invite, found := prevState.FindActiveInviteByID(inviteID)
					if !found {
						// This is harmless and also we might be canceling
						// an obsolete invite.
						continue
					}
					inviteUv, err := invite.KeybaseUserVersion()
					if err != nil {
						return fmt.Errorf("cancelled invite is not valid keybase-type invite: %v", err)
					}
					cancelledUVs = append(cancelledUVs, inviteUv)
				}

				for _, uv := range cancelledUVs {
					if !addedUIDs[uv.Uid] {
						return fmt.Errorf("cancelling invite for %v without inviting back a new version", uv)
					}
				}
				return nil
			}
			if err := checkImpteamInvites(); err != nil {
				return res, NewImplicitTeamOperationError("Error in link %q: %v", payload.Body.Type, err)
			}
		}

		res.newState = prevState.DeepCopy()
		t.updateInvites(&res.newState, additions, cancelations)
		return res, nil
	case libkb.LinkTypeSettings:
		err = enforce(LinkRules{
			Admin:    TristateOptional,
			Settings: TristateRequire,
			// At the moment the only team setting is banned in implicit teams.
			// But in the future there could be allowed settings that also use this link type.
			AllowInImplicitTeam: true,
		})
		if err != nil {
			return res, err
		}

		_, err = checkAdmin("change settings")
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()
		err = t.parseTeamSettings(team.Settings, &res.newState)
		return res, err
	case libkb.LinkTypeDeleteRoot:
		return res, NewTeamDeletedError()
	case libkb.LinkTypeDeleteUpPointer:
		return res, NewTeamDeletedError()
	case libkb.LinkTypeKBFSSettings:
		err = enforce(LinkRules{
			Admin:               TristateOptional,
			KBFS:                TristateRequire,
			AllowInImplicitTeam: true,
		})
		if err != nil {
			return res, err
		}

		err = checkExplicitWriter("change KBFS settings")
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()
		err = t.parseKBFSTLFUpgrade(team.KBFS, &res.newState)
		return res, err
	case "":
		return res, errors.New("empty body type")
	default:
		if link.outerLink.IgnoreIfUnsupported {
			res.newState = prevState.DeepCopy()
			return res, nil
		}

		return res, fmt.Errorf("unsupported link type: %s", payload.Body.Type)
	}
}

// Add the full inner link for a link that has already been added in stubbed form.
func (t *TeamSigChainPlayer) InflateLink(link *chainLinkUnpacked, signer signerX) error {
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

func (t *TeamSigChainPlayer) checkSeqnoToAdd(prevState *TeamSigChainState, linkSeqno keybase1.Seqno, isInflate bool) error {
	if linkSeqno < 1 {
		return fmt.Errorf("link seqno (%v) cannot be less than 1", linkSeqno)
	}
	if prevState == nil {
		if isInflate {
			return fmt.Errorf("cannot inflate link %v with no previous state", linkSeqno)
		}
		if linkSeqno != 1 {
			return fmt.Errorf("first team link must have seqno 1 but got %v", linkSeqno)
		}
	} else {
		if isInflate {
			if prevState.IsLinkFilled(linkSeqno) {
				return fmt.Errorf("link %v is already filled", linkSeqno)
			}
		} else {
			if linkSeqno != prevState.GetLatestSeqno()+1 {
				return fmt.Errorf("link had unexpected seqno %v != %v", linkSeqno, prevState.GetLatestSeqno()+1)
			}
		}
		if linkSeqno > prevState.GetLatestSeqno()+1 {
			return fmt.Errorf("link had far-future seqno %v > %v", linkSeqno, prevState.GetLatestSeqno()+1)
		}
	}
	return nil
}

func (t *TeamSigChainPlayer) inflateLinkHelper(
	prevState *TeamSigChainState, link *chainLinkUnpacked, signer signerX) (
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

type sanityCheckInvitesOptions struct {
	implicitTeam bool
}

func assertIsKeybaseInvite(g *libkb.GlobalContext, i SCTeamInvite) bool {
	typ, err := keybase1.TeamInviteTypeFromString(string(i.Type), g.Env.GetRunMode() == libkb.DevelRunMode)
	if err != nil {
		g.Log.Info("bad invite type: %s", err)
		return false
	}
	cat, err := typ.C()
	if err != nil {
		g.Log.Info("bad invite category: %s", err)
		return false
	}
	return cat == keybase1.TeamInviteCategory_KEYBASE
}

// sanityCheckInvites sanity checks a raw SCTeamInvites section and coerces it into a
// format that we can use. It checks:
//  - no owners are invited
//  - that invite IDs aren't repeated
//  - that <name,type> pairs aren't reused
//  - that IDs parse into proper keybase1.TeamInviteIDs
//  - that the invite type parses into proper TeamInviteType, or that it's an unknown
//    invite that we're OK to not act upon.
// Implicit teams are different:
// - owners and readers are the only allowed role
// Returns nicely formatted data structures.
func (t *TeamSigChainPlayer) sanityCheckInvites(
	signer keybase1.UserVersion, invites SCTeamInvites, options sanityCheckInvitesOptions,
) (additions map[keybase1.TeamRole][]keybase1.TeamInvite, cancelations []keybase1.TeamInviteID, err error) {

	type assignment struct {
		i    SCTeamInvite
		role keybase1.TeamRole
	}
	var all []assignment
	additions = make(map[keybase1.TeamRole][]keybase1.TeamInvite)

	if invites.Owners != nil && len(*invites.Owners) > 0 {
		additions[keybase1.TeamRole_OWNER] = nil
		for _, i := range *invites.Owners {
			if !options.implicitTeam && !assertIsKeybaseInvite(t.G(), i) {
				return nil, nil, fmt.Errorf("encountered a disallowed owner invite")
			}
			all = append(all, assignment{i, keybase1.TeamRole_OWNER})
		}
	}

	if invites.Admins != nil && len(*invites.Admins) > 0 {
		if options.implicitTeam {
			return nil, nil, NewImplicitTeamOperationError("encountered admin invite")
		}
		additions[keybase1.TeamRole_ADMIN] = nil
		for _, i := range *invites.Admins {
			all = append(all, assignment{i, keybase1.TeamRole_ADMIN})
		}
	}

	if invites.Writers != nil && len(*invites.Writers) > 0 {
		if options.implicitTeam {
			return nil, nil, NewImplicitTeamOperationError("encountered writer invite")
		}
		additions[keybase1.TeamRole_WRITER] = nil
		for _, i := range *invites.Writers {
			all = append(all, assignment{i, keybase1.TeamRole_WRITER})
		}
	}

	if invites.Readers != nil && len(*invites.Readers) > 0 {
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
				return nil, nil, NewInviteError(fmt.Sprintf("ID %s appears twice as a cancellation", c))
			}
			byID[id] = false
			cancelations = append(cancelations, id)
		}
	}

	for _, invite := range all {
		res, err := invite.i.TeamInvite(t.G(), invite.role, signer)
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

// A map describing an intent to change users' roles.
// Each item means: change that user to that role.
// To be clear: An omission does NOT mean to remove the existing role.
type chainRoleUpdates map[keybase1.TeamRole][]keybase1.UserVersion

type sanityCheckMembersOptions struct {
	// At least one owner must be added
	requireOwners bool
	// Adding owners is blocked
	disallowOwners bool
	// Removals are allowed, blocked if false
	allowRemovals bool
	// Only additions of OWNER or READER are allowed. Does not affect removals.
	onlyOwnersOrReaders bool
}

// Check that all the users are formatted correctly.
// Check that there are no duplicate members.
// Do not check that all removals are members. That should be true, but not strictly enforced when reading.
func (t *TeamSigChainPlayer) sanityCheckMembers(members SCTeamMembers, options sanityCheckMembersOptions) (chainRoleUpdates, error) {
	type assignment struct {
		m    SCTeamMember
		role keybase1.TeamRole
	}
	var all []assignment

	if options.requireOwners {
		if members.Owners == nil {
			return nil, fmt.Errorf("team has no owner list")
		}
		if len(*members.Owners) < 1 {
			return nil, fmt.Errorf("team has no owners")
		}
	}
	if options.disallowOwners {
		if members.Owners != nil && len(*members.Owners) > 0 {
			return nil, fmt.Errorf("team has owners")
		}
	}
	if !options.allowRemovals {
		if members.None != nil && len(*members.None) != 0 {
			return nil, fmt.Errorf("team has removals in link")
		}
	}

	// Map from roles to users.
	res := make(map[keybase1.TeamRole][]keybase1.UserVersion)

	if members.Owners != nil && len(*members.Owners) > 0 {
		res[keybase1.TeamRole_OWNER] = nil
		for _, m := range *members.Owners {
			all = append(all, assignment{m, keybase1.TeamRole_OWNER})
		}
	}
	if members.Admins != nil && len(*members.Admins) > 0 {
		if options.onlyOwnersOrReaders {
			return nil, NewImplicitTeamOperationError("encountered add admin")
		}
		res[keybase1.TeamRole_ADMIN] = nil
		for _, m := range *members.Admins {
			all = append(all, assignment{m, keybase1.TeamRole_ADMIN})
		}
	}
	if members.Writers != nil && len(*members.Writers) > 0 {
		if options.onlyOwnersOrReaders {
			return nil, NewImplicitTeamOperationError("encountered add writer")
		}
		res[keybase1.TeamRole_WRITER] = nil
		for _, m := range *members.Writers {
			all = append(all, assignment{m, keybase1.TeamRole_WRITER})
		}
	}
	if members.Readers != nil && len(*members.Readers) > 0 {
		res[keybase1.TeamRole_READER] = nil
		for _, m := range *members.Readers {
			all = append(all, assignment{m, keybase1.TeamRole_READER})
		}
	}
	if members.None != nil && len(*members.None) > 0 {
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

// Whether the roleUpdates would demote any current owner to a lesser role.
func (t *TeamSigChainPlayer) roleUpdatesDemoteOwners(prev *TeamSigChainState, roleUpdates map[keybase1.TeamRole][]keybase1.UserVersion) bool {
	for toRole, uvs := range roleUpdates {
		if toRole == keybase1.TeamRole_OWNER {
			continue
		}
		for _, uv := range uvs {
			fromRole, err := prev.GetUserRole(uv)
			if err != nil {
				continue // ignore error, user not in team
			}
			if fromRole == keybase1.TeamRole_OWNER {
				// This is an intent to demote an owner.
				return true
			}
		}
	}
	return false
}

func (t *TeamSigChainPlayer) checkPerTeamKey(link SCChainLink, perTeamKey SCPerTeamKey, expectedGeneration keybase1.PerTeamKeyGeneration) (res keybase1.PerTeamKey, err error) {
	// check the per-team-key
	if perTeamKey.Generation != expectedGeneration {
		return res, fmt.Errorf("per-team-key generation expected %v but got %v", expectedGeneration, perTeamKey.Generation)
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
func (t *TeamSigChainPlayer) updateMembership(stateToUpdate *TeamSigChainState, roleUpdates chainRoleUpdates, sigMeta keybase1.SignatureMetadata) {
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

func (t *TeamSigChainPlayer) completeInvites(stateToUpdate *TeamSigChainState, completed map[keybase1.TeamInviteID]keybase1.UserVersionPercentForm) {
	for id := range completed {
		stateToUpdate.informCompletedInvite(id)
	}
}

func (t *TeamSigChainPlayer) obsoleteInvites(stateToUpdate *TeamSigChainState, roleUpdates chainRoleUpdates, sigMeta keybase1.SignatureMetadata) {
	if len(stateToUpdate.inner.ActiveInvites) == 0 {
		return
	}

	for _, uvs := range roleUpdates {
		for _, uv := range uvs {
			stateToUpdate.findAndObsoleteInviteForUser(uv.Uid)
		}
	}
}

// Check that the subteam name is valid and kind of is a child of this chain.
// Returns the parsed subteam name.
func (t *TeamSigChainPlayer) assertSubteamName(parent *TeamSigChainState, parentSeqno keybase1.Seqno, subteamNameStr string) (keybase1.TeamName, error) {
	// Ideally, we would assert the team name is a direct child of this team's name.
	// But the middle parts of the names might be out of date.
	// Instead assert:
	// - The root team name is same.
	// - The subteam is 1 level deeper.
	// - The last part of the parent team's name matched
	//   at the parent-seqno that this subteam name was mentioned.
	//   (If the subteam is a.b.c.d then c should match)
	//   The reason this is pegged at seqno instead of simply the latest parent name is
	//   hard to explain, see TestRenameInflateSubteamAfterRenameParent.

	subteamName, err := keybase1.TeamNameFromString(subteamNameStr)
	if err != nil {
		return subteamName, fmt.Errorf("invalid subteam team name '%s': %v", subteamNameStr, err)
	}

	if !parent.inner.RootAncestor.Eq(subteamName.RootAncestorName()) {
		return subteamName, fmt.Errorf("subteam is of a different root team: %v != %v",
			subteamName.RootAncestorName(),
			parent.inner.RootAncestor)
	}

	expectedDepth := parent.inner.NameDepth + 1
	if subteamName.Depth() != expectedDepth {
		return subteamName, fmt.Errorf("subteam name has depth %v but expected %v",
			subteamName.Depth(), expectedDepth)
	}

	// The last part of the parent name at parentSeqno.
	var parentLastPart keybase1.TeamNamePart
	for _, point := range parent.inner.NameLog {
		if point.Seqno > parentSeqno {
			break
		}
		parentLastPart = point.LastPart
	}

	subteamSecondToLastPart := subteamName.Parts[len(subteamName.Parts)-2]
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

func (t *TeamSigChainPlayer) parseTeamSettings(settings *SCTeamSettings, newState *TeamSigChainState) error {
	if open := settings.Open; open != nil {
		if newState.inner.Implicit {
			return fmt.Errorf("implicit team cannot be open")
		}

		newState.inner.Open = open.Enabled
		if options := open.Options; options != nil {
			if !open.Enabled {
				return fmt.Errorf("closed team shouldn't define team.settings.open.options")
			}

			switch options.JoinAs {
			case "reader":
				newState.inner.OpenTeamJoinAs = keybase1.TeamRole_READER
			case "writer":
				newState.inner.OpenTeamJoinAs = keybase1.TeamRole_WRITER
			default:
				return fmt.Errorf("invalid join_as role in open team: %s", options.JoinAs)
			}
		} else if open.Enabled {
			return fmt.Errorf("team set to open but team.settings.open.options is missing")
		}
	}

	return nil
}

func (t *TeamSigChainPlayer) parseKBFSTLFUpgrade(upgrade *SCTeamKBFS, newState *TeamSigChainState) error {
	if upgrade.TLF != nil {
		newState.inner.TlfID = upgrade.TLF.ID
	}
	if upgrade.Keyset != nil {
		if newState.inner.TlfLegacyUpgrade == nil {
			// If an old client cached this as nil, then just make a new map here for this link
			newState.inner.TlfLegacyUpgrade =
				make(map[keybase1.TeamApplication]keybase1.TeamLegacyTLFUpgradeChainInfo)
		}
		newState.inner.TlfLegacyUpgrade[upgrade.Keyset.AppType] = keybase1.TeamLegacyTLFUpgradeChainInfo{
			KeysetHash:       upgrade.Keyset.KeysetHash,
			TeamGeneration:   upgrade.Keyset.TeamGeneration,
			LegacyGeneration: upgrade.Keyset.LegacyGeneration,
			AppType:          upgrade.Keyset.AppType,
		}
	}
	return nil
}

type Tristate int

const (
	TristateDisallow Tristate = 0 // default
	TristateRequire  Tristate = 1
	TristateOptional Tristate = 2
)

// LinkRules describes what fields and properties are required for a link type.
// Default values are the strictest.
// Keep this in sync with `func enforce`.
type LinkRules struct {
	// Sections
	Name             Tristate
	Members          Tristate
	Parent           Tristate
	Subteam          Tristate
	PerTeamKey       Tristate
	Admin            Tristate
	Invites          Tristate
	CompletedInvites Tristate
	Settings         Tristate
	KBFS             Tristate

	AllowInImplicitTeam bool // whether this link is allowed in implicit team chains
	AllowInflate        bool // whether this link is allowed to be filled later
	FirstInChain        bool // whether this link must be the beginning of the chain
}
