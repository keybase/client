// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"fmt"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

func checkContext(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return errors.WithStack(ctx.Err())
	default:
		return nil
	}
}

type localUserMap map[keybase1.UID]LocalUser

func (m localUserMap) getLocalUser(uid keybase1.UID) (LocalUser, error) {
	user, ok := m[uid]
	if !ok {
		return LocalUser{}, NoSuchUserError{uid.String()}
	}
	return user, nil
}

type localTeamMap map[keybase1.TeamID]TeamInfo

func (m localTeamMap) getLocalTeam(tid keybase1.TeamID) (TeamInfo, error) {
	team, ok := m[tid]
	if !ok {
		return TeamInfo{}, NoSuchTeamError{tid.String()}
	}
	return team, nil
}

type localTeamSettingsMap map[keybase1.TeamID]keybase1.KBFSTeamSettings

type localImplicitTeamMap map[keybase1.TeamID]ImplicitTeamInfo

// DaemonLocal implements KeybaseDaemon using an in-memory user
// and session store, and a given favorite store.
type DaemonLocal struct {
	codec kbfscodec.Codec

	// lock protects everything below.
	lock               sync.Mutex
	localUsers         localUserMap
	localTeams         localTeamMap
	localTeamSettings  localTeamSettingsMap
	localImplicitTeams localImplicitTeamMap
	currentUID         keybase1.UID
	asserts            map[string]keybase1.UserOrTeamID
	implicitAsserts    map[string]keybase1.TeamID
	merkleRoot         keybase1.MerkleRootV2
	merkleTime         time.Time
}

// SetCurrentUID sets the current UID.
func (dl *DaemonLocal) SetCurrentUID(uid keybase1.UID) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	// TODO: Send out notifications.
	dl.currentUID = uid
}

func (dl *DaemonLocal) assertionToIDLocked(ctx context.Context,
	assertion string) (id keybase1.UserOrTeamID, err error) {
	expr, err := externals.AssertionParseAndOnlyStatic(ctx, assertion)
	if err != nil {
		return keybase1.UserOrTeamID(""), err
	}
	urls := expr.CollectUrls(nil)
	if len(urls) == 0 {
		return keybase1.UserOrTeamID(""), errors.New("No assertion URLs")
	}

	for _, url := range urls {
		var currID keybase1.UserOrTeamID
		switch {
		case url.IsUID():
			currID = url.ToUID().AsUserOrTeam()
		case url.IsTeamID():
			currID = url.ToTeamID().AsUserOrTeam()
		default:
			key, val := url.ToKeyValuePair()
			a := fmt.Sprintf("%s@%s", val, key)
			if url.IsKeybase() && key != "team" {
				a = val
			}
			var ok bool
			currID, ok = dl.asserts[a]
			if !ok {
				return keybase1.UserOrTeamID(""), NoSuchUserError{a}
			}
		}
		if id != keybase1.UserOrTeamID("") && currID != id {
			return keybase1.UserOrTeamID(""),
				errors.New("AND assertions resolve to different UIDs")
		}
		id = currID
	}
	return id, nil
}

