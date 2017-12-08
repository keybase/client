// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/util"
)

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

type localImplicitTeamMap map[keybase1.TeamID]ImplicitTeamInfo

func (m localImplicitTeamMap) getLocalImplicitTeam(
	tid keybase1.TeamID) (ImplicitTeamInfo, error) {
	team, ok := m[tid]
	if !ok {
		return ImplicitTeamInfo{}, NoSuchTeamError{tid.String()}
	}
	return team, nil
}

type favoriteStore interface {
	FavoriteAdd(uid keybase1.UID, folder keybase1.Folder) error
	FavoriteDelete(uid keybase1.UID, folder keybase1.Folder) error
	FavoriteList(uid keybase1.UID) ([]keybase1.Folder, error)

	Shutdown()
}

type diskFavoriteClient struct {
	favoriteDb *leveldb.DB
	codec      kbfscodec.Codec
}

var _ favoriteStore = diskFavoriteClient{}

func (c diskFavoriteClient) favkey(
	uid keybase1.UID, folder keybase1.Folder) []byte {
	return []byte(fmt.Sprintf("%s:%s", uid, folder.ToString()))
}

func (c diskFavoriteClient) FavoriteAdd(
	uid keybase1.UID, folder keybase1.Folder) error {
	enc, err := c.codec.Encode(folder)
	if err != nil {
		return err
	}

	return c.favoriteDb.Put(c.favkey(uid, folder), enc, nil)
}

func (c diskFavoriteClient) FavoriteDelete(
	uid keybase1.UID, folder keybase1.Folder) error {
	return c.favoriteDb.Delete(c.favkey(uid, folder), nil)
}

func (c diskFavoriteClient) FavoriteList(uid keybase1.UID) (
	[]keybase1.Folder, error) {
	iter := c.favoriteDb.NewIterator(util.BytesPrefix([]byte(uid+":")), nil)
	defer iter.Release()
	var folders []keybase1.Folder
	for iter.Next() {
		var folder keybase1.Folder
		if err := c.codec.Decode(iter.Value(), &folder); err != nil {
			return nil, err
		}
		folders = append(folders, folder)
	}
	if err := iter.Error(); err != nil {
		return nil, err
	}

	return folders, nil
}

func (c diskFavoriteClient) Shutdown() {
	c.favoriteDb.Close()
}

type memoryFavoriteClient struct {
	favorites map[keybase1.UID]map[string]keybase1.Folder
}

var _ favoriteStore = memoryFavoriteClient{}

func (c memoryFavoriteClient) FavoriteAdd(
	uid keybase1.UID, folder keybase1.Folder) error {
	if c.favorites[uid] == nil {
		c.favorites[uid] = make(map[string]keybase1.Folder)
	}
	c.favorites[uid][folder.ToString()] = folder
	return nil
}

func (c memoryFavoriteClient) FavoriteDelete(
	uid keybase1.UID, folder keybase1.Folder) error {
	if c.favorites[uid] != nil {
		delete(c.favorites[uid], folder.ToString())
	}
	return nil
}

func (c memoryFavoriteClient) FavoriteList(
	uid keybase1.UID) ([]keybase1.Folder, error) {
	folders := make([]keybase1.Folder, len(c.favorites[uid]))
	i := 0
	for _, v := range c.favorites[uid] {
		folders[i] = v
		i++
	}
	return folders, nil
}

func (c memoryFavoriteClient) Shutdown() {}

// KeybaseDaemonLocal implements KeybaseDaemon using an in-memory user
// and session store, and a given favorite store.
type KeybaseDaemonLocal struct {
	codec kbfscodec.Codec

	// lock protects everything below.
	lock               sync.Mutex
	localUsers         localUserMap
	localTeams         localTeamMap
	localImplicitTeams localImplicitTeamMap
	currentUID         keybase1.UID
	asserts            map[string]keybase1.UserOrTeamID
	implicitAsserts    map[string]keybase1.TeamID
	favoriteStore      favoriteStore
	merkleRoot         keybase1.MerkleRootV2
}

var _ KeybaseService = &KeybaseDaemonLocal{}

func (k *KeybaseDaemonLocal) setCurrentUID(uid keybase1.UID) {
	k.lock.Lock()
	defer k.lock.Unlock()
	// TODO: Send out notifications.
	k.currentUID = uid
}

