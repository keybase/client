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

const reactjiDiskVersion = 1

// If the user has less than 5 favorite reactjis we stuff these defaults in.
var DefaultEmoji = []string{":+1:", ":-1:", ":tada:", ":joy:", ":sunglasses:"}

type reactjiPair struct {
	name string
	freq int
}

type reactjiMap struct {
	Version int
	// reactji name -> frequency
	Data map[string]int
}

type ReactjiStore struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler
	encryptedDB *encrypteddb.EncryptedDB
	cache       map[string]int
	uid         gregor1.UID

	// for testing
	putCh chan struct{}
}

// Keeps map counting emoji used in reactions for each user. Used to populate
// the reactji heads up display.
// Data is stored in an encrypted leveldb in the form:
// uid -> {
//                reactjiName: frequency,
//                ":+1:": 5,
//                ...
//         },
func NewReactjiStore(g *globals.Context) *ReactjiStore {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return GetSecretBoxKey(ctx, g.ExternalG(), DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &ReactjiStore{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ReactjiStore", false),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
		cache:        make(map[string]int),
	}
}

func (s *ReactjiStore) SetPutCh(ch chan struct{}) {
	s.Lock()
	defer s.Unlock()
	s.putCh = ch
}

func (s *ReactjiStore) dbKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatReacji,
		Key: fmt.Sprintf("ri:%s", uid),
	}
}

func (s *ReactjiStore) getCacheLocked(ctx context.Context, uid gregor1.UID) (ret map[string]int) {
	if !s.uid.Eq(uid) { // fetch the cache from disk
		s.uid = uid
		dbKey := s.dbKey(uid)
		var entry reactjiMap
		found, err := s.encryptedDB.Get(ctx, dbKey, &entry)
		if err != nil || !found {
			s.Debug(ctx, "reactji map not found on disk")
			return s.cache
		}

		if entry.Version != reactjiDiskVersion {
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

func (s *ReactjiStore) Put(ctx context.Context, uid gregor1.UID, reactji string) error {
	s.Lock()
	defer s.Unlock()
	defer func() {
		if s.putCh != nil {
			s.putCh <- struct{}{}
		}
	}()

	cache := s.getCacheLocked(ctx, uid)
	cache[reactji]++
	dbKey := s.dbKey(uid)
	return s.encryptedDB.Put(ctx, dbKey, reactjiMap{
		Version: reactjiDiskVersion,
		Data:    cache,
	})
}

func (s *ReactjiStore) Get(ctx context.Context, uid gregor1.UID) map[string]int {
	s.Lock()
	defer s.Unlock()
	return s.getCacheLocked(ctx, uid)
}

// TopReactjis returns the user's most frequently used 5 reactjis falling back
// to `DefaultEmoji` if there is not enough history. Results are ordered by
// frequency and then alphabetically.
func (s *ReactjiStore) TopReactjis(ctx context.Context, uid gregor1.UID) (res []string) {
	s.Lock()
	defer s.Unlock()

	cache := s.getCacheLocked(ctx, uid)
	pairs := []reactjiPair{}
	for name, freq := range cache {
		pairs = append(pairs, reactjiPair{name: name, freq: freq})
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
