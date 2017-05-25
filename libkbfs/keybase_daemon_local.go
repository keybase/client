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
	lock          sync.Mutex
	localUsers    localUserMap
	localTeams    localTeamMap
	currentUID    keybase1.UID
	asserts       map[string]keybase1.UID
	favoriteStore favoriteStore
}

var _ KeybaseService = &KeybaseDaemonLocal{}

func (k *KeybaseDaemonLocal) setCurrentUID(uid keybase1.UID) {
	k.lock.Lock()
	defer k.lock.Unlock()
	// TODO: Send out notifications.
	k.currentUID = uid
}

func (k *KeybaseDaemonLocal) assertionToUIDLocked(ctx context.Context,
	assertion string) (uid keybase1.UID, err error) {
	expr, err := externals.AssertionParseAndOnly(assertion)
	if err != nil {
		return keybase1.UID(""), err
	}
	urls := expr.CollectUrls(nil)
	if len(urls) == 0 {
		return keybase1.UID(""), errors.New("No assertion URLs")
	}

	for _, url := range urls {
		var currUID keybase1.UID
		if url.IsUID() {
			currUID = url.ToUID()
		} else {
			key, val := url.ToKeyValuePair()
			a := fmt.Sprintf("%s@%s", val, key)
			if url.IsKeybase() {
				a = val
			}
			var ok bool
			currUID, ok = k.asserts[a]
			if !ok {
				return keybase1.UID(""), NoSuchUserError{a}
			}
		}
		if uid != keybase1.UID("") && currUID != uid {
			return keybase1.UID(""),
				errors.New("AND assertions resolve to different UIDs")
		}
		uid = currUID
	}
	return uid, nil
}

// Resolve implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	if err := checkContext(ctx); err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	k.lock.Lock()
	defer k.lock.Unlock()

	uid, err := k.assertionToUIDLocked(ctx, assertion)
	if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	return k.localUsers[uid].Name, uid.AsUserOrTeam(), nil
}

// Identify implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) Identify(
	ctx context.Context, assertion, reason string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	if err := checkContext(ctx); err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	uid, err := k.assertionToUIDLocked(ctx, assertion)
	if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	u, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
	}

	return u.Name, u.UID.AsUserOrTeam(), nil
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
	ctx context.Context, tid keybase1.TeamID) (TeamInfo, error) {
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
	uid, err := k.assertionToUIDLocked(context.Background(), oldAssertion)
	if err != nil {
		return keybase1.UID(""), err
	}

	lu, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return keybase1.UID(""), err
	}
	lu.Asserts = append(lu.Asserts, newAssertion)
	k.asserts[newAssertion] = uid
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
	if err := checkContext(ctx); err != nil {
		return err
	}

	return nil
}

// NotifySyncStatus implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) NotifySyncStatus(ctx context.Context,
	_ *keybase1.FSPathSyncStatus) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	return nil
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
	asserts := make(map[string]keybase1.UID)
	for _, u := range users {
		localUserMap[u.UID] = u
		for _, a := range u.Asserts {
			asserts[a] = u.UID
		}
		asserts[string(u.Name)] = u.UID
	}
	localTeamMap := make(localTeamMap)
	for _, t := range teams {
		localTeamMap[t.TID] = t
	}
	return &KeybaseDaemonLocal{
		codec:         codec,
		localUsers:    localUserMap,
		localTeams:    localTeamMap,
		asserts:       asserts,
		currentUID:    currentUID,
		favoriteStore: favoriteStore,
	}
}