func (k *KeybaseDaemonLocal) assertionToIDLocked(ctx context.Context,
	assertion string) (id keybase1.UserOrTeamID, err error) {
	expr, err := externals.AssertionParseAndOnly(assertion)
	if err != nil {
		return keybase1.UserOrTeamID(""), err
	}
	urls := expr.CollectUrls(nil)
	if len(urls) == 0 {
		return keybase1.UserOrTeamID(""), errors.New("No assertion URLs")
	}

	for _, url := range urls {
		var currID keybase1.UserOrTeamID
		if url.IsUID() {
			currID = url.ToUID().AsUserOrTeam()
		} else if url.IsTeamID() {
			currID = url.ToTeamID().AsUserOrTeam()
		} else {
			key, val := url.ToKeyValuePair()
			a := fmt.Sprintf("%s@%s", val, key)
			if url.IsKeybase() && key != "team" {
				a = val
			}
			var ok bool
			currID, ok = k.asserts[a]
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

// Resolve implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	if err := checkContext(ctx); err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	id, err := k.assertionToIDLocked(ctx, assertion)
	if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	if id.IsUser() {
		u, err := k.localUsers.getLocalUser(id.AsUserOrBust())
		if err != nil {
			return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
		}
		return u.Name, id, nil
	}

	// Otherwise it's a team
	ti, err := k.localTeams.getLocalTeam(id.AsTeamOrBust())
	if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	_, ok := k.localImplicitTeams[id.AsTeamOrBust()]
	if ok {
		// An implicit team exists, so Resolve shouldn't work.
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			fmt.Errorf("Team ID %s is an implicit team", id)
	}

	return ti.Name, id, nil
}

// Identify implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) Identify(
	ctx context.Context, assertion, _ string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	// The local daemon doesn't need to distinguish resolves from
	// identifies.
	return k.Resolve(ctx, assertion)
}

func (k *KeybaseDaemonLocal) resolveForImplicitTeam(
	ctx context.Context, name string, r []libkb.NormalizedUsername,
	ur []keybase1.SocialAssertion,
	resolvedIDs map[libkb.NormalizedUsername]keybase1.UserOrTeamID) (
	[]libkb.NormalizedUsername, []keybase1.SocialAssertion, error) {
	id, err := k.assertionToIDLocked(ctx, name)
	if err == nil {
		u, err := k.localUsers.getLocalUser(id.AsUserOrBust())
		if err != nil {
			return nil, nil, err
		}
		r = append(r, u.Name)
		resolvedIDs[u.Name] = id
	} else {
		a, ok := externals.NormalizeSocialAssertion(name)
		if !ok {
			return nil, nil, fmt.Errorf("Bad assertion: %s", name)
		}
		ur = append(ur, a)
	}
	return r, ur, nil
}

// ResolveIdentifyImplicitTeam implements the KeybaseService interface
// for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) ResolveIdentifyImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	doIdentifies bool, reason string) (ImplicitTeamInfo, error) {
	if err := checkContext(ctx); err != nil {
		return ImplicitTeamInfo{}, err
	}

	if tlfType != tlf.Private && tlfType != tlf.Public {
		return ImplicitTeamInfo{}, fmt.Errorf(
			"Invalid implicit team TLF type: %s", tlfType)
	}

	k.lock.Lock()
	defer k.lock.Unlock()

	// Canonicalize the name.
	writerNames, readerNames, _, err :=
		splitAndNormalizeTLFName(assertions, tlfType)
	if err != nil {
		return ImplicitTeamInfo{}, err
	}
	var writers, readers []libkb.NormalizedUsername
	var unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion
	resolvedIDs := make(map[libkb.NormalizedUsername]keybase1.UserOrTeamID)
	for _, w := range writerNames {
		writers, unresolvedWriters, err = k.resolveForImplicitTeam(
			ctx, w, writers, unresolvedWriters, resolvedIDs)
		if err != nil {
			return ImplicitTeamInfo{}, err
		}
	}
	for _, r := range readerNames {
		readers, unresolvedReaders, err = k.resolveForImplicitTeam(
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
	tid, ok := k.implicitAsserts[key]
	if ok {
		return k.localImplicitTeams[tid], nil
	}

	// If the implicit team doesn't exist, always create it.

	// Need to make the team info as well, so get the list of user
	// names and resolve them.  Auto-generate an implicit team name.
	implicitName := libkb.NormalizedUsername(
		fmt.Sprintf("_implicit_%d", len(k.localTeams)))
	teams := makeLocalTeams(
		[]libkb.NormalizedUsername{implicitName}, len(k.localTeams), tlfType)
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
	k.implicitAsserts[key] = tid
	k.localTeams[tid] = info

	asUserName := libkb.NormalizedUsername(name)
	iteamInfo := ImplicitTeamInfo{
		// TODO: use the "preferred" canonical format here by listing
		// the logged-in user first?
		Name: asUserName,
		TID:  tid,
	}
	k.localImplicitTeams[tid] = iteamInfo
	return iteamInfo, nil
}

// ResolveImplicitTeamByID implements the KeybaseService interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) ResolveImplicitTeamByID(
	ctx context.Context, teamID keybase1.TeamID) (name string, err error) {
	if err := checkContext(ctx); err != nil {
		return "", err
	}

	k.lock.Lock()
	defer k.lock.Unlock()

	info, ok := k.localImplicitTeams[teamID]
	if !ok {
		return "", NoSuchTeamError{teamID.String()}
	}
	return info.Name.String(), nil
}

func (k *KeybaseDaemonLocal) addImplicitTeamTlfID(
	tid keybase1.TeamID, tlfID tlf.ID) error {
	// TODO: add check to make sure the private/public suffix of the
	// team ID matches that of the tlf ID.
	k.lock.Lock()
	defer k.lock.Unlock()
	iteamInfo, ok := k.localImplicitTeams[tid]
	if !ok {
		return NoSuchTeamError{tid.String()}
	}
	iteamInfo.TlfID = tlfID
	k.localImplicitTeams[tid] = iteamInfo
	return nil
}

// LoadUserPlusKeys implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) LoadUserPlusKeys(ctx context.Context,
	uid keybase1.UID, _ keybase1.KID) (UserInfo, error) {
	if err := checkContext(ctx); err != nil {
		return UserInfo{}, err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	u, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return UserInfo{}, err
	}

	var infoCopy UserInfo
	if err := kbfscodec.Update(k.codec, &infoCopy, u.UserInfo); err != nil {
		return UserInfo{}, err
	}
	return infoCopy, nil
}

