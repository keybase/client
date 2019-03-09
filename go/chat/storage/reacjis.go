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
	context "golang.org/x/net/context"
)

const reacjiDiskVersion = 1

// If the user has less than 5 favorite reacjis we stuff these defaults in.
var DefaultTopReacjis = []string{":+1:", ":-1:", ":tada:", ":joy:", ":sunglasses:"}

var addReacjiMemCacheHookOnce sync.Once

type ReacjiMap map[string]int

type reacjiMemCacheImpl struct {
	sync.RWMutex

	uid    gregor1.UID
	datMap ReacjiMap
}

func newReacjiMemCacheImpl() *reacjiMemCacheImpl {
	return &reacjiMemCacheImpl{
		datMap: make(ReacjiMap),
	}
}

func (i *reacjiMemCacheImpl) Get(uid gregor1.UID) (bool, ReacjiMap) {
	i.RLock()
	defer i.RUnlock()
	if !uid.Eq(i.uid) {
		return false, nil
	}
	return true, i.datMap
}

func (i *reacjiMemCacheImpl) Put(uid gregor1.UID, datMap ReacjiMap) {
	i.Lock()
	defer i.Unlock()
	i.uid = uid
	i.datMap = datMap
}

func (i *reacjiMemCacheImpl) Increment(uid gregor1.UID, reacji string) ReacjiMap {
	i.Lock()
	defer i.Unlock()
	if !uid.Eq(i.uid) {
		i.datMap = make(ReacjiMap)
		i.uid = uid
	}
	i.datMap[reacji]++
	return i.datMap
}

func (i *reacjiMemCacheImpl) OnLogout(m libkb.MetaContext) error {
	i.Lock()
	defer i.Unlock()
	i.datMap = make(ReacjiMap)
	i.uid = nil
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
	Data ReacjiMap
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
	// add a logout hook to clear the in-memory cache, but only add it once:
	addReacjiMemCacheHookOnce.Do(func() {
		g.ExternalG().AddLogoutHook(reacjiMemCache)
	})
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

func (s *ReacjiStore) populateCacheLocked(ctx context.Context, uid gregor1.UID) ReacjiMap {
	if found, datMap := reacjiMemCache.Get(uid); found {
		return datMap
	}

	// populate the cache after we fetch from disk
	datMap := make(ReacjiMap)
	defer func() { reacjiMemCache.Put(uid, datMap) }()

	dbKey := s.dbKey(uid)
	var entry reacjiDiskEntry
	found, err := s.encryptedDB.Get(ctx, dbKey, &entry)
	if err != nil || !found {
		s.Debug(ctx, "reacji map not found on disk")
		return datMap
	}

	if entry.Version != reacjiDiskVersion {
		// drop the history if our format changed
		if err = s.encryptedDB.Delete(ctx, dbKey); err != nil {
			s.Debug(ctx, "unable to delete cache entry: %v", err)
			return datMap
		}
	}
	datMap = entry.Data
	return datMap
}

func (s *ReacjiStore) Put(ctx context.Context, uid gregor1.UID, reacji string) error {
	s.Lock()
	defer s.Unlock()

	s.populateCacheLocked(ctx, uid)
	datMap := reacjiMemCache.Increment(uid, reacji)
	dbKey := s.dbKey(uid)
	return s.encryptedDB.Put(ctx, dbKey, reacjiDiskEntry{
		Version: reacjiDiskVersion,
		Data:    datMap,
	})
}

func (s *ReacjiStore) Get(ctx context.Context, uid gregor1.UID) ReacjiMap {
	s.Lock()
	defer s.Unlock()
	return s.populateCacheLocked(ctx, uid)
}

// TopReacjis returns the user's most frequently used 5 reacjis falling back
// to `DefaultTopReacjis` if there is not enough history. Results are ordered by
// frequency and then alphabetically.
func (s *ReacjiStore) TopReacjis(ctx context.Context, uid gregor1.UID) (res []string) {
	s.Lock()
	defer s.Unlock()

	cache := s.populateCacheLocked(ctx, uid)
	pairs := []reacjiPair{}
	for name, freq := range cache {
		pairs = append(pairs, reacjiPair{name: name, freq: freq})
	}
	// sort by frequency and then alphabetically
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].freq == pairs[j].freq {
			return pairs[i].name < pairs[j].name
		}
		return pairs[i].freq > pairs[j].freq
	})

	for _, p := range pairs {
		res = append(res, p.name)
		if len(res) >= len(DefaultTopReacjis) {
			break
		}
	}
	if len(res) < len(DefaultTopReacjis) {
		res = append(res, DefaultTopReacjis[:len(DefaultTopReacjis)-len(res)]...)
	}
	return res
}
