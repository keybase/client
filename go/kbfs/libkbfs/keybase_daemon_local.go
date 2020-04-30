// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/ldbutils"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/util"
)

type favoriteStore interface {
	FavoriteAdd(uid keybase1.UID, folder keybase1.FolderHandle) error
	FavoriteDelete(uid keybase1.UID, folder keybase1.FolderHandle) error
	FavoriteList(uid keybase1.UID) ([]keybase1.Folder, error)

	Shutdown()
}

type diskFavoriteClient struct {
	favoriteDb *leveldb.DB
	codec      kbfscodec.Codec
}

var _ favoriteStore = diskFavoriteClient{}

func (c diskFavoriteClient) favkey(
	uid keybase1.UID, folder keybase1.FolderHandle) []byte {
	return []byte(fmt.Sprintf("%s:%s", uid, folder.ToString()))
}

func (c diskFavoriteClient) FavoriteAdd(
	uid keybase1.UID, folder keybase1.FolderHandle) error {
	enc, err := c.codec.Encode(folder)
	if err != nil {
		return err
	}

	return c.favoriteDb.Put(c.favkey(uid, folder), enc, nil)
}

func (c diskFavoriteClient) FavoriteDelete(
	uid keybase1.UID, folder keybase1.FolderHandle) error {
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
	favorites map[keybase1.UID]map[string]keybase1.FolderHandle
}

var _ favoriteStore = memoryFavoriteClient{}

func (c memoryFavoriteClient) FavoriteAdd(
	uid keybase1.UID, folder keybase1.FolderHandle) error {
	if c.favorites[uid] == nil {
		c.favorites[uid] = make(map[string]keybase1.FolderHandle)
	}
	c.favorites[uid][folder.ToString()] = folder
	return nil
}

func (c memoryFavoriteClient) FavoriteDelete(
	uid keybase1.UID, folder keybase1.FolderHandle) error {
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
		folders[i] = keybase1.Folder{
			Name:       v.Name,
			FolderType: v.FolderType,
		}
		i++
	}
	return folders, nil
}

func (c memoryFavoriteClient) Shutdown() {}

// KeybaseDaemonLocal implements KeybaseDaemon using an in-memory user
// and session store, and a given favorite store.
type KeybaseDaemonLocal struct {
	*idutil.DaemonLocal

	// lock protects everything below.
	lock          sync.Mutex
	favoriteStore favoriteStore
}

var _ KeybaseService = &KeybaseDaemonLocal{}

type makeKeysFunc func(kbname.NormalizedUsername, int) (
	kbfscrypto.CryptPublicKey, kbfscrypto.VerifyingKey)

func (k *KeybaseDaemonLocal) addDeviceForTesting(uid keybase1.UID,
	makeKeys makeKeysFunc) (int, error) {
	k.lock.Lock()
	defer k.lock.Unlock()

	user, err := k.GetLocalUser(uid)
	if err != nil {
		return 0, fmt.Errorf("No such user %s: %v", uid, err)
	}
	user = user.DeepCopy()

	index := len(user.VerifyingKeys)
	newCryptPublicKey, newVerifyingKey := makeKeys(user.Name, index)
	user.VerifyingKeys = append(user.VerifyingKeys, newVerifyingKey)
	user.CryptPublicKeys = append(user.CryptPublicKeys, newCryptPublicKey)

	k.SetLocalUser(uid, user)
	return index, nil
}

func (k *KeybaseDaemonLocal) revokeDeviceForTesting(clock Clock,
	uid keybase1.UID, index int) error {
	k.lock.Lock()
	defer k.lock.Unlock()

	user, err := k.GetLocalUser(uid)
	if err != nil {
		return fmt.Errorf("No such user %s: %v", uid, err)
	}
	user = user.DeepCopy()

	session, err := k.CurrentSession(context.TODO(), 0)
	if err != nil {
		return err
	}

	if index >= len(user.VerifyingKeys) ||
		(session.UID == uid && index == user.CurrentCryptPublicKeyIndex) {
		return fmt.Errorf("Can't revoke index %d", index)
	}

	if user.RevokedVerifyingKeys == nil {
		user.RevokedVerifyingKeys =
			make(map[kbfscrypto.VerifyingKey]idutil.RevokedKeyInfo)
	}
	if user.RevokedCryptPublicKeys == nil {
		user.RevokedCryptPublicKeys =
			make(map[kbfscrypto.CryptPublicKey]idutil.RevokedKeyInfo)
	}

	kbtime := keybase1.ToTime(clock.Now())
	info := idutil.RevokedKeyInfo{
		Time: kbtime,
		MerkleRoot: keybase1.MerkleRootV2{
			Seqno: 1,
		},
	}
	user.RevokedVerifyingKeys[user.VerifyingKeys[index]] = info
	user.RevokedCryptPublicKeys[user.CryptPublicKeys[index]] = info

	user.VerifyingKeys = append(user.VerifyingKeys[:index],
		user.VerifyingKeys[index+1:]...)
	user.CryptPublicKeys = append(user.CryptPublicKeys[:index],
		user.CryptPublicKeys[index+1:]...)

	if session.UID == uid && index < user.CurrentCryptPublicKeyIndex {
		user.CurrentCryptPublicKeyIndex--
	}
	if session.UID == uid && index < user.CurrentVerifyingKeyIndex {
		user.CurrentVerifyingKeyIndex--
	}

	k.SetLocalUser(uid, user)
	return nil
}