// LoadTeamPlusKeys implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) LoadTeamPlusKeys(
	ctx context.Context, tid keybase1.TeamID, _ kbfsmd.KeyGen, _ keybase1.UserVersion,
	_ keybase1.TeamRole) (TeamInfo, error) {
	if err := checkContext(ctx); err != nil {
		return TeamInfo{}, err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	t, err := k.localTeams.getLocalTeam(tid)
	if err != nil {
		return TeamInfo{}, err
	}

	// Copy the info since it contains a map that might be mutated.
	var infoCopy TeamInfo
	if err := kbfscodec.Update(k.codec, &infoCopy, t); err != nil {
		return TeamInfo{}, err
	}
	return infoCopy, nil
}

// CreateTeamTLF implements the KBPKI interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) CreateTeamTLF(
	ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) (err error) {
	// For now, only support implicit teams; regular teams will get a
	// NoSuchTeamError.  TODO: when the keybase1 RPCs allow it, store
	// the TLF ID along with the regular team info.
	//
	// Note that this only adds the implicit team TLF to this instance
	// of KeybaseDaemonLocal; the caller would have to make the call
	// to all instances to make it global.  However, the IDs are
	// always deterministic so any client who thinks the ID is missing
	// will just generate the same one.  TODO: abstract out the users
	// and teams into a shareable module among all the instances.
	return k.addImplicitTeamTlfID(teamID, tlfID)
}

// LoadUnverifiedKeys implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) LoadUnverifiedKeys(ctx context.Context, uid keybase1.UID) (
	[]keybase1.PublicKey, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	u, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return u.UnverifiedKeys, nil
}

