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
var DefaultEmoji = []string{":+1:", ":-1:", ":tada:", ":joy:", ":sunglasses:"}

var addReacjiMemCacheHookOnce sync.Once

type reacjiMemCache struct {
	sync.RWMutex

	datMap map[string]int
}

func newReacjiMemCache() *reacjiMemCache {
	return &reacjiMemCache{
		datMap: make(map[string]int),
	}
}

func (i *reacjiMemCache) Get(reacji string) int {
	i.RLock()
	defer i.RUnlock()
	if ibox, ok := i.datMap[reacji]; ok {
		return ibox
	}
	return nil
}

func (i *reacjiMemCache) Increment(reacji string) {
	i.Lock()
	defer i.Unlock()
	i.datMap[reacji]++
}

func (i *reacjiMemCache) OnLogout(m libkb.MetaContext) error {
	i.Lock()
	defer i.Unlock()
	i.datMap = make(map[string]int)
	return nil
}

var reacjiMemCache = newReacjiMemCache()

type reacjiPair struct {
	name string
	freq int
}

type reacjiMap struct {
	Version int
	// reacji name -> frequency
	Data map[string]int
}

type ReacjiStore struct {
	sync.Mutex
	globals.Contextified
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
	// add a logout hook to clear the in-memory inbox cache, but only add it once:
	addReacjiMemCacheHookOnce.Do(func() {
		g.ExternalG().AddLogoutHook(reacjiMemCache)
	})
	return &ReacjiStore{
		Contextified: globals.NewContextified(g),
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

func (s *ReacjiStore) getCacheLocked(ctx context.Context, uid gregor1.UID) (ret map[string]int) {
	if !s.uid.Eq(uid) { // fetch the cache from disk
		s.uid = uid
		dbKey := s.dbKey(uid)
		var entry reacjiMap
		found, err := s.encryptedDB.Get(ctx, dbKey, &entry)
		if err != nil || !found {
			s.Debug(ctx, "reacji map not found on disk")
			return s.cache
		}

		if entry.Version != reacjiDiskVersion {
			// drop the history if our format changed
			if err = s.encryptedDB.Delete(ctx, dbKey); err != nil {
				s.Debug(ctx, "unable to delete cache entry: %v", err)
				return s.cache
			}
		}
		s.cache = entry.Data
	}
	return s.cache
}

func (s *ReacjiStore) Put(ctx context.Context, uid gregor1.UID, reacji string) error {
	s.Lock()
	defer s.Unlock()

	reacjiMemCache.Increment(reacji)
	dbKey := s.dbKey(uid)
	return s.encryptedDB.Put(ctx, dbKey, reacjiMap{
		Version: reacjiDiskVersion,
		Data:    cache,
	})
}

func (s *ReacjiStore) Get(ctx context.Context, uid gregor1.UID) map[string]int {
	s.Lock()
	defer s.Unlock()
	return s.getCacheLocked(ctx, uid)
}

// TopReacjis returns the user's most frequently used 5 reacjis falling back
// to `DefaultEmoji` if there is not enough history. Results are ordered by
// frequency and then alphabetically.
func (s *ReacjiStore) TopReacjis(ctx context.Context, uid gregor1.UID) (res []string) {
	s.Lock()
	defer s.Unlock()

	cache := s.getCacheLocked(ctx, uid)
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
		if len(res) >= len(DefaultEmoji) {
			break
		}
	}
	if len(res) < len(DefaultEmoji) {
		res = append(res, DefaultEmoji[:len(DefaultEmoji)-len(res)]...)
	}
	return res
}
