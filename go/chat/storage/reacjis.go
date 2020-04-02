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
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/kyokomi/emoji"
	context "golang.org/x/net/context"
)

const (
	minScoringMinutes = 1           // one minute
	maxScoringMinutes = 7 * 24 * 60 // one week
	frequencyWeight   = 1
	mtimeWeight       = 20
	reacjiDiskVersion = 3
)

var emojiCodeMap map[string]string

// If the user has less than 5 favorite reacjis we stuff these defaults in.
var DefaultTopReacjis = []string{":+1:", ":-1:", ":joy:", ":sunglasses:", ":tada:"}

// emojiRevCodeMap maps unicode characters to lists of short codes.
var emojiRevCodeMap = make(map[string][]string, len(emojiCodeMap))

func init() {
	emojiCodeMap = emoji.CodeMap()
	for shortCode, unicode := range emojiCodeMap {
		emojiRevCodeMap[unicode] = append(emojiRevCodeMap[unicode], shortCode)
	}
	// ensure deterministic ordering for aliases
	for _, value := range emojiRevCodeMap {
		sort.Strings(value)
	}
}

// RevCodeMap gets the underlying map of emoji.
func RevCodeMap() map[string][]string {
	return emojiRevCodeMap
}

func AliasList(shortCode string) []string {
	return emojiRevCodeMap[emojiCodeMap[shortCode]]
}

// HasAlias flags if the given `shortCode` has multiple aliases with other
// codes.
func HasAlias(shortCode string) bool {
	return len(AliasList(shortCode)) > 1
}

// NormalizeShortCode normalizes a given `shortCode` to a deterministic alias.
func NormalizeShortCode(shortCode string) string {
	shortLists := AliasList(shortCode)
	if len(shortLists) == 0 {
		return shortCode
	}
	return shortLists[0]
}

type ReacjiInternalStorage struct {
	FrequencyMap map[string]int
	MtimeMap     map[string]gregor1.Time
	SkinTone     keybase1.ReacjiSkinTone
}

func (i ReacjiInternalStorage) score(name string) float64 {
	freq := i.FrequencyMap[name]
	mtime, ok := i.MtimeMap[name]
	// if we are missing an mtime just backdate to a week ago
	if !ok {
		mtime = gregor1.ToTime(time.Now().Add(-time.Hour * 24 * 7))
	}
	minutes := time.Since(mtime.Time()).Minutes()
	var mtimeScore float64
	if minutes > maxScoringMinutes {
		mtimeScore = 0
	} else if minutes < minScoringMinutes {
		mtimeScore = 1
	} else {
		mtimeScore = 1 - minutes/(maxScoringMinutes-minScoringMinutes)
	}
	return float64(freq*frequencyWeight) + mtimeScore*mtimeWeight
}

func NewReacjiInternalStorage() ReacjiInternalStorage {
	return ReacjiInternalStorage{
		FrequencyMap: make(map[string]int),
		MtimeMap:     make(map[string]gregor1.Time),
	}
}

type reacjiMemCacheImpl struct {
	sync.RWMutex

	uid  gregor1.UID
	data ReacjiInternalStorage
}

func newReacjiMemCacheImpl() *reacjiMemCacheImpl {
	return &reacjiMemCacheImpl{
		data: NewReacjiInternalStorage(),
	}
}

func (i *reacjiMemCacheImpl) Get(uid gregor1.UID) (bool, ReacjiInternalStorage) {
	i.RLock()
	defer i.RUnlock()
	if !uid.Eq(i.uid) {
		return false, NewReacjiInternalStorage()
	}
	return true, i.data
}

func (i *reacjiMemCacheImpl) Put(uid gregor1.UID, data ReacjiInternalStorage) {
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
	name  string
	score float64
	freq  int
}

func newReacjiPair(name string, freq int, score float64) reacjiPair {
	return reacjiPair{
		name:  name,
		freq:  freq,
		score: score,
	}
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
		return GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &ReacjiStore{
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "ReacjiStore", false),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (s *ReacjiStore) dbKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatReacji,
		Key: fmt.Sprintf("ri:%s", uid),
	}
}

func (s *ReacjiStore) populateCacheLocked(ctx context.Context, uid gregor1.UID) ReacjiInternalStorage {
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
		s.Debug(ctx, "Deleting reacjiCache found version %d, current version %d", entry.Version, reacjiDiskVersion)
		if err = s.encryptedDB.Delete(ctx, dbKey); err != nil {
			s.Debug(ctx, "unable to delete cache entry: %v", err)
		}
		return data
	}
	if entry.Data.FrequencyMap == nil {
		entry.Data.FrequencyMap = make(map[string]int)
	}
	if entry.Data.MtimeMap == nil {
		entry.Data.MtimeMap = make(map[string]gregor1.Time)
	}
	return entry.Data
}

func (s *ReacjiStore) PutReacji(ctx context.Context, uid gregor1.UID, shortCode string) error {
	s.Lock()
	defer s.Unlock()
	if !(HasAlias(shortCode) || globals.EmojiPattern.MatchString(shortCode)) {
		return nil
	}
	shortCode = NormalizeShortCode(shortCode)
	cache := s.populateCacheLocked(ctx, uid)
	cache.FrequencyMap[shortCode]++
	cache.MtimeMap[shortCode] = gregor1.ToTime(time.Now())

	dbKey := s.dbKey(uid)
	err := s.encryptedDB.Put(ctx, dbKey, reacjiDiskEntry{
		Version: reacjiDiskVersion,
		Data:    cache,
	})
	if err != nil {
		return err
	}
	reacjiMemCache.Put(uid, cache)
	return nil
}

func (s *ReacjiStore) PutSkinTone(ctx context.Context, uid gregor1.UID,
	skinTone keybase1.ReacjiSkinTone) error {
	s.Lock()
	defer s.Unlock()

	if skinTone > 5 {
		skinTone = 0
	}

	cache := s.populateCacheLocked(ctx, uid)
	cache.SkinTone = skinTone
	dbKey := s.dbKey(uid)
	err := s.encryptedDB.Put(ctx, dbKey, reacjiDiskEntry{
		Version: reacjiDiskVersion,
		Data:    cache,
	})
	if err != nil {
		return err
	}
	reacjiMemCache.Put(uid, cache)
	return nil
}

func (s *ReacjiStore) GetInternalStore(ctx context.Context, uid gregor1.UID) ReacjiInternalStorage {
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
	// add defaults if needed so we always return some values
	for _, el := range DefaultTopReacjis {
		if len(cache.FrequencyMap) >= len(DefaultTopReacjis) {
			break
		}
		if _, ok := cache.FrequencyMap[el]; !ok {
			cache.FrequencyMap[el] = 0
			cache.MtimeMap[el] = 0
		}
	}

	for name := range cache.FrequencyMap {
		name = NormalizeShortCode(name)
		freq := cache.FrequencyMap[name]
		score := cache.score(name)
		pairs = append(pairs, newReacjiPair(name, freq, score))
	}
	// sort by frequency and then alphabetically
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].score == pairs[j].score {
			return pairs[i].name < pairs[j].name
		}
		return pairs[i].score > pairs[j].score
	})
	reacjis := make([]string, 0, len(pairs))
	for _, p := range pairs {
		if len(reacjis) >= len(DefaultTopReacjis) && p.freq == 0 {
			delete(cache.FrequencyMap, p.name)
			delete(cache.MtimeMap, p.name)
		} else {
			reacjis = append(reacjis, p.name)
		}
	}

	return keybase1.UserReacjis{
		TopReacjis: reacjis,
		SkinTone:   cache.SkinTone,
	}
}