// GetCurrentMerkleRoot implements the KeybaseService interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) GetCurrentMerkleRoot(ctx context.Context) (
	keybase1.MerkleRootV2, error) {
	if err := checkContext(ctx); err != nil {
		return keybase1.MerkleRootV2{}, err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	return k.merkleRoot, nil
}

// CurrentSession implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) CurrentSession(ctx context.Context, sessionID int) (
	SessionInfo, error) {
	if err := checkContext(ctx); err != nil {
		return SessionInfo{}, err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	u, err := k.localUsers.getLocalUser(k.currentUID)
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

// addNewAssertionForTest makes newAssertion, which should be a single
// assertion that doesn't already resolve to anything, resolve to the
// same UID as oldAssertion, which should be an arbitrary assertion
// that does already resolve to something.  It returns the UID of the
// user associated with the given assertions.
func (k *KeybaseDaemonLocal) addNewAssertionForTest(
	oldAssertion, newAssertion string) (keybase1.UID, error) {
	k.lock.Lock()
	defer k.lock.Unlock()
	id, err := k.assertionToIDLocked(context.Background(), oldAssertion)
	if err != nil {
		return keybase1.UID(""), err
	}
	uid := id.AsUserOrBust()

	lu, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return keybase1.UID(""), err
	}
	lu.Asserts = append(lu.Asserts, newAssertion)
	k.asserts[newAssertion] = id
	k.localUsers[uid] = lu
	return uid, nil
}

// addNewAssertionForTestOrBust is like addNewAssertionForTest, but
// panics if there's an error.
func (k *KeybaseDaemonLocal) addNewAssertionForTestOrBust(
	oldAssertion, newAssertion string) keybase1.UID {
	uid, err := k.addNewAssertionForTest(oldAssertion, newAssertion)
	if err != nil {
		panic(err)
	}
	return uid
}

// changeTeamNameForTest updates the name of an existing team.
func (k *KeybaseDaemonLocal) changeTeamNameForTest(
	oldName, newName string) (keybase1.TeamID, error) {
	k.lock.Lock()
	defer k.lock.Unlock()
	oldAssert := oldName + "@team"
	newAssert := newName + "@team"

	id, ok := k.asserts[oldAssert]
	if !ok {
		return keybase1.TeamID(""),
			fmt.Errorf("No such old team name: %s", oldName)
	}
	tid, err := id.AsTeam()
	if err != nil {
		return keybase1.TeamID(""), err
	}

	team, ok := k.localTeams[tid]
	if !ok {
		return keybase1.TeamID(""),
			fmt.Errorf("No such old team name: %s/%s", oldName, tid)
	}
	team.Name = libkb.NormalizedUsername(newName)
	k.localTeams[tid] = team

	k.asserts[newAssert] = id
	delete(k.asserts, oldAssert)
	return tid, nil
}

// changeTeamNameForTestOrBust is like changeTeamNameForTest, but
// panics if there's an error.
func (k *KeybaseDaemonLocal) changeTeamNameForTestOrBust(
	oldName, newName string) keybase1.TeamID {
	tid, err := k.changeTeamNameForTest(oldName, newName)
	if err != nil {
		panic(err)
	}
	return tid
}

func (k *KeybaseDaemonLocal) removeAssertionForTest(assertion string) {
	k.lock.Lock()
	defer k.lock.Unlock()
	delete(k.asserts, assertion)
}

type makeKeysFunc func(libkb.NormalizedUsername, int) (
	kbfscrypto.CryptPublicKey, kbfscrypto.VerifyingKey)

func (k *KeybaseDaemonLocal) addDeviceForTesting(uid keybase1.UID,
	makeKeys makeKeysFunc) (int, error) {
	k.lock.Lock()
	defer k.lock.Unlock()

	user, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return 0, fmt.Errorf("No such user %s: %v", uid, err)
	}

	index := len(user.VerifyingKeys)
	newCryptPublicKey, newVerifyingKey := makeKeys(user.Name, index)
	user.VerifyingKeys = append(user.VerifyingKeys, newVerifyingKey)
	user.CryptPublicKeys = append(user.CryptPublicKeys, newCryptPublicKey)

	k.localUsers[uid] = user
	return index, nil
}

