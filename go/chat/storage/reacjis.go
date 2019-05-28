package storage

import (
	"fmt"
	"sort"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

const reacjiDiskVersion = 2

// If the user has less than 5 favorite reacjis we stuff these defaults in.
var DefaultTopReacjis = []string{":+1:", ":-1:", ":tada:", ":joy:", ":sunglasses:"}

type ReacjiInternalStorage struct {
	FrequencyMap map[string]int
	SkinTone     keybase1.ReacjiSkinTone
}

func NewReacjiInternalStorage() *ReacjiInternalStorage {
	return &ReacjiInternalStorage{
		FrequencyMap: make(map[string]int),
	}
}

type reacjiMemCacheImpl struct {
	sync.RWMutex

	uid  gregor1.UID
	data *ReacjiInternalStorage
}

func newReacjiMemCacheImpl() *reacjiMemCacheImpl {
	return &reacjiMemCacheImpl{
		data: NewReacjiInternalStorage(),
	}
}

func (i *reacjiMemCacheImpl) Get(uid gregor1.UID) (bool, *ReacjiInternalStorage) {
	i.RLock()
	defer i.RUnlock()
	if !uid.Eq(i.uid) {
		return false, nil
	}
	return true, i.data
}

func (i *reacjiMemCacheImpl) Put(uid gregor1.UID, data *ReacjiInternalStorage) {
	i.Lock()
	defer i.Unlock()
	i.uid = uid
	i.data = data
}

func (i *reacjiMemCacheImpl) clearMemCaches() {
	i.Lock()
	defer i.Unlock()
	i.data = NewReacjiInternalStorage()
	i.uid = nil
}

func (i *reacjiMemCacheImpl) OnLogout(mctx libkb.MetaContext) error {
	i.clearMemCaches()
	return nil
}

func (i *reacjiMemCacheImpl) OnDbNuke(mctx libkb.MetaContext) error {
	i.clearMemCaches()
	return nil
}

var reacjiMemCache = newReacjiMemCacheImpl()

type reacjiPair struct {
	name string
	freq int
}

type reacjiDiskEntry struct {
	Version int
	// reacji name -> frequency
	Data ReacjiInternalStorage
}

type ReacjiStore struct {
	sync.Mutex
	utils.DebugLabeler
	encryptedDB *encrypteddb.EncryptedDB
}

// Keeps map counting emoji used in reactions for each user. Used to populate
// the reacji heads up display.
// Data is stored in an encrypted leveldb in the form:
// uid -> {
//                reacjiName: frequency,
//                ":+1:": 5,
//                ...
//         },
func NewReacjiStore(g *globals.Context) *ReacjiStore {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return GetSecretBoxKey(ctx, g.ExternalG(), DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &ReacjiStore{
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ReacjiStore", false),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (s *ReacjiStore) dbKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatReacji,
		Key: fmt.Sprintf("ri:%s", uid),
	}
}

func (s *ReacjiStore) populateCacheLocked(ctx context.Context, uid gregor1.UID) *ReacjiInternalStorage {
	if found, data := reacjiMemCache.Get(uid); found {
		return data
	}

	// populate the cache after we fetch from disk
	data := NewReacjiInternalStorage()
	defer func() { reacjiMemCache.Put(uid, data) }()

	dbKey := s.dbKey(uid)
	var entry reacjiDiskEntry
	found, err := s.encryptedDB.Get(ctx, dbKey, &entry)
	if err != nil || !found {
		s.Debug(ctx, "reacji map not found on disk")
		return data
	}

	if entry.Version != reacjiDiskVersion {
		// drop the history if our format changed
		if err = s.encryptedDB.Delete(ctx, dbKey); err != nil {
			s.Debug(ctx, "unable to delete cache entry: %v", err)
		}
		return data
	}
	data = &entry.Data
	return data
}

func (s *ReacjiStore) PutReacji(ctx context.Context, uid gregor1.UID, reacji string) error {
	s.Lock()
	defer s.Unlock()

	cache := s.populateCacheLocked(ctx, uid)
	cache.FrequencyMap[reacji]++
	reacjiMemCache.Put(uid, cache)
	dbKey := s.dbKey(uid)
	return s.encryptedDB.Put(ctx, dbKey, reacjiDiskEntry{
		Version: reacjiDiskVersion,
		Data:    *cache,
	})
}

func (s *ReacjiStore) PutSkinTone(ctx context.Context, uid gregor1.UID,
	skinTone keybase1.ReacjiSkinTone) error {
	s.Lock()
	defer s.Unlock()

	cache := s.populateCacheLocked(ctx, uid)
	cache.SkinTone = skinTone
	dbKey := s.dbKey(uid)
	return s.encryptedDB.Put(ctx, dbKey, reacjiDiskEntry{
		Version: reacjiDiskVersion,
		Data:    *cache,
	})
}

func (s *ReacjiStore) GetInternalStore(ctx context.Context, uid gregor1.UID) *ReacjiInternalStorage {
	s.Lock()
	defer s.Unlock()
	return s.populateCacheLocked(ctx, uid)
}

// UserReacjis returns the user's most frequently used reacjis falling back to
// `DefaultTopReacjis` if there is not enough history. Results are ordered by
// frequency and then alphabetically.
func (s *ReacjiStore) UserReacjis(ctx context.Context, uid gregor1.UID) keybase1.UserReacjis {
	s.Lock()
	defer s.Unlock()

	cache := s.populateCacheLocked(ctx, uid)
	pairs := []reacjiPair{}
	for name, freq := range cache.FrequencyMap {
		pairs = append(pairs, reacjiPair{name: name, freq: freq})
	}
	// sort by frequency and then alphabetically
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].freq == pairs[j].freq {
			return pairs[i].name < pairs[j].name
		}
		return pairs[i].freq > pairs[j].freq
	})

	reacjis := []string{}
	for _, p := range pairs {
		reacjis = append(reacjis, p.name)
	}
	if len(reacjis) < len(DefaultTopReacjis) {
		reacjis = append(reacjis, DefaultTopReacjis[:len(DefaultTopReacjis)-len(reacjis)]...)
	}
	return keybase1.UserReacjis{
		TopReacjis: reacjis,
		SkinTone:   cache.SkinTone,
	}
}