func (k *KeybaseDaemonLocal) switchDeviceForTesting(uid keybase1.UID,
	index int) error {
	k.lock.Lock()
	defer k.lock.Unlock()

	user, err := k.GetLocalUser(uid)
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

	k.SetLocalUser(uid, user)
	return nil
}

func (k *KeybaseDaemonLocal) addTeamWriterForTest(
	tid keybase1.TeamID, uid keybase1.UID) error {
	k.lock.Lock()
	defer k.lock.Unlock()
	teamName, isImplicit, err := k.DaemonLocal.AddTeamWriterForTest(tid, uid)
	if err != nil {
		return err
	}
	if !isImplicit {
		f := keybase1.FolderHandle{
			Name:       string(teamName),
			FolderType: keybase1.FolderType_TEAM,
		}
		err := k.favoriteStore.FavoriteAdd(uid, f)
		if err != nil {
			return err
		}
	}
	return nil
}

func (k *KeybaseDaemonLocal) removeTeamWriterForTest(
	tid keybase1.TeamID, uid keybase1.UID) error {
	k.lock.Lock()
	defer k.lock.Unlock()
	teamName, err := k.DaemonLocal.RemoveTeamWriterForTest(tid, uid)
	if err != nil {
		return err
	}
	f := keybase1.FolderHandle{
		Name:       string(teamName),
		FolderType: keybase1.FolderType_TEAM,
	}
	return k.favoriteStore.FavoriteDelete(uid, f)
}

func (k *KeybaseDaemonLocal) addTeamReaderForTest(
	tid keybase1.TeamID, uid keybase1.UID) error {
	k.lock.Lock()
	defer k.lock.Unlock()
	teamName, err := k.DaemonLocal.AddTeamReaderForTest(tid, uid)
	if err != nil {
		return err
	}
	f := keybase1.FolderHandle{
		Name:       string(teamName),
		FolderType: keybase1.FolderType_TEAM,
	}
	return k.favoriteStore.FavoriteAdd(uid, f)
}

func (k *KeybaseDaemonLocal) addTeamsForTestLocked(teams []idutil.TeamInfo) {
	k.DaemonLocal.AddTeamsForTest(teams)
	for _, t := range teams {
		f := keybase1.FolderHandle{
			Name:       string(t.Name),
			FolderType: keybase1.FolderType_TEAM,
		}
		for u := range t.Writers {
			_ = k.favoriteStore.FavoriteAdd(u, f)
		}
		for u := range t.Readers {
			_ = k.favoriteStore.FavoriteAdd(u, f)
		}
	}
}

func (k *KeybaseDaemonLocal) addTeamsForTest(teams []idutil.TeamInfo) {
	k.lock.Lock()
	defer k.lock.Unlock()
	k.addTeamsForTestLocked(teams)
}

// FavoriteAdd implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FavoriteAdd(
	ctx context.Context, folder keybase1.FolderHandle) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	session, err := k.CurrentSession(ctx, 0)
	if err != nil {
		return err
	}
	return k.favoriteStore.FavoriteAdd(session.UID, folder)
}

// FavoriteDelete implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FavoriteDelete(
	ctx context.Context, folder keybase1.FolderHandle) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	k.lock.Lock()
	defer k.lock.Unlock()
	session, err := k.CurrentSession(ctx, 0)
	if err != nil {
		return err
	}
	return k.favoriteStore.FavoriteDelete(session.UID, folder)
}

// FavoriteList implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FavoriteList(
	ctx context.Context, sessionID int) (keybase1.FavoritesResult, error) {
	if err := checkContext(ctx); err != nil {
		return keybase1.FavoritesResult{}, err
	}

	k.lock.Lock()
	defer k.lock.Unlock()

	session, err := k.CurrentSession(ctx, 0)
	if err != nil {
		return keybase1.FavoritesResult{}, err
	}

	// This is only used for testing, so it's okay to only have favorites here.
	favs, err := k.favoriteStore.FavoriteList(session.UID)
	if err != nil {
		return keybase1.FavoritesResult{}, err
	}
	return keybase1.FavoritesResult{
		FavoriteFolders: favs,
		IgnoredFolders:  []keybase1.Folder{},
		NewFolders:      []keybase1.Folder{},
	}, nil
}