func (k *KeybaseDaemonLocal) revokeDeviceForTesting(clock Clock,
	uid keybase1.UID, index int) error {
	k.lock.Lock()
	defer k.lock.Unlock()

	user, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return fmt.Errorf("No such user %s: %v", uid, err)
	}

	if index >= len(user.VerifyingKeys) ||
		(k.currentUID == uid && index == user.CurrentCryptPublicKeyIndex) {
		return fmt.Errorf("Can't revoke index %d", index)
	}

	if user.RevokedVerifyingKeys == nil {
		user.RevokedVerifyingKeys =
			make(map[kbfscrypto.VerifyingKey]keybase1.KeybaseTime)
	}
	if user.RevokedCryptPublicKeys == nil {
		user.RevokedCryptPublicKeys =
			make(map[kbfscrypto.CryptPublicKey]keybase1.KeybaseTime)
	}

	kbtime := keybase1.KeybaseTime{
		Unix:  keybase1.ToTime(clock.Now()),
		Chain: 100,
	}
	user.RevokedVerifyingKeys[user.VerifyingKeys[index]] = kbtime
	user.RevokedCryptPublicKeys[user.CryptPublicKeys[index]] = kbtime

	user.VerifyingKeys = append(user.VerifyingKeys[:index],
		user.VerifyingKeys[index+1:]...)
	user.CryptPublicKeys = append(user.CryptPublicKeys[:index],
		user.CryptPublicKeys[index+1:]...)

	if k.currentUID == uid && index < user.CurrentCryptPublicKeyIndex {
		user.CurrentCryptPublicKeyIndex--
	}
	if k.currentUID == uid && index < user.CurrentVerifyingKeyIndex {
		user.CurrentVerifyingKeyIndex--
	}

	k.localUsers[uid] = user
	return nil
}

func (k *KeybaseDaemonLocal) switchDeviceForTesting(uid keybase1.UID,
	index int) error {
	k.lock.Lock()
	defer k.lock.Unlock()

	user, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return fmt.Errorf("No such user %s: %v", uid, err)
	}

	if index >= len(user.CryptPublicKeys) {
		return fmt.Errorf("Wrong crypt public key index: %d", index)
	}
	user.CurrentCryptPublicKeyIndex = index

	if index >= len(user.VerifyingKeys) {
		return fmt.Errorf("Wrong verifying key index: %d", index)
	}
	user.CurrentVerifyingKeyIndex = index
	k.localUsers[uid] = user
	return nil
}

func (k *KeybaseDaemonLocal) addTeamWriterForTest(
	tid keybase1.TeamID, uid keybase1.UID) error {
	k.lock.Lock()
	defer k.lock.Unlock()
	t, err := k.localTeams.getLocalTeam(tid)
	if err != nil {
		return err
	}

	if t.Writers == nil {
		t.Writers = make(map[keybase1.UID]bool)
	}
	t.Writers[uid] = true
	delete(t.Readers, uid)
	k.localTeams[tid] = t
	f := keybase1.Folder{
		Name:       string(t.Name),
		FolderType: keybase1.FolderType_TEAM,
	}
	k.favoriteStore.FavoriteAdd(uid, f)
	return nil
}

func (k *KeybaseDaemonLocal) addTeamReaderForTest(
	tid keybase1.TeamID, uid keybase1.UID) error {
	k.lock.Lock()
	defer k.lock.Unlock()
	t, err := k.localTeams.getLocalTeam(tid)
	if err != nil {
		return err
	}

	if t.Writers[uid] {
		// Being a writer already implies being a reader.
		return nil
	}

	if t.Readers == nil {
		t.Readers = make(map[keybase1.UID]bool)
	}
	t.Readers[uid] = true
	k.localTeams[tid] = t
	f := keybase1.Folder{
		Name:       string(t.Name),
		FolderType: keybase1.FolderType_TEAM,
	}
	k.favoriteStore.FavoriteAdd(uid, f)
	return nil
}

func (k *KeybaseDaemonLocal) addTeamKeyForTest(
	tid keybase1.TeamID, newKeyGen kbfsmd.KeyGen,
	newKey kbfscrypto.TLFCryptKey) error {
	k.lock.Lock()
	defer k.lock.Unlock()
	t, err := k.localTeams.getLocalTeam(tid)
	if err != nil {
		return err
	}

	t.CryptKeys[newKeyGen] = newKey
	if newKeyGen > t.LatestKeyGen {
		t.LatestKeyGen = newKeyGen
		// Only need to save back to the map if we've modified a
		// non-reference type like the latest key gen.
		k.localTeams[tid] = t
	}
	return nil
}

func (k *KeybaseDaemonLocal) addTeamsForTestLocked(teams []TeamInfo) {
	for _, t := range teams {
		k.localTeams[t.TID] = t
		k.asserts[string(t.Name)+"@team"] = t.TID.AsUserOrTeam()
		f := keybase1.Folder{
			Name:       string(t.Name),
			FolderType: keybase1.FolderType_TEAM,
		}
		for u := range t.Writers {
			k.favoriteStore.FavoriteAdd(u, f)
		}
		for u := range t.Readers {
			k.favoriteStore.FavoriteAdd(u, f)
		}
	}
}

