package teams

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams/hidden"
	jsonw "github.com/keybase/go-jsonw"
)

// Create a new user/version pair.
func NewUserVersion(uid keybase1.UID, eldestSeqno keybase1.Seqno) keybase1.UserVersion {
	return keybase1.NewUserVersion(uid, eldestSeqno)
}

const TeamSigChainPlayerSupportedLinkVersion = 2

// Accessor wrapper for keybase1.TeamSigChainState
type TeamSigChainState struct {
	inner  keybase1.TeamSigChainState
	hidden *keybase1.HiddenTeamChain
}

func newTeamSigChainState(t Teamer) TeamSigChainState {
	ret := TeamSigChainState{hidden: t.HiddenChain()}
	if t.MainChain() != nil {
		ret.inner = t.MainChain().Chain
	}
	return ret
}

func (t TeamSigChainState) DeepCopy() TeamSigChainState {
	ret := TeamSigChainState{
		inner: t.inner.DeepCopy(),
	}
	if t.hidden != nil {
		tmp := t.hidden.DeepCopy()
		ret.hidden = &tmp
	}
	return ret
}

func (t TeamSigChainState) DeepCopyToPtr() *TeamSigChainState {
	t2 := t.DeepCopy()
	return &t2
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

func (t TeamSigChainState) GetLatestHiddenSeqno() keybase1.Seqno {
	if t.hidden == nil {
		return keybase1.Seqno(0)
	}
	return t.hidden.Last
}

func (t TeamSigChainState) GetLatestLinkID() keybase1.LinkID {
	return t.inner.LastLinkID
}

func (t TeamSigChainState) GetLatestHighSeqno() keybase1.Seqno {
	return t.inner.LastHighSeqno
}

func (t TeamSigChainState) GetLatestHighLinkID() keybase1.LinkID {
	return t.inner.LastHighLinkID
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
	ret := t.inner.MaxPerTeamKeyGeneration
	if h := t.hidden.MaxReaderPerTeamKeyGeneration(); h > ret {
		ret = h
	}
	return ret
}

func (t TeamSigChainState) GetLatestKBFSGeneration(appType keybase1.TeamApplication) (int, error) {
	info, ok := t.inner.TlfLegacyUpgrade[appType]
	if !ok {
		return 0, errors.New("no KBFS keys available")
	}
	return info.LegacyGeneration, nil
}

func (t TeamSigChainState) makeHiddenRatchet(mctx libkb.MetaContext) (ret *hidden.Ratchet, err error) {
	return hidden.MakeRatchet(mctx, t.hidden)
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

func (t TeamSigChainState) MemberCtime(user keybase1.UserVersion) *keybase1.Time {
	points := t.inner.UserLog[user]
	if len(points) == 0 {
		return nil
	}
	// see if the user ever left the team so we return their most recent join
	// time.
	for i := len(points) - 1; i > 0; i-- {
		// if we left the team at some point, return our later join time
		if points[i].Role == keybase1.TeamRole_NONE {
			if i < len(points)-1 && points[i+1].Role != keybase1.TeamRole_NONE {
				return &points[i+1].SigMeta.Time
			}
		}
	}
	// we never left the team, give our original join time.
	return &points[0].SigMeta.Time
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
	return t.inner.UserRole(user)
}

func (t TeamSigChainState) GetUserLastJoinTime(user keybase1.UserVersion) (time keybase1.Time, err error) {
	return t.inner.GetUserLastJoinTime(user)
}

// NewStyle invites are completed in the `used_invites` field in the change
// membership link, can optionally specify an expiration time, and a maximum
// number of uses (potentially infinite).
func IsNewStyleInvite(invite keybase1.TeamInvite) (bool, error) {
	return invite.MaxUses != nil, nil
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
		return res, errors.New("did not find user with given uid")
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

func (t TeamSigChainState) GetAllUVs() (res []keybase1.UserVersion) {
	for uv := range t.inner.UserLog {
		if t.getUserRole(uv) != keybase1.TeamRole_NONE {
			res = append(res, uv)
		}
	}
	return res
}
func (t TeamSigChainState) GetLatestPerTeamKey(mctx libkb.MetaContext) (res keybase1.PerTeamKey, err error) {
	res, _, err = t.getLatestPerTeamKeyWithMerkleSeqno(mctx)
	return res, err
}

func (t TeamSigChainState) getLatestPerTeamKeyWithMerkleSeqno(mctx libkb.MetaContext) (res keybase1.PerTeamKey, mr keybase1.MerkleRootV2, err error) {
	var hk *keybase1.PerTeamKey
	if t.hidden != nil {
		hk = t.hidden.MaxReaderPerTeamKey()
	}
	var ok bool
	res, ok = t.inner.PerTeamKeys[t.inner.MaxPerTeamKeyGeneration]

	if hk == nil && ok {
		return res, t.inner.MerkleRoots[res.Seqno], nil
	}
	if !ok && hk != nil {
		return *hk, t.hidden.MerkleRoots[hk.Seqno], nil
	}
	if !ok && hk == nil {
		// if this happens it's a programming error
		mctx.Debug("PTK not found error debug dump: inner %+v", t.inner)
		if t.hidden != nil {
			mctx.Debug("PTK not found error debug dump: hidden: %+v", *t.hidden)
		}
		return res, mr, fmt.Errorf("per-team-key not found for latest generation %d", t.inner.MaxPerTeamKeyGeneration)
	}
	if hk.Gen > res.Gen {
		return *hk, t.hidden.MerkleRoots[hk.Seqno], nil
	}
	return res, t.inner.MerkleRoots[res.Seqno], nil
}

// checkNewPTK takes an existing state (t) and checks that a new PTK found (ptk) doesn't clash
// against any PTKs already in the state.
func (t *TeamSigChainState) checkNewPTK(ptk SCPerTeamKey) error {
	// If there was no prior state, then the new PTK is OK
	if t == nil {
		return nil
	}
	gen := ptk.Generation
	chk := func(existing keybase1.PerTeamKey, found bool) error {
		if !found {
			return nil
		}
		if !existing.SigKID.Equal(ptk.SigKID) || !existing.EncKID.Equal(ptk.EncKID) {
			return fmt.Errorf("PTK clash at generation %d", gen)
		}
		return nil
	}
	if t.hidden != nil {
		tmp, found := t.hidden.GetReaderPerTeamKeyAtGeneration(gen)
		if err := chk(tmp, found); err != nil {
			return err
		}
	}
	tmp, found := t.inner.PerTeamKeys[gen]
	if err := chk(tmp, found); err != nil {
		return err
	}
	return nil
}

func (t *TeamSigChainState) GetLatestPerTeamKeyCTime() keybase1.UnixTime {
	return t.inner.PerTeamKeyCTime
}

func (t TeamSigChainState) GetPerTeamKeyAtGeneration(gen keybase1.PerTeamKeyGeneration) (keybase1.PerTeamKey, error) {
	res, ok := t.inner.PerTeamKeys[gen]
	if ok {
		return res, nil
	}
	res, ok = t.hidden.GetReaderPerTeamKeyAtGeneration(gen)
	if ok {
		return res, nil
	}
	return keybase1.PerTeamKey{}, libkb.NotFoundError{Msg: fmt.Sprintf("per-team-key not found for generation %d", gen)}
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

// Inform the UserLog and Bots of a user's role.
// Mutates the UserLog and Bots.
// Must be called with seqno's and events in correct order.
// Idempotent if called correctly.
func (t *TeamSigChainState) inform(u keybase1.UserVersion, role keybase1.TeamRole, sigMeta keybase1.SignatureMetadata) {
	currentRole := t.getUserRole(u)
	if currentRole == role {
		// no change in role, no new checkpoint needed
		return
	}
	t.inner.UserLog[u] = append(t.inner.UserLog[u], keybase1.UserLogPoint{
		Role:    role,
		SigMeta: sigMeta,
	})
	// Clear an entry in Bots if any
	if !role.IsRestrictedBot() {
		delete(t.inner.Bots, u)
	}
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

// FindActiveInviteByID returns potentially expired invites that have not been
// explicitly cancelled, since the sigchain player is agnostic to the concept
// of time. We treat invite expiration times as advisory for admin clients
// completing invites, but do not check them in the sigchain player.
func (t *TeamSigChainState) FindActiveInviteByID(id keybase1.TeamInviteID) (keybase1.TeamInvite, bool) {
	invite, found := t.inner.ActiveInvites[id]
	return invite, found
}

func (t *TeamSigChainState) IsInviteObsolete(id keybase1.TeamInviteID) bool {
	_, ok := t.inner.ObsoleteInvites[id]
	return ok
}

// FindActiveKeybaseInvite finds and returns a Keybase-type
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

func (t *TeamSigChainState) GetMerkleRoots() map[keybase1.Seqno]keybase1.MerkleRootV2 {
	return t.inner.MerkleRoots
}

func (t TeamSigChainState) TeamBotSettings() map[keybase1.UserVersion]keybase1.TeamBotSettings {
	return t.inner.Bots
}

// --------------------------------------------------

// AppendChainLink process a chain link.
// It must have already been partially verified by TeamLoader.
// `reader` is the user who is processing the chain.
// `state` is moved into this function. There must exist no live references into it from now on.
// If `state` is nil this is the first link of the chain.
// `signer` may be nil iff link is stubbed.
func AppendChainLink(ctx context.Context, g *libkb.GlobalContext, reader keybase1.UserVersion, state *TeamSigChainState,
	link *ChainLinkUnpacked, signer *SignerX) (res TeamSigChainState, err error) {
	t := &teamSigchainPlayer{
		Contextified: libkb.NewContextified(g),
		reader:       reader,
	}
	var latestSeqno keybase1.Seqno
	if state != nil {
		latestSeqno = state.GetLatestSeqno()
	}
	res, err = t.appendChainLinkHelper(libkb.NewMetaContext(ctx, g), state, link, signer)
	if err != nil {
		return TeamSigChainState{}, NewAppendLinkError(link, latestSeqno, err)
	}
	return res, err
}

// InflateLink adds the full inner link for a link that has already been added in stubbed form.
// `state` is moved into this function. There must exist no live references into it from now on.
func InflateLink(ctx context.Context, g *libkb.GlobalContext, reader keybase1.UserVersion, state TeamSigChainState,
	link *ChainLinkUnpacked, signer SignerX) (res TeamSigChainState, err error) {
	if link.isStubbed() {
		return TeamSigChainState{}, NewStubbedError(link)
	}
	if link.Seqno() > state.GetLatestSeqno() {
		return TeamSigChainState{}, NewInflateErrorWithNote(link,
			fmt.Sprintf("seqno off the chain %v > %v", link.Seqno(), state.GetLatestSeqno()))
	}

	// Check the that the link id matches our stubbed record.
	seenLinkID, err := state.GetLibkbLinkIDBySeqno(link.Seqno())
	if err != nil {
		return TeamSigChainState{}, err
	}
	if !seenLinkID.Eq(link.LinkID()) {
		return TeamSigChainState{}, NewInflateErrorWithNote(link,
			fmt.Sprintf("link id mismatch: %v != %v", link.LinkID().String(), seenLinkID.String()))
	}

	// Check that the link has not already been inflated.
	if _, ok := state.inner.StubbedLinks[link.Seqno()]; !ok {
		return TeamSigChainState{}, NewInflateErrorWithNote(link, "already inflated")
	}

	t := &teamSigchainPlayer{
		Contextified: libkb.NewContextified(g),
		reader:       reader,
	}
	iRes, err := t.addInnerLink(libkb.NewMetaContext(ctx, g), &state, link, signer, true)
	if err != nil {
		return TeamSigChainState{}, err
	}

	delete(iRes.newState.inner.StubbedLinks, link.Seqno())

	return iRes.newState, nil

}

// Helper struct for playing sigchains.
type teamSigchainPlayer struct {
	libkb.Contextified
	reader keybase1.UserVersion // the user processing the chain
}

// Add a chain link to the end.
// `prevState` is moved into this function. There must exist no live references into it from now on.
// `signer` may be nil iff link is stubbed.
// If `prevState` is nil this is the first chain link.
func (t *teamSigchainPlayer) appendChainLinkHelper(
	mctx libkb.MetaContext, prevState *TeamSigChainState, link *ChainLinkUnpacked, signer *SignerX) (
	res TeamSigChainState, err error) {

	err = t.checkOuterLink(mctx.Ctx(), prevState, link)
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
		iRes, err := t.addInnerLink(mctx, prevState, link, *signer, false)
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

	// Store the head merkle sequence to the DB, for use in the audit mechanism.
	// For the purposes of testing, we disable this feature, so we can check
	// the lazy-repopulation scheme for old stored teams (without a full cache bust).
	if link.Seqno() == keybase1.Seqno(1) && !link.isStubbed() && !t.G().Env.Test.TeamNoHeadMerkleStore {
		tmp := link.inner.Body.MerkleRoot.ToMerkleRootV2()
		newState.inner.HeadMerkle = &tmp
	}

	if !link.isStubbed() && newState.inner.MerkleRoots != nil {
		newState.inner.MerkleRoots[link.Seqno()] = link.inner.Body.MerkleRoot.ToMerkleRootV2()
	}

	return *newState, nil
}

func (t *teamSigchainPlayer) checkOuterLink(ctx context.Context, prevState *TeamSigChainState, link *ChainLinkUnpacked) (err error) {
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

type checkInnerLinkResult struct {
	newState TeamSigChainState
}

// Check and add the inner link.
// `isInflate` is false if this is a new link and true if it is a link which has already been added as stubbed.
// Does not modify `prevState` but returns a new state.
func (t *teamSigchainPlayer) addInnerLink(mctx libkb.MetaContext,
	prevState *TeamSigChainState, link *ChainLinkUnpacked, signer SignerX,
	isInflate bool) (res checkInnerLinkResult, err error) {

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
			enforceGeneric("box-summary-hash", rules.BoxSummaryHash, team.BoxSummaryHash != nil),
			enforceGeneric("bot_settings", rules.BotSettings, team.BotSettings != nil),
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

	moveState := func() {
		// Move prevState to res.newState.
		// Re-use the object without deep copying. There must be no other live references into prevState.
		res.newState = *prevState
		prevState = nil
	}
	isHighLink := false

	switch libkb.LinkType(payload.Body.Type) {
	case libkb.LinkTypeTeamRoot:
		isHighLink = true
		err = enforce(LinkRules{
			Name:                TristateRequire,
			Members:             TristateRequire,
			PerTeamKey:          TristateRequire,
			BoxSummaryHash:      TristateOptional,
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

		perTeamKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, nil)
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
				LastSeqno:               1,
				LastLinkID:              link.LinkID().Export(),
				ParentID:                nil,
				UserLog:                 make(map[keybase1.UserVersion][]keybase1.UserLogPoint),
				SubteamLog:              make(map[keybase1.TeamID][]keybase1.SubteamLogPoint),
				PerTeamKeys:             perTeamKeys,
				MaxPerTeamKeyGeneration: keybase1.PerTeamKeyGeneration(1),
				PerTeamKeyCTime:         keybase1.UnixTime(payload.Ctime),
				LinkIDs:                 make(map[keybase1.Seqno]keybase1.LinkID),
				StubbedLinks:            make(map[keybase1.Seqno]bool),
				ActiveInvites:           make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
				ObsoleteInvites:         make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
				UsedInvites:             make(map[keybase1.TeamInviteID][]keybase1.TeamUsedInviteLogPoint),
				TlfLegacyUpgrade:        make(map[keybase1.TeamApplication]keybase1.TeamLegacyTLFUpgradeChainInfo),
				MerkleRoots:             make(map[keybase1.Seqno]keybase1.MerkleRootV2),
				Bots:                    make(map[keybase1.UserVersion]keybase1.TeamBotSettings),
			}}

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())

		if team.Invites != nil {
			if isImplicit {
				signerIsExplicitOwner := true
				additions, cancelations, err := t.sanityCheckInvites(mctx, signer.signer, signerIsExplicitOwner,
					*team.Invites, link.SigID(), sanityCheckInvitesOptions{
						isRootTeam:   true,
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
	case libkb.LinkTypeChangeMembership:
		err = enforce(LinkRules{
			Members:             TristateRequire,
			PerTeamKey:          TristateOptional,
			Admin:               TristateOptional,
			CompletedInvites:    TristateOptional,
			BoxSummaryHash:      TristateOptional,
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
			// In implicit teams there are only 3 kinds of membership changes allowed:
			// 1. Resolve an invite. Adds 1 user and completes 1 invite.
			//    Though sometimes a new user is not added, due to a conflict.
			// 2. Accept a reset user. Adds 1 user and removes 1 user.
			//    Where the new one has the same UID and role as the old and a greater EldestSeqno.
			// 3. Add/remove a bot user. The bot can be a RESTRICTEDBOT or regular BOT member.

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

			// Check these properties:
			// - Every removal must come with an addition of a successor. Ignore role.
			// - Every addition must either be paired with a removal, or
			// resolve an invite. Ignore role when not dealing with bots.
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
				role := prevState.getUserRole(r.uv)
				if !(r.satisfied || role.IsBotLike()) {
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

		isHighLink, err = t.roleUpdateChangedHighSet(prevState, roleUpdates)
		if err != nil {
			return res, fmt.Errorf("could not determine if high user set changed")
		}

		moveState()
		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())

		if err := t.completeInvites(&res.newState, team.CompletedInvites); err != nil {
			return res, fmt.Errorf("illegal completed_invites: %s", err)
		}
		t.obsoleteInvites(&res.newState, roleUpdates, payload.SignatureMetadata())

		if err := t.useInvites(&res.newState, roleUpdates, team.UsedInvites); err != nil {
			return res, fmt.Errorf("illegal used_invites: %s", err)
		}

		// Note: If someone was removed, the per-team-key should be rotated. This is not checked though.

		if team.PerTeamKey != nil {
			newKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, &res.newState)
			if err != nil {
				return res, err
			}
			res.newState.inner.PerTeamKeys[newKey.Gen] = newKey
			if newKey.Gen > res.newState.inner.MaxPerTeamKeyGeneration {
				res.newState.inner.MaxPerTeamKeyGeneration = newKey.Gen
			}
			res.newState.inner.PerTeamKeyCTime = keybase1.UnixTime(payload.Ctime)
		}
	case libkb.LinkTypeRotateKey:
		err = enforce(LinkRules{
			PerTeamKey:          TristateRequire,
			Admin:               TristateOptional,
			BoxSummaryHash:      TristateOptional,
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

		newKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, prevState)
		if err != nil {
			return res, err
		}

		moveState()
		res.newState.inner.PerTeamKeys[newKey.Gen] = newKey
		res.newState.inner.PerTeamKeyCTime = keybase1.UnixTime(payload.Ctime)
		if newKey.Gen > res.newState.inner.MaxPerTeamKeyGeneration {
			res.newState.inner.MaxPerTeamKeyGeneration = newKey.Gen
		}
	case libkb.LinkTypeLeave:
		err = enforce(LinkRules{ /* Just about everything is restricted. */ })
		if err != nil {
			return res, err
		}
		// Key rotation should never be allowed since FullVerify sometimes does not run on leave links.

		// Check that the signer is at least a bot.
		// Implicit admins cannot leave a subteam.
		signerRole, err := prevState.GetUserRoleAtSeqno(signer.signer, prevSeqno)
		if err != nil {
			return res, err
		}
		switch signerRole {
		case keybase1.TeamRole_RESTRICTEDBOT,
			keybase1.TeamRole_BOT,
			keybase1.TeamRole_READER,
			keybase1.TeamRole_WRITER,
			keybase1.TeamRole_ADMIN,
			keybase1.TeamRole_OWNER:
			// ok
		default:
			return res, fmt.Errorf("link signer does not have permission to leave: %v is a %v", signer, signerRole)
		}

		// The last owner of a team should not leave.
		// But that's really up to them and the server. We're just reading what has happened.

		moveState()
		res.newState.inform(signer.signer, keybase1.TeamRole_NONE, payload.SignatureMetadata())
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

		moveState()

		// informSubteam will take care of asserting that these links are inflated
		// in order for each subteam.
		err = res.newState.informSubteam(subteamID, subteamName, link.Seqno())
		if err != nil {
			return res, fmt.Errorf("adding new subteam: %v", err)
		}
	case libkb.LinkTypeSubteamHead:
		isHighLink = true

		err = enforce(LinkRules{
			Name:           TristateRequire,
			Members:        TristateRequire,
			Parent:         TristateRequire,
			PerTeamKey:     TristateRequire,
			Admin:          TristateOptional,
			Settings:       TristateOptional,
			BoxSummaryHash: TristateOptional,
			FirstInChain:   true,
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

		perTeamKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, nil)
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
				LastSeqno:               1,
				LastLinkID:              link.LinkID().Export(),
				ParentID:                &parentID,
				UserLog:                 make(map[keybase1.UserVersion][]keybase1.UserLogPoint),
				SubteamLog:              make(map[keybase1.TeamID][]keybase1.SubteamLogPoint),
				PerTeamKeys:             perTeamKeys,
				MaxPerTeamKeyGeneration: keybase1.PerTeamKeyGeneration(1),
				PerTeamKeyCTime:         keybase1.UnixTime(payload.Ctime),
				LinkIDs:                 make(map[keybase1.Seqno]keybase1.LinkID),
				StubbedLinks:            make(map[keybase1.Seqno]bool),
				ActiveInvites:           make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
				ObsoleteInvites:         make(map[keybase1.TeamInviteID]keybase1.TeamInvite),
				UsedInvites:             make(map[keybase1.TeamInviteID][]keybase1.TeamUsedInviteLogPoint),
				MerkleRoots:             make(map[keybase1.Seqno]keybase1.MerkleRootV2),
				Bots:                    make(map[keybase1.UserVersion]keybase1.TeamBotSettings),
			}}

		t.updateMembership(&res.newState, roleUpdates, payload.SignatureMetadata())
		if settings := team.Settings; settings != nil {
			err = t.parseTeamSettings(settings, &res.newState)
			if err != nil {
				return res, err
			}
		}
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

		moveState()

		// informSubteam will take care of asserting that these links are inflated
		// in order for each subteam.
		err = res.newState.informSubteam(subteamID, subteamName, link.Seqno())
		if err != nil {
			return res, fmt.Errorf("adding new subteam: %v", err)
		}
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

		moveState()

		res.newState.inner.NameLog = append(res.newState.inner.NameLog, keybase1.TeamNameLogPoint{
			LastPart: newName.LastPart(),
			Seqno:    link.Seqno(),
		})
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

		moveState()

		err = res.newState.informSubteamDelete(subteamID, link.Seqno())
		if err != nil {
			return res, fmt.Errorf("error deleting subteam: %v", err)
		}
	case libkb.LinkTypeInvite:
		err = enforce(LinkRules{
			Admin:               TristateOptional,
			Invites:             TristateRequire,
			AllowInImplicitTeam: true,
		})
		if err != nil {
			return res, err
		}

		signerIsExplicitOwner, err := checkAdmin("invite")
		if err != nil {
			return res, err
		}

		additions, cancelations, err := t.sanityCheckInvites(mctx, signer.signer, signerIsExplicitOwner,
			*team.Invites, link.SigID(), sanityCheckInvitesOptions{
				isRootTeam:   !prevState.IsSubteam(),
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

		moveState()
		t.updateInvites(&res.newState, additions, cancelations)
	case libkb.LinkTypeSettings:
		err = enforce(LinkRules{
			Admin:    TristateOptional,
			Settings: TristateRequire,
			// Allow key rotation in settings link. Closing an open team
			// should rotate team key.
			PerTeamKey: TristateOptional,
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

		moveState()
		err = t.parseTeamSettings(team.Settings, &res.newState)
		if err != nil {
			return res, err
		}

		// When team is changed from open to closed, per-team-key should be rotated. But
		// this is not enforced.
		if team.PerTeamKey != nil {
			newKey, err := t.checkPerTeamKey(*link.source, *team.PerTeamKey, &res.newState)
			if err != nil {
				return res, err
			}
			res.newState.inner.PerTeamKeys[newKey.Gen] = newKey
			res.newState.inner.PerTeamKeyCTime = keybase1.UnixTime(payload.Ctime)
			if newKey.Gen > res.newState.inner.MaxPerTeamKeyGeneration {
				res.newState.inner.MaxPerTeamKeyGeneration = newKey.Gen
			}
		}
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

		moveState()
		err = t.parseKBFSTLFUpgrade(team.KBFS, &res.newState)
		if err != nil {
			return res, err
		}
	case libkb.LinkTypeTeamBotSettings:
		if err = enforce(LinkRules{
			Admin:               TristateOptional,
			BotSettings:         TristateRequire,
			AllowInImplicitTeam: true,
		}); err != nil {
			return res, err
		}

		if _, err = checkAdmin("change bots"); err != nil {
			return res, err
		}

		moveState()
		if err = t.parseTeamBotSettings(*team.BotSettings, &res.newState); err != nil {
			return res, err
		}
	case "":
		return res, errors.New("empty body type")
	default:
		if link.outerLink.IgnoreIfUnsupported {
			moveState()
		} else {
			return res, fmt.Errorf("unsupported link type: %s", payload.Body.Type)
		}
	}

	if isHighLink {
		res.newState.inner.LastHighLinkID = link.LinkID().Export()
		res.newState.inner.LastHighSeqno = link.Seqno()
	}
	return res, nil
}

func (t *teamSigchainPlayer) roleUpdateChangedHighSet(prevState *TeamSigChainState, roleUpdates chainRoleUpdates) (bool, error) {
	// The high set of users can be changed by promotion to Admin/Owner or
	// demotion from Admin/Owner or any movement between those two roles.
	for newRole, uvs := range roleUpdates {
		if newRole.IsAdminOrAbove() {
			return true, nil
		}
		// were any of these users previously an admin or above
		for _, uv := range uvs {
			prevRole, err := prevState.GetUserRole(uv)
			if err != nil {
				return false, err
			}
			if prevRole.IsAdminOrAbove() {
				return true, nil
			}
		}

	}
	return false, nil
}

func (t *teamSigchainPlayer) checkSeqnoToAdd(prevState *TeamSigChainState, linkSeqno keybase1.Seqno, isInflate bool) error {
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

type sanityCheckInvitesOptions struct {
	isRootTeam   bool
	implicitTeam bool
}

func assertIsKeybaseInvite(mctx libkb.MetaContext, i SCTeamInvite) bool {
	typ, err := TeamInviteTypeFromString(mctx, i.Type)
	if err != nil {
		mctx.Info("bad invite type: %s", err)
		return false
	}
	cat, err := typ.C()
	if err != nil {
		mctx.Info("bad invite category: %s", err)
		return false
	}
	return cat == keybase1.TeamInviteCategory_KEYBASE
}

// These signatures contain non-owners inviting owners.
// They slipped in before that was banned. They are excepted from the rule.
var hardcodedInviteRuleExceptionSigIDs = map[keybase1.SigIDMapKey]bool{
	"c06e8da2959d8c8054fb10e005910716f776b3c3df9ef2eb4c4b8584f45e187f0f": true,
	"e800db474fa75f39503e9241990c3707121c7c414687a7b1f5ef579a625eaf820f": true,
	"46d9f2700b8d4287a2dc46dae00974a794b5778149214cf91fa4b69229a6abbc0f": true,
}

// sanityCheckInvites sanity checks a raw SCTeamInvites section and coerces it into a
// format that we can use. It checks:
//  - inviting owners is sometimes banned
//  - invite IDs aren't repeated
//  - <name,type> pairs aren't reused
//  - IDs parse into proper keybase1.TeamInviteIDs
//  - the invite type parses into proper TeamInviteType, or that it's an unknown
//    invite that we're OK to not act upon.
// Implicit teams are different:
// - owners and readers are the only allowed roles
func (t *teamSigchainPlayer) sanityCheckInvites(mctx libkb.MetaContext,
	signer keybase1.UserVersion, signerIsExplicitOwner bool, invites SCTeamInvites, sigID keybase1.SigID,
	options sanityCheckInvitesOptions,
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
			if !options.isRootTeam {
				return nil, nil, fmt.Errorf("encountered invite of owner in non-root team")
			}
			if !signerIsExplicitOwner {
				if !hardcodedInviteRuleExceptionSigIDs[sigID.ToMapKey()] {
					return nil, nil, fmt.Errorf("encountered invite of owner by non-owner")
				}
			}
			if !(options.implicitTeam || assertIsKeybaseInvite(mctx, i)) {
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
		res, err := invite.i.TeamInvite(mctx, invite.role, signer)
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

		isNewStyle, err := IsNewStyleInvite(res)
		if err != nil {
			return nil, nil, NewInviteError(fmt.Sprintf("failed to check if invite is new-style: %s", err))
		}
		if isNewStyle {
			if options.implicitTeam {
				return nil, nil, NewInviteError(fmt.Sprintf("Invite ID %s is new-style in implicit team", id))
			}
			if res.MaxUses == nil {
				return nil, nil, NewInviteError(fmt.Sprintf("Invite ID %s is new-style but has no max-uses", key))
			}
			if !res.MaxUses.IsValid() {
				return nil, nil, NewInviteError(fmt.Sprintf("Invite ID %s has invalid max_uses %d", id, *res.MaxUses))
			}
			if res.Etime != nil {
				if *res.Etime <= 0 {
					return nil, nil, NewInviteError(fmt.Sprintf("Invite ID %s has invalid etime %d", id, *res.Etime))
				}
			}
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
func (t *teamSigchainPlayer) sanityCheckMembers(members SCTeamMembers, options sanityCheckMembersOptions) (chainRoleUpdates, error) {
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
	if members.Bots != nil && len(*members.Bots) > 0 {
		res[keybase1.TeamRole_BOT] = nil
		for _, m := range *members.Bots {
			all = append(all, assignment{m, keybase1.TeamRole_BOT})
		}
	}
	if members.RestrictedBots != nil && len(*members.RestrictedBots) > 0 {
		res[keybase1.TeamRole_RESTRICTEDBOT] = nil
		for _, m := range *members.RestrictedBots {
			all = append(all, assignment{m, keybase1.TeamRole_RESTRICTEDBOT})
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
func (t *teamSigchainPlayer) roleUpdatesDemoteOwners(prev *TeamSigChainState, roleUpdates map[keybase1.TeamRole][]keybase1.UserVersion) bool {

	// It is OK to readmit an owner if the owner reset and is coming in at a lower permission
	// level. So check that case here.
	readmittingResetUser := func(uv keybase1.UserVersion) bool {
		for toRole, uvs := range roleUpdates {
			if toRole == keybase1.TeamRole_NONE {
				continue
			}
			for _, newUV := range uvs {
				if newUV.Uid.Equal(uv.Uid) && newUV.EldestSeqno > uv.EldestSeqno {
					return true
				}
			}
		}
		return false
	}

	for toRole, uvs := range roleUpdates {
		if toRole == keybase1.TeamRole_OWNER {
			continue
		}
		for _, uv := range uvs {
			fromRole, err := prev.GetUserRole(uv)
			if err != nil {
				continue // ignore error, user not in team
			}
			if toRole == keybase1.TeamRole_NONE && fromRole == keybase1.TeamRole_OWNER && readmittingResetUser(uv) {
				continue
			}
			if fromRole == keybase1.TeamRole_OWNER {
				// This is an intent to demote an owner.
				return true
			}
		}
	}
	return false
}

func (t *teamSigchainPlayer) checkPerTeamKey(link SCChainLink, perTeamKey SCPerTeamKey, prevState *TeamSigChainState) (res keybase1.PerTeamKey, err error) {

	// Check that the new key doesn't conflict with keys we already have.
	err = prevState.checkNewPTK(perTeamKey)
	if err != nil {
		return res, err
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
func (t *teamSigchainPlayer) updateMembership(stateToUpdate *TeamSigChainState, roleUpdates chainRoleUpdates, sigMeta keybase1.SignatureMetadata) {
	for role, uvs := range roleUpdates {
		for _, uv := range uvs {
			stateToUpdate.inform(uv, role, sigMeta)
		}
	}
}

func (t *teamSigchainPlayer) updateInvites(stateToUpdate *TeamSigChainState, additions map[keybase1.TeamRole][]keybase1.TeamInvite, cancelations []keybase1.TeamInviteID) {
	for _, invites := range additions {
		for _, invite := range invites {
			stateToUpdate.informNewInvite(invite)
		}
	}
	for _, cancelation := range cancelations {
		stateToUpdate.informCanceledInvite(cancelation)
	}
}

func (t *teamSigchainPlayer) completeInvites(stateToUpdate *TeamSigChainState, completed map[keybase1.TeamInviteID]keybase1.UserVersionPercentForm) error {
	for id := range completed {
		invite, ok := stateToUpdate.inner.ActiveInvites[id]
		if !ok {
			// Invite doesn't exist or we don't know about it because invite
			// links were stubbed. We could do a similar check here that we do
			// in teamSigchainPlayer.useInvites, but we haven't been doing it
			// in the past, so we might have links with issues like that in the
			// wild.
			continue
		}
		isNewStyle, err := IsNewStyleInvite(invite)
		if err != nil {
			return err
		}
		if isNewStyle {
			return fmt.Errorf("`completed_invites` for a new-style invite (id: %q)", id)
		}
		stateToUpdate.informCompletedInvite(id)
	}
	return nil
}

func (t *teamSigchainPlayer) obsoleteInvites(stateToUpdate *TeamSigChainState, roleUpdates chainRoleUpdates, sigMeta keybase1.SignatureMetadata) {
	if len(stateToUpdate.inner.ActiveInvites) == 0 {
		return
	}

	for _, uvs := range roleUpdates {
		for _, uv := range uvs {
			stateToUpdate.findAndObsoleteInviteForUser(uv.Uid)
		}
	}
}

func (t *teamSigchainPlayer) useInvites(stateToUpdate *TeamSigChainState, roleUpdates chainRoleUpdates, used []SCMapInviteIDUVPair) error {
	if len(used) == 0 {
		return nil
	}

	hasStubbedLinks := stateToUpdate.HasAnyStubbedLinks()
	for _, pair := range used {
		inviteID, err := pair.InviteID.TeamInviteID()
		if err != nil {
			return err
		}
		uv, err := keybase1.ParseUserVersion(pair.UV)
		if err != nil {
			return err
		}

		invite, foundInvite := stateToUpdate.inner.ActiveInvites[inviteID]
		if foundInvite {
			isNewStyle, err := IsNewStyleInvite(invite)
			if err != nil {
				return err
			}
			if !isNewStyle {
				return fmt.Errorf("`used_invites` for a non-new-style invite (id: %q)", inviteID)
			}

			maxUses := invite.MaxUses
			alreadyUsed := len(stateToUpdate.inner.UsedInvites[inviteID])
			// Note that we append to stateToUpdate.inner.UsedInvites at the end of this for loop,
			// so alreadyUsed updates correctly when processing multiple invite pairs.
			if maxUses.IsUsedUp(alreadyUsed) {
				return fmt.Errorf("invite %s is expired after %d uses", inviteID, alreadyUsed)
			}

			// We explicitly don't check invite.Etime here; it's used as a hint for admins.
			// but not checked in the sigchain player.

			// If we have the invite, also check if invite role matches role
			// added.
			var foundUV bool
			for _, updatedUV := range roleUpdates[invite.Role] {
				if uv.Eq(updatedUV) {
					foundUV = true
					break
				}
			}
			if !foundUV {
				return fmt.Errorf("used_invite for UV %s that was not added as role %s", pair.UV, invite.Role.HumanString())
			}
		} else if !hasStubbedLinks {
			// We couldn't find the invite, and we have no stubbed links, which
			// means that inviteID is invalid.
			return fmt.Errorf("could not find active invite ID in used_invites: %s", inviteID)
		}

		logPoint := len(stateToUpdate.inner.UserLog[uv]) - 1
		if logPoint < 0 {
			return fmt.Errorf("used_invite for UV %s that was not added to to the team", pair.UV)
		}
		stateToUpdate.inner.UsedInvites[inviteID] = append(stateToUpdate.inner.UsedInvites[inviteID],
			keybase1.TeamUsedInviteLogPoint{
				Uv:       uv,
				LogPoint: logPoint,
			})
	}
	return nil
}

// Check that the subteam name is valid and kind of is a child of this chain.
// Returns the parsed subteam name.
func (t *teamSigchainPlayer) assertSubteamName(parent *TeamSigChainState, parentSeqno keybase1.Seqno, subteamNameStr string) (keybase1.TeamName, error) {
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

func (t *teamSigchainPlayer) assertIsSubteamID(subteamIDStr string) (keybase1.TeamID, error) {
	// Check the subteam ID
	subteamID, err := keybase1.TeamIDFromString(subteamIDStr)
	if err != nil {
		return subteamID, fmt.Errorf("invalid subteam id: %v", err)
	}
	if !subteamID.IsSubTeam() {
		return subteamID, fmt.Errorf("malformed subteam id")
	}
	return subteamID, nil
}

func (t *teamSigchainPlayer) parseTeamSettings(settings *SCTeamSettings, newState *TeamSigChainState) error {
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

func (t *teamSigchainPlayer) parseTeamBotSettings(bots []SCTeamBot, newState *TeamSigChainState) error {

	for _, bot := range bots {
		// Bots listed here must have the RESTRICTEDBOT role
		role, err := newState.GetUserRole(bot.Bot.ToUserVersion())
		if err != nil {
			return err
		}
		if !role.IsRestrictedBot() {
			return fmt.Errorf("found bot settings for %v. Expected role RESTRICTEDBOT, found %v", bot, role)
		}

		var convs, triggers []string
		if bot.Triggers != nil {
			triggers = *bot.Triggers
		}
		if bot.Convs != nil {
			convs = *bot.Convs
		}
		if newState.inner.Bots == nil {
			// If an old client cached this as nil, then just make a new map here for this link
			newState.inner.Bots = make(map[keybase1.UserVersion]keybase1.TeamBotSettings)
		}
		newState.inner.Bots[bot.Bot.ToUserVersion()] = keybase1.TeamBotSettings{
			Cmds:     bot.Cmds,
			Mentions: bot.Mentions,
			Triggers: triggers,
			Convs:    convs,
		}
	}
	return nil
}

func (t *teamSigchainPlayer) parseKBFSTLFUpgrade(upgrade *SCTeamKBFS, newState *TeamSigChainState) error {
	if upgrade.TLF != nil {
		newState.inner.TlfIDs = append(newState.inner.TlfIDs, upgrade.TLF.ID)
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
	BoxSummaryHash   Tristate
	BotSettings      Tristate

	AllowInImplicitTeam bool // whether this link is allowed in implicit team chains
	AllowInflate        bool // whether this link is allowed to be filled later
	FirstInChain        bool // whether this link must be the beginning of the chain
}