// Resolve implements the KeybaseService interface for DaemonLocal.
func (dl *DaemonLocal) Resolve(
	ctx context.Context, assertion string, _ keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	if err := checkContext(ctx); err != nil {
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()
	id, err := dl.assertionToIDLocked(ctx, assertion)
	if err != nil {
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	if id.IsUser() {
		u, err := dl.localUsers.getLocalUser(id.AsUserOrBust())
		if err != nil {
			return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
		}
		return u.Name, id, nil
	}

	// Otherwise it's a team
	ti, err := dl.localTeams.getLocalTeam(id.AsTeamOrBust())
	if err != nil {
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	_, ok := dl.localImplicitTeams[id.AsTeamOrBust()]
	if ok {
		// An implicit team exists, so Resolve shouldn't work.  The
		// caller should use `ResolveImplicitTeamByID` instead.
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			fmt.Errorf("Team ID %s is an implicit team", id)
	}

	return ti.Name, id, nil
}

// Identify implements the KeybaseService interface for DaemonLocal.
func (dl *DaemonLocal) Identify(
	ctx context.Context, assertion, _ string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	// The local daemon doesn't need to distinguish resolves from
	// identifies.
	return dl.Resolve(ctx, assertion, offline)
}

// NormalizeSocialAssertion implements the KeybaseService interface
// for DaemonLocal.
func (dl *DaemonLocal) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (keybase1.SocialAssertion, error) {
	socialAssertion, isSocialAssertion := externals.NormalizeSocialAssertionStatic(ctx, assertion)
	if !isSocialAssertion {
		return keybase1.SocialAssertion{}, fmt.Errorf("Invalid social assertion")
	}
	return socialAssertion, nil
}

func (dl *DaemonLocal) resolveForImplicitTeam(
	ctx context.Context, name string, r []kbname.NormalizedUsername,
	ur []keybase1.SocialAssertion,
	resolvedIDs map[kbname.NormalizedUsername]keybase1.UserOrTeamID) (
	[]kbname.NormalizedUsername, []keybase1.SocialAssertion, error) {
	id, err := dl.assertionToIDLocked(ctx, name)
	if err == nil {
		u, err := dl.localUsers.getLocalUser(id.AsUserOrBust())
		if err != nil {
			return nil, nil, err
		}
		r = append(r, u.Name)
		resolvedIDs[u.Name] = id
	} else {
		a, ok := externals.NormalizeSocialAssertionStatic(ctx, name)
		if !ok {
			return nil, nil, fmt.Errorf("Bad assertion: %s", name)
		}
		ur = append(ur, a)
	}
	return r, ur, nil
}

// ResolveIdentifyImplicitTeam implements the KeybaseService interface
// for DaemonLocal.
func (dl *DaemonLocal) ResolveIdentifyImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	doIdentifies bool, reason string, _ keybase1.OfflineAvailability) (
	ImplicitTeamInfo, error) {
	if err := checkContext(ctx); err != nil {
		return ImplicitTeamInfo{}, err
	}

	if tlfType != tlf.Private && tlfType != tlf.Public {
		return ImplicitTeamInfo{}, fmt.Errorf(
			"Invalid implicit team TLF type: %s", tlfType)
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()

	// Canonicalize the name.
	writerNames, readerNames, _, err :=
		SplitAndNormalizeTLFName(assertions, tlfType)
	if err != nil {
		return ImplicitTeamInfo{}, err
	}
	var writers, readers []kbname.NormalizedUsername
	var unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion
	resolvedIDs := make(map[kbname.NormalizedUsername]keybase1.UserOrTeamID)
	for _, w := range writerNames {
		writers, unresolvedWriters, err = dl.resolveForImplicitTeam(
			ctx, w, writers, unresolvedWriters, resolvedIDs)
		if err != nil {
			return ImplicitTeamInfo{}, err
		}
	}
	for _, r := range readerNames {
		readers, unresolvedReaders, err = dl.resolveForImplicitTeam(
			ctx, r, readers, unresolvedReaders, resolvedIDs)
		if err != nil {
			return ImplicitTeamInfo{}, err
		}
	}

	var extensions []tlf.HandleExtension
	if len(suffix) != 0 {
		extensions, err = tlf.ParseHandleExtensionSuffix(suffix)
		if err != nil {
			return ImplicitTeamInfo{}, err
		}
	}
	name := tlf.MakeCanonicalName(
		writers, unresolvedWriters, readers, unresolvedReaders, extensions)

	key := fmt.Sprintf("%s:%s", tlfType.String(), name)
	tid, ok := dl.implicitAsserts[key]
	if ok {
		return dl.localImplicitTeams[tid], nil
	}

	// If the implicit team doesn't exist, always create it.

	// Need to make the team info as well, so get the list of user
	// names and resolve them.  Auto-generate an implicit team name.
	implicitName := kbname.NormalizedUsername(
		fmt.Sprintf("_implicit_%d", len(dl.localTeams)))
	teams := makeLocalTeams(
		[]kbname.NormalizedUsername{implicitName}, len(dl.localTeams), tlfType)
	info := teams[0]
	info.Writers = make(map[keybase1.UID]bool, len(writerNames))
	for _, w := range writers {
		id, ok := resolvedIDs[w]
		if !ok {
			return ImplicitTeamInfo{}, fmt.Errorf("No resolved writer %s", w)
		}
		info.Writers[id.AsUserOrBust()] = true
	}
	if len(readerNames) > 0 {
		info.Readers = make(map[keybase1.UID]bool, len(readerNames))
		for _, r := range readers {
			id, ok := resolvedIDs[r]
			if !ok {
				return ImplicitTeamInfo{}, fmt.Errorf(
					"No resolved reader %s", r)

			}
			info.Readers[id.AsUserOrBust()] = true
		}
	}
	// Unresolved users don't need to go in the team info, they're
	// irrelvant until they're resolved.  TODO: add resolved users
	// into existing teams they should be on.

	tid = teams[0].TID
	dl.implicitAsserts[key] = tid
	dl.localTeams[tid] = info

	asUserName := kbname.NormalizedUsername(name)
	iteamInfo := ImplicitTeamInfo{
		// TODO: use the "preferred" canonical format here by listing
		// the logged-in user first?
		Name: asUserName,
		TID:  tid,
	}
	dl.localImplicitTeams[tid] = iteamInfo
	return iteamInfo, nil
}

// ResolveImplicitTeamByID implements the KeybaseService interface
// for DaemonLocal.
func (dl *DaemonLocal) ResolveImplicitTeamByID(
	ctx context.Context, teamID keybase1.TeamID) (name string, err error) {
	if err := checkContext(ctx); err != nil {
		return "", err
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()

	info, ok := dl.localImplicitTeams[teamID]
	if !ok {
		return "", NoSuchTeamError{teamID.String()}
	}
	return info.Name.String(), nil
}

// LoadUserPlusKeys implements the KeybaseService interface for
// DaemonLocal.
func (dl *DaemonLocal) LoadUserPlusKeys(
	ctx context.Context, uid keybase1.UID, _ keybase1.KID,
	_ keybase1.OfflineAvailability) (UserInfo, error) {
	if err := checkContext(ctx); err != nil {
		return UserInfo{}, err
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()
	u, err := dl.localUsers.getLocalUser(uid)
	if err != nil {
		return UserInfo{}, err
	}

	var infoCopy UserInfo
	if err := kbfscodec.Update(dl.codec, &infoCopy, u.UserInfo); err != nil {
		return UserInfo{}, err
	}
	return infoCopy, nil
}

// LoadTeamPlusKeys implements the KeybaseService interface for
// DaemonLocal.
func (dl *DaemonLocal) LoadTeamPlusKeys(
	ctx context.Context, tid keybase1.TeamID, _ tlf.Type, _ kbfsmd.KeyGen,
	_ keybase1.UserVersion, _ kbfscrypto.VerifyingKey,
	_ keybase1.TeamRole, _ keybase1.OfflineAvailability) (TeamInfo, error) {
	if err := checkContext(ctx); err != nil {
		return TeamInfo{}, err
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()
	t, err := dl.localTeams.getLocalTeam(tid)
	if err != nil {
		return TeamInfo{}, err
	}

	// Copy the info since it contains a map that might be mutated.
	var infoCopy TeamInfo
	if err := kbfscodec.Update(dl.codec, &infoCopy, t); err != nil {
		return TeamInfo{}, err
	}
	return infoCopy, nil
}

// CreateTeamTLF implements the KeybaseService interface for
// DaemonLocal.
func (dl *DaemonLocal) CreateTeamTLF(
	ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) (err error) {
	if err := checkContext(ctx); err != nil {
		return err
	}

	// TODO: add check to make sure the private/public suffix of the
	// team ID matches that of the tlf ID.
	dl.lock.Lock()
	defer dl.lock.Unlock()
	iteamInfo, isImplicit := dl.localImplicitTeams[teamID]
	if isImplicit {
		iteamInfo.TlfID = tlfID
		dl.localImplicitTeams[teamID] = iteamInfo
	}
	_, isRegularTeam := dl.localTeams[teamID]
	if !isImplicit && !isRegularTeam {
		return NoSuchTeamError{teamID.String()}
	}
	dl.localTeamSettings[teamID] = keybase1.KBFSTeamSettings{
		TlfID: keybase1.TLFID(tlfID.String())}
	return nil
}

// GetTeamSettings implements the KeybaseService interface for
// DaemonLocal.
func (dl *DaemonLocal) GetTeamSettings(
	ctx context.Context, teamID keybase1.TeamID,
	_ keybase1.OfflineAvailability) (
	settings keybase1.KBFSTeamSettings, err error) {
	if err := checkContext(ctx); err != nil {
		return keybase1.KBFSTeamSettings{}, err
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()
	return dl.localTeamSettings[teamID], nil
}

// GetCurrentMerkleRoot implements the MerkleRootGetter interface for
// DaemonLocal.
func (dl *DaemonLocal) GetCurrentMerkleRoot(ctx context.Context) (
	keybase1.MerkleRootV2, time.Time, error) {
	if err := checkContext(ctx); err != nil {
		return keybase1.MerkleRootV2{}, time.Time{}, err
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()
	return dl.merkleRoot, dl.merkleTime, nil
}

// VerifyMerkleRoot implements the MerkleRootGetter interface for
// DaemonLocal.
func (dl *DaemonLocal) VerifyMerkleRoot(
	_ context.Context, _ keybase1.MerkleRootV2, _ keybase1.KBFSRoot) error {
	return nil
}

// SetCurrentMerkleRoot is a helper function, useful for tests, to set
// the current Merkle root.
func (dl *DaemonLocal) SetCurrentMerkleRoot(
	root keybase1.MerkleRootV2, rootTime time.Time) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	dl.merkleRoot = root
	dl.merkleTime = rootTime
}

// CurrentSession implements the KeybaseService interface for
// DaemonLocal.
func (dl *DaemonLocal) CurrentSession(ctx context.Context, sessionID int) (
	SessionInfo, error) {
	if err := checkContext(ctx); err != nil {
		return SessionInfo{}, err
	}

	dl.lock.Lock()
	defer dl.lock.Unlock()
	u, err := dl.localUsers.getLocalUser(dl.currentUID)
	if err != nil {
		return SessionInfo{}, err
	}
	return SessionInfo{
		Name:           u.Name,
		UID:            u.UID,
		CryptPublicKey: u.GetCurrentCryptPublicKey(),
		VerifyingKey:   u.GetCurrentVerifyingKey(),
	}, nil
}

// AddNewAssertionForTest makes newAssertion, which should be a single
// assertion that doesn't already resolve to anything, resolve to the
// same UID as oldAssertion, which should be an arbitrary assertion
// that does already resolve to something.  It returns the UID of the
// user associated with the given assertions.
func (dl *DaemonLocal) AddNewAssertionForTest(
	oldAssertion, newAssertion string) (keybase1.UID, error) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	id, err := dl.assertionToIDLocked(context.Background(), oldAssertion)
	if err != nil {
		return keybase1.UID(""), err
	}
	uid := id.AsUserOrBust()

	lu, err := dl.localUsers.getLocalUser(uid)
	if err != nil {
		return keybase1.UID(""), err
	}
	lu.Asserts = append(lu.Asserts, newAssertion)
	dl.asserts[newAssertion] = id
	dl.localUsers[uid] = lu
	return uid, nil
}

// AddNewAssertionForTestOrBust is like AddNewAssertionForTest, but
// panics if there's an error.
func (dl *DaemonLocal) AddNewAssertionForTestOrBust(
	oldAssertion, newAssertion string) keybase1.UID {
	uid, err := dl.AddNewAssertionForTest(oldAssertion, newAssertion)
	if err != nil {
		panic(err)
	}
	return uid
}

// ChangeTeamNameForTest updates the name of an existing team.
func (dl *DaemonLocal) ChangeTeamNameForTest(
	oldName, newName string) (keybase1.TeamID, error) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	oldAssert := oldName + "@team"
	newAssert := newName + "@team"

	id, ok := dl.asserts[oldAssert]
	if !ok {
		return keybase1.TeamID(""),
			fmt.Errorf("No such old team name: %s", oldName)
	}
	tid, err := id.AsTeam()
	if err != nil {
		return keybase1.TeamID(""), err
	}

	team, ok := dl.localTeams[tid]
	if !ok {
		return keybase1.TeamID(""),
			fmt.Errorf("No such old team name: %s/%s", oldName, tid)
	}
	team.Name = kbname.NormalizedUsername(newName)
	dl.localTeams[tid] = team

	dl.asserts[newAssert] = id
	delete(dl.asserts, oldAssert)
	return tid, nil
}

// RemoveAssertionForTest removes the given assertion.  Should only be
// used by tests.
func (dl *DaemonLocal) RemoveAssertionForTest(assertion string) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	delete(dl.asserts, assertion)
}

// AddTeamWriterForTest adds a writer to a team.  Should only be used
// by tests.
func (dl *DaemonLocal) AddTeamWriterForTest(
	tid keybase1.TeamID, uid keybase1.UID) (
	username kbname.NormalizedUsername, isImplicit bool, err error) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	t, err := dl.localTeams.getLocalTeam(tid)
	if err != nil {
		return "", false, err
	}

	if t.Writers == nil {
		t.Writers = make(map[keybase1.UID]bool)
	}
	t.Writers[uid] = true
	delete(t.Readers, uid)
	dl.localTeams[tid] = t
	_, isImplicit = dl.localImplicitTeams[tid]
	return t.Name, isImplicit, nil
}

// RemoveTeamWriterForTest removes a writer from a team.  Should only
// be used by tests.
func (dl *DaemonLocal) RemoveTeamWriterForTest(
	tid keybase1.TeamID, uid keybase1.UID) (kbname.NormalizedUsername, error) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	t, err := dl.localTeams.getLocalTeam(tid)
	if err != nil {
		return "", err
	}

	if _, ok := t.Writers[uid]; ok {
		u, err := dl.localUsers.getLocalUser(uid)
		if err != nil {
			return "", err
		}
		if t.LastWriters == nil {
			t.LastWriters = make(
				map[kbfscrypto.VerifyingKey]keybase1.MerkleRootV2)
		}
		for _, key := range u.VerifyingKeys {
			t.LastWriters[key] = dl.merkleRoot
		}
	}
	dl.merkleRoot.Seqno++

	delete(t.Writers, uid)
	delete(t.Readers, uid)

	dl.localTeams[tid] = t
	return t.Name, nil
}

// AddTeamReaderForTest adds a reader to a team.  Should only be used
// by tests.
func (dl *DaemonLocal) AddTeamReaderForTest(
	tid keybase1.TeamID, uid keybase1.UID) (kbname.NormalizedUsername, error) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	t, err := dl.localTeams.getLocalTeam(tid)
	if err != nil {
		return "", err
	}

	if t.Writers[uid] {
		// Being a writer already implies being a reader.
		return "", nil
	}

	if t.Readers == nil {
		t.Readers = make(map[keybase1.UID]bool)
	}
	t.Readers[uid] = true
	dl.localTeams[tid] = t
	return t.Name, nil
}

// AddTeamKeyForTest adds a key to a team.  Should only be used by
// tests.
func (dl *DaemonLocal) AddTeamKeyForTest(
	tid keybase1.TeamID, newKeyGen kbfsmd.KeyGen,
	newKey kbfscrypto.TLFCryptKey) error {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	t, err := dl.localTeams.getLocalTeam(tid)
	if err != nil {
		return err
	}

	t.CryptKeys[newKeyGen] = newKey
	if newKeyGen > t.LatestKeyGen {
		t.LatestKeyGen = newKeyGen
		// Only need to save back to the map if we've modified a
		// non-reference type like the latest key gen.
		dl.localTeams[tid] = t
	}
	return nil
}

func (dl *DaemonLocal) addTeamsForTestLocked(teams []TeamInfo) {
	for _, t := range teams {
		dl.localTeams[t.TID] = t
		dl.asserts[string(t.Name)+"@team"] = t.TID.AsUserOrTeam()
	}
}

// AddTeamsForTest adds teams to this daemon.  Should only be used by
// tests.
func (dl *DaemonLocal) AddTeamsForTest(teams []TeamInfo) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	dl.addTeamsForTestLocked(teams)
}