// EncryptFavorites implements KeybaseService for KeybaseDaemonLocal
func (k *KeybaseDaemonLocal) EncryptFavorites(ctx context.Context,
	dataToEncrypt []byte) ([]byte, error) {
	return nil, checkContext(ctx)
}

// DecryptFavorites implements KeybaseService for KeybaseDaemonLocal
func (k *KeybaseDaemonLocal) DecryptFavorites(ctx context.Context,
	dataToDecrypt []byte) ([]byte, error) {
	return nil, checkContext(ctx)
}

// NotifyOnlineStatusChanged implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) NotifyOnlineStatusChanged(ctx context.Context, online bool) error {
	return checkContext(ctx)
}

// NotifyFavoritesChanged implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) NotifyFavoritesChanged(ctx context.Context) error {
	return checkContext(ctx)
}

// Notify implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return checkContext(ctx)
}

// NotifyPathUpdated implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) NotifyPathUpdated(
	ctx context.Context, _ string) error {
	return checkContext(ctx)
}

// NotifySyncStatus implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) NotifySyncStatus(ctx context.Context,
	_ *keybase1.FSPathSyncStatus) error {
	return checkContext(ctx)
}

// NotifyOverallSyncStatus implements KeybaseDaemon for KeybaseDeamonLocal.
func (k *KeybaseDaemonLocal) NotifyOverallSyncStatus(
	ctx context.Context, _ keybase1.FolderSyncStatus) error {
	return checkContext(ctx)
}

// FlushUserFromLocalCache implements the KeybaseDaemon interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) FlushUserFromLocalCache(ctx context.Context,
	uid keybase1.UID) {
	// Do nothing.
}

// ClearCaches implements the KeybaseDaemon interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) ClearCaches(_ context.Context) {
	// Do nothing.
}

// EstablishMountDir implements the KeybaseDaemon interface for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) EstablishMountDir(ctx context.Context) (string, error) {
	return "", nil
}

// PutGitMetadata implements the KeybaseService interface for
// KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) PutGitMetadata(
	ctx context.Context, folder keybase1.FolderHandle, repoID keybase1.RepoID,
	metadata keybase1.GitLocalMetadata) error {
	return nil
}

// OnPathChange implements the SubscriptionNotifier interface.
func (k *KeybaseDaemonLocal) OnPathChange(
	clientID SubscriptionManagerClientID,
	subscriptionIDs []SubscriptionID, path string, topics []keybase1.PathSubscriptionTopic) {
}

// OnNonPathChange implements the SubscriptionNotifier interface.
func (k *KeybaseDaemonLocal) OnNonPathChange(
	clientID SubscriptionManagerClientID,
	subscriptionIDs []SubscriptionID, topic keybase1.SubscriptionTopic) {
}

func (k *KeybaseDaemonLocal) GetKVStoreClient() keybase1.KvstoreInterface {
	return nil
}

// Shutdown implements KeybaseDaemon for KeybaseDaemonLocal.
func (k *KeybaseDaemonLocal) Shutdown() {
	k.favoriteStore.Shutdown()
}

func newKeybaseDaemonLocal(
	codec kbfscodec.Codec, currentUID keybase1.UID, users []idutil.LocalUser,
	teams []idutil.TeamInfo, favoriteStore favoriteStore) *KeybaseDaemonLocal {
	k := &KeybaseDaemonLocal{
		DaemonLocal:   idutil.NewDaemonLocal(currentUID, users, teams, codec),
		favoriteStore: favoriteStore,
	}
	return k
}

// NewKeybaseDaemonDisk constructs a KeybaseDaemonLocal object given a
// set of possible users, and one user that should be "logged in".
// Any storage (e.g. the favorites) persists to disk.
func NewKeybaseDaemonDisk(currentUID keybase1.UID, users []idutil.LocalUser,
	teams []idutil.TeamInfo, favDBFile string, codec kbfscodec.Codec) (
	*KeybaseDaemonLocal, error) {
	favoriteDb, err := leveldb.OpenFile(favDBFile, ldbutils.LeveldbOptions(nil))
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
	users []idutil.LocalUser, teams []idutil.TeamInfo,
	codec kbfscodec.Codec) *KeybaseDaemonLocal {
	favoriteStore := memoryFavoriteClient{
		favorites: make(map[keybase1.UID]map[string]keybase1.FolderHandle),
	}
	return newKeybaseDaemonLocal(codec, currentUID, users, teams, favoriteStore)
}
