package libkbfs

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/cache/favcache"
	keybase1 "github.com/keybase/client/protocol/go"
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

type favoriteStore interface {
	FavoriteAdd(folder keybase1.Folder) error
	FavoriteDelete(folder keybase1.Folder) error
	FavoriteList(sessionID int) ([]keybase1.Folder, error)

	Shutdown()
}

type diskFavoriteClient struct {
	currentUID keybase1.UID
	favoriteDb *leveldb.DB
	codec      Codec
}

var _ favoriteStore = diskFavoriteClient{}

func (c diskFavoriteClient) favkey(folder keybase1.Folder) []byte {
	return []byte(fmt.Sprintf("%s:%s", c.currentUID, folder.Name))
}

func (c diskFavoriteClient) FavoriteAdd(folder keybase1.Folder) error {
	enc, err := c.codec.Encode(folder)
	if err != nil {
		return err
	}

	return c.favoriteDb.Put(c.favkey(folder), enc, nil)
}

func (c diskFavoriteClient) FavoriteDelete(folder keybase1.Folder) error {
	return c.favoriteDb.Delete(c.favkey(folder), nil)
}

func (c diskFavoriteClient) FavoriteList(sessionID int) ([]keybase1.Folder, error) {
	iter := c.favoriteDb.NewIterator(util.BytesPrefix([]byte(c.currentUID+":")), nil)
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
	favorites *favcache.Cache
}

var _ favoriteStore = memoryFavoriteClient{}

func (c memoryFavoriteClient) FavoriteAdd(folder keybase1.Folder) error {
	c.favorites.Add(folder)
	return nil
}

func (c memoryFavoriteClient) FavoriteDelete(folder keybase1.Folder) error {
	c.favorites.Delete(folder)
	return nil
}

func (c memoryFavoriteClient) FavoriteList(sessionID int) ([]keybase1.Folder, error) {
	return c.favorites.List(), nil
}

func (c memoryFavoriteClient) Shutdown() {}

// KeybaseDaemonLocal implements KeybaseDaemon using an in-memory user
// and session store, and a given favorite store.
type KeybaseDaemonLocal struct {
	localUsers    localUserMap
	asserts       map[string]keybase1.UID
	currentUID    keybase1.UID
	favoriteStore favoriteStore
}

var _ KeybaseDaemon = KeybaseDaemonLocal{}

// Identify implements KeybaseDaemon for KeybaseDaemonLocal.
func (k KeybaseDaemonLocal) Identify(ctx context.Context, assertion string) (
	UserInfo, error) {
	uid, ok := k.asserts[assertion]
	if !ok {
		return UserInfo{}, NoSuchUserError{assertion}
	}

	u, err := k.localUsers.getLocalUser(uid)
	if err != nil {
		return UserInfo{}, err
	}

	return u.UserInfo, nil
}

// CurrentSession implements KeybaseDaemon for KeybaseDaemonLocal.
func (k KeybaseDaemonLocal) CurrentSession(ctx context.Context, sessionID int) (
	SessionInfo, error) {
	u, err := k.localUsers.getLocalUser(k.currentUID)
	if err != nil {
		return SessionInfo{}, err
	}
	return SessionInfo{
		UID:            u.UID,
		Token:          "keybase_daemon_local_token",
		CryptPublicKey: u.GetCurrentCryptPublicKey(),
	}, nil
}

// FavoriteAdd implements KeybaseDaemon for KeybaseDaemonLocal.
func (k KeybaseDaemonLocal) FavoriteAdd(
	ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteStore.FavoriteAdd(folder)
}

// FavoriteDelete implements KeybaseDaemon for KeybaseDaemonLocal.
func (k KeybaseDaemonLocal) FavoriteDelete(
	ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteStore.FavoriteDelete(folder)
}

// FavoriteList implements KeybaseDaemon for KeybaseDaemonLocal.
func (k KeybaseDaemonLocal) FavoriteList(
	ctx context.Context, sessionID int) ([]keybase1.Folder, error) {
	return k.favoriteStore.FavoriteList(sessionID)
}

// Shutdown implements KeybaseDaemon for KeybaseDaemonLocal.
func (k KeybaseDaemonLocal) Shutdown() {
	k.favoriteStore.Shutdown()
}

// NewKeybaseDaemonDisk constructs a KeybaseDaemonLocal object given a
// set of possible users, and one user that should be "logged in".
// Any storage (e.g. the favorites) persists to disk.
func NewKeybaseDaemonDisk(currentUID keybase1.UID, users []LocalUser, favDBFile string, codec Codec) (KeybaseDaemonLocal, error) {
	favoriteDb, err := leveldb.OpenFile(favDBFile, leveldbOptions)
	if err != nil {
		return KeybaseDaemonLocal{}, err
	}
	favoriteStore := diskFavoriteClient{currentUID, favoriteDb, codec}
	return newKeybaseDaemonLocal(currentUID, users, favoriteStore), nil
}

// NewKeybaseDaemonMemory constructs a KeybaseDaemonLocal object given
// a set of possible users, and one user that should be "logged in".
// Any storage (e.g. the favorites) is kept in memory only.
func NewKeybaseDaemonMemory(currentUID keybase1.UID, users []LocalUser) KeybaseDaemonLocal {
	favoriteStore := memoryFavoriteClient{favcache.New()}
	return newKeybaseDaemonLocal(currentUID, users, favoriteStore)
}

func newKeybaseDaemonLocal(
	currentUID keybase1.UID, users []LocalUser,
	favoriteStore favoriteStore) KeybaseDaemonLocal {
	localUserMap := make(localUserMap)
	asserts := make(map[string]keybase1.UID)
	for _, u := range users {
		localUserMap[u.UID] = u
		for _, a := range u.Asserts {
			asserts[a] = u.UID
		}
		asserts[string(u.Name)] = u.UID
		asserts["uid:"+u.UID.String()] = u.UID
	}
	return KeybaseDaemonLocal{
		localUsers:    localUserMap,
		asserts:       asserts,
		currentUID:    currentUID,
		favoriteStore: favoriteStore,
	}
}