// GetLocalUser returns the `LocalUser` object for the given UID.
func (dl *DaemonLocal) GetLocalUser(uid keybase1.UID) (LocalUser, error) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	return dl.localUsers.getLocalUser(uid)
}

// SetLocalUser sets the `LocalUser` object for the given UID.
func (dl *DaemonLocal) SetLocalUser(uid keybase1.UID, user LocalUser) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	dl.localUsers[uid] = user
}

// GetIDForAssertion returns the UID associated with the given
// assertion.
func (dl *DaemonLocal) GetIDForAssertion(assertion string) (
	keybase1.UserOrTeamID, bool) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	id, ok := dl.asserts[assertion]
	return id, ok
}

// GetLocalUsers returns all of the users tracked by this daemon.
func (dl *DaemonLocal) GetLocalUsers() (res []LocalUser) {
	dl.lock.Lock()
	defer dl.lock.Unlock()
	for _, u := range dl.localUsers {
		res = append(res, u)
	}
	return res
}

// NewDaemonLocal constructs a new DaemonLocal, initialized to contain
// the given users and teams.
func NewDaemonLocal(
	currentUID keybase1.UID, users []LocalUser,
	teams []TeamInfo, codec kbfscodec.Codec) *DaemonLocal {
	localUserMap := make(localUserMap)
	asserts := make(map[string]keybase1.UserOrTeamID)
	for _, u := range users {
		localUserMap[u.UID] = u
		for _, a := range u.Asserts {
			asserts[a] = u.UID.AsUserOrTeam()
		}
		asserts[string(u.Name)] = u.UID.AsUserOrTeam()
	}
	dl := &DaemonLocal{
		codec:              codec,
		localUsers:         localUserMap,
		localTeams:         make(localTeamMap),
		localTeamSettings:  make(localTeamSettingsMap),
		localImplicitTeams: make(localImplicitTeamMap),
		asserts:            asserts,
		implicitAsserts:    make(map[string]keybase1.TeamID),
		currentUID:         currentUID,
		// TODO: let test fill in valid merkle root.
	}
	dl.AddTeamsForTest(teams)
	return dl
}
