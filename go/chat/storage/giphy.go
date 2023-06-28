package storage

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

const (
	giphyDiskVersion = 1
)

// track frequency/mtime of giphy search results that are sent.
type GiphyResultFrequency struct {
	Result chat1.GiphySearchResult
	Count  int
	Mtime  gregor1.Time
}

type GiphyQueryFrequency struct {
	Count int
	Mtime gregor1.Time
}

// Locally track the usage of particular giphy images/search queries to power the UI.
type GiphyInternalStorage struct {
	// targetURL -> result frequency/mtime
	Results map[string]GiphyResultFrequency
	// query -> query frequency/mtime
	Queries map[string]GiphyQueryFrequency
}

func NewGiphyInternalStorage() GiphyInternalStorage {
	return GiphyInternalStorage{
		Results: make(map[string]GiphyResultFrequency),
		Queries: make(map[string]GiphyQueryFrequency),
	}
}

type giphyMemCacheImpl struct {
	sync.RWMutex

	uid  gregor1.UID
	data GiphyInternalStorage
}

func newGiphyMemCacheImpl() *giphyMemCacheImpl {
	return &giphyMemCacheImpl{
		data: NewGiphyInternalStorage(),
	}
}

func (i *giphyMemCacheImpl) Get(uid gregor1.UID) (bool, GiphyInternalStorage) {
	i.RLock()
	defer i.RUnlock()
	if !uid.Eq(i.uid) {
		return false, NewGiphyInternalStorage()
	}
	return true, i.data
}

func (i *giphyMemCacheImpl) Put(uid gregor1.UID, data GiphyInternalStorage) {
	i.Lock()
	defer i.Unlock()
	i.uid = uid
	i.data = data
}

func (i *giphyMemCacheImpl) clearMemCaches() {
	i.Lock()
	defer i.Unlock()
	i.data = NewGiphyInternalStorage()
	i.uid = nil
}

func (i *giphyMemCacheImpl) OnLogout(mctx libkb.MetaContext) error {
	i.clearMemCaches()
	return nil
}

func (i *giphyMemCacheImpl) OnDbNuke(mctx libkb.MetaContext) error {
	i.clearMemCaches()
	return nil
}

var giphyMemCache = newGiphyMemCacheImpl()

type giphyDiskEntry struct {
	Version int
	Data    GiphyInternalStorage
}

type GiphyStore struct {
	globals.Contextified
	sync.Mutex
	utils.DebugLabeler

	encryptedDB *encrypteddb.EncryptedDB
}

// Keeps map counting giphy send, partitioned by user. Used to populate
// the giphy default display/command HUD.
// Data is stored in an encrypted leveldb in the form:
//
//		uid -> {
//		         {
//	               targetUrl: {GiphyResult, frequency, mtime},
//	               ...
//	             },
//		         {
//	               query: {frequency, mtime},
//	               ...
//	             }
//		},
func NewGiphyStore(g *globals.Context) *GiphyStore {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &GiphyStore{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "GiphyStore", false),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (s *GiphyStore) dbKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatGiphy,
		Key: fmt.Sprintf("gi:%s", uid),
	}
}

func (s *GiphyStore) populateCacheLocked(ctx context.Context, uid gregor1.UID) (cache GiphyInternalStorage) {
	if found, cache := giphyMemCache.Get(uid); found {
		return cache
	}

	// populate the cache after we fetch from disk
	cache = NewGiphyInternalStorage()
	defer func() { giphyMemCache.Put(uid, cache) }()

	dbKey := s.dbKey(uid)
	var entry giphyDiskEntry
	found, err := s.encryptedDB.Get(ctx, dbKey, &entry)
	if err != nil || !found {
		s.Debug(ctx, "giphy map not found on disk")
		return cache
	}

	if entry.Version != giphyDiskVersion {
		// drop the history if our format changed
		s.Debug(ctx, "Deleting giphyCache found version %d, current version %d", entry.Version, reacjiDiskVersion)
		if err = s.encryptedDB.Delete(ctx, dbKey); err != nil {
			s.Debug(ctx, "unable to delete cache entry: %v", err)
		}
		return cache
	}

	if entry.Data.Results == nil {
		entry.Data.Results = make(map[string]GiphyResultFrequency)
	}
	if entry.Data.Queries == nil {
		entry.Data.Queries = make(map[string]GiphyQueryFrequency)
	}

	cache = entry.Data
	return cache
}

func (s *GiphyStore) Put(ctx context.Context, uid gregor1.UID, giphy chat1.GiphySearchResult) error {
	s.Lock()
	defer s.Unlock()
	cache := s.populateCacheLocked(ctx, uid)
	resultItem, ok := cache.Results[giphy.TargetUrl]
	if !ok {
		resultItem.Result = giphy
	}
	resultItem.Count++
	resultItem.Mtime = gregor1.ToTime(time.Now())
	cache.Results[giphy.TargetUrl] = resultItem

	queryItem := cache.Queries[giphy.Query]
	queryItem.Count++
	queryItem.Mtime = gregor1.ToTime(time.Now())
	cache.Queries[giphy.Query] = queryItem

	dbKey := s.dbKey(uid)
	err := s.encryptedDB.Put(ctx, dbKey, giphyDiskEntry{
		Version: giphyDiskVersion,
		Data:    cache,
	})
	if err != nil {
		return err
	}
	giphyMemCache.Put(uid, cache)
	return nil
}

type giphyFrequencyResultWithScore struct {
	result GiphyResultFrequency
	score  float64
}

// GiphyResults returns the user's most frequently used giphy results.
// Results are ordered by frequency and then alphabetically but may be empty
func (s *GiphyStore) GiphyResults(ctx context.Context, uid gregor1.UID) []chat1.GiphySearchResult {
	s.Lock()
	defer s.Unlock()

	cache := s.populateCacheLocked(ctx, uid)

	pairs := make([]giphyFrequencyResultWithScore, 0, len(cache.Results))
	for _, res := range cache.Results {
		score := ScoreByFrequencyAndMtime(res.Count, res.Mtime)
		pairs = append(pairs, giphyFrequencyResultWithScore{result: res, score: score})
	}
	// sort by frequency and then alphabetically
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].score == pairs[j].score {
			return pairs[i].result.Result.TargetUrl < pairs[j].result.Result.TargetUrl
		}
		return pairs[i].score > pairs[j].score
	})
	results := make([]chat1.GiphySearchResult, 0, len(pairs))
	for _, p := range pairs {
		results = append(results, p.result.Result)
	}

	return results
}

type queryWithScore struct {
	query string
	score float64
}

func (s *GiphyStore) GiphyQueries(ctx context.Context, uid gregor1.UID) []string {
	s.Lock()
	defer s.Unlock()

	cache := s.populateCacheLocked(ctx, uid)

	pairs := make([]queryWithScore, 0, len(cache.Queries))
	for query, res := range cache.Queries {
		score := ScoreByFrequencyAndMtime(res.Count, res.Mtime)
		pairs = append(pairs, queryWithScore{query: query, score: score})
	}
	// sort by frequency and then alphabetically
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].score == pairs[j].score {
			return pairs[i].query < pairs[j].query
		}
		return pairs[i].score > pairs[j].score
	})
	results := make([]string, 0, len(pairs))
	for _, p := range pairs {
		results = append(results, p.query)
	}

	return results
}