func (k *KeybaseDaemonLocal) addTeamsForTest(teams []TeamInfo) {
	k.lock.Lock()
	defer k.lock.Unlock()
	k.addTeamsForTestLocked(teams)
}

// FavoriteAdd implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FavoriteAdd(
	ctx context.Context, folder keybase1.Folder) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	return k.favoriteStore.FavoriteAdd(k.currentUID, folder)
}

// FavoriteDelete implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FavoriteDelete(
	ctx context.Context, folder keybase1.Folder) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	return k.favoriteStore.FavoriteDelete(k.currentUID, folder)
}

// FavoriteList implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FavoriteList(
	ctx context.Context, sessionID int) ([]keybase1.Folder, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	return k.favoriteStore.FavoriteList(k.currentUID)
}

// Notify implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return checkContext(ctx)
}

// NotifySyncStatus implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) NotifySyncStatus(ctx context.Context,
	_ *keybase1.FSPathSyncStatus) error {
	return checkContext(ctx)
}

// FlushUserFromLocalCache implements the KeybaseDaemon interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FlushUserFromLocalCache(ctx context.Context,
	uid keybase1.UID) {
	// Do nothing.
}

// FlushUserUnverifiedKeysFromLocalCache implements the KeybaseDaemon interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FlushUserUnverifiedKeysFromLocalCache(ctx context.Context,
	uid keybase1.UID) {
	// Do nothing.
}

// EstablishMountDir implements the KeybaseDaemon interface for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) EstablishMountDir(ctx context.Context) (string, error) {
	return "", nil
}

// PutGitMetadata implements the KeybaseService interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) PutGitMetadata(
	ctx context.Context, folder keybase1.Folder, repoID keybase1.RepoID,
	repoName keybase1.GitRepoName) error {
	return nil
}

// Shutdown implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) Shutdown() {
	k.favoriteStore.Shutdown()
}

// NewKeybaseDaemonDisk constructs a KeybaseDaemonLocal object given a
// set of possible users, and one user that should be "logged in".
// Any storage (e.g. the favorites) persists to disk.
func NewKeybaseDaemonDisk(currentUID keybase1.UID, users []LocalUser,
	teams []TeamInfo, favDBFile string, codec kbfscodec.Codec) (
	*KeybaseDaemonLocal, error) {
	favoriteDb, err := leveldb.OpenFile(favDBFile, leveldbOptions)
	if err != nil {
		return nil, err
	}
	favoriteStore := diskFavoriteClient{favoriteDb, codec}
	return newKeybaseDaemonLocal(
		codec, currentUID, users, teams, favoriteStore), nil
}

// NewKeybaseDaemonMemory constructs a KeybaseDaemonLocal object given
// a set of possible users, and one user that should be "logged in".
// Any storage (e.g. the favorites) is kept in memory only.
func NewKeybaseDaemonMemory(currentUID keybase1.UID,
	users []LocalUser, teams []TeamInfo,
	codec kbfscodec.Codec) *KeybaseDaemonLocal {
	favoriteStore := memoryFavoriteClient{
		favorites: make(map[keybase1.UID]map[string]keybase1.Folder),
	}
	return newKeybaseDaemonLocal(codec, currentUID, users, teams, favoriteStore)
}

func newKeybaseDaemonLocal(codec kbfscodec.Codec,
	currentUID keybase1.UID, users []LocalUser, teams []TeamInfo,
	favoriteStore favoriteStore) *KeybaseDaemonLocal {
	localUserMap := make(localUserMap)
	asserts := make(map[string]keybase1.UserOrTeamID)
	for _, u := range users {
		localUserMap[u.UID] = u
		for _, a := range u.Asserts {
			asserts[a] = u.UID.AsUserOrTeam()
		}
		asserts[string(u.Name)] = u.UID.AsUserOrTeam()
	}
	k := &KeybaseDaemonLocal{
		codec:              codec,
		localUsers:         localUserMap,
		localTeams:         make(localTeamMap),
		localImplicitTeams: make(localImplicitTeamMap),
		asserts:            asserts,
		implicitAsserts:    make(map[string]keybase1.TeamID),
		currentUID:         currentUID,
		favoriteStore:      favoriteStore,
		// TODO: let test fill in valid merkle root.
	}
	k.addTeamsForTest(teams)
	return k
}
