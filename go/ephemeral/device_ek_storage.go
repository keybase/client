package ephemeral

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/erasablekv"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	deviceEKSubDir = "device-eks"
	deviceEKPrefix = "deviceEphemeralKey"
	deviceEKSuffix = ".ek"
)

type deviceEKCacheItem struct {
	DeviceEK keybase1.DeviceEk
	Err      error
}

type deviceEKCache map[keybase1.EkGeneration]deviceEKCacheItem
type DeviceEKMap map[keybase1.EkGeneration]keybase1.DeviceEk

type DeviceEKStorage struct {
	libkb.Contextified
	sync.Mutex
	storage erasablekv.ErasableKVStore
	cache   deviceEKCache
	indexed bool
	logger  *log.Logger
}

func getLogger(g *libkb.GlobalContext) *log.Logger {
	filename := g.Env.GetEKLogFile()
	lfc := logger.LogFileConfig{
		Path:               filename,
		MaxAge:             30 * 24 * time.Hour, // 30 days
		MaxSize:            128 * 1024 * 1024,   // 128mb
		MaxKeepFiles:       3,
		SkipRedirectStdErr: true,
	}
	lfw := logger.NewLogFileWriter(lfc)
	if err := lfw.Open(time.Now()); err != nil {
		g.Log.CDebugf(context.TODO(), "Unable to getLogger %v", err)
		return nil
	}
	l := log.New(lfw, getLogPrefix(g), log.LstdFlags|log.Lshortfile)
	return l
}

func getLogPrefix(g *libkb.GlobalContext) string {
	return fmt.Sprintf("[username=%v] ", g.Env.GetUsername())
}

func NewDeviceEKStorage(g *libkb.GlobalContext) *DeviceEKStorage {
	return &DeviceEKStorage{
		Contextified: libkb.NewContextified(g),
		storage:      erasablekv.NewFileErasableKVStore(g, deviceEKSubDir),
		cache:        make(deviceEKCache),
		logger:       getLogger(g),
	}
}

func (s *DeviceEKStorage) SetLogPrefix() {
	s.logger.SetPrefix(getLogPrefix(s.G()))
}

// Log sensitive deletion actions to a separate log file so we don't lose the
// logs during normal rotation.
func (s *DeviceEKStorage) ekLogf(ctx context.Context, format string, args ...interface{}) {
	s.G().Log.CDebugf(ctx, format, args...)
	if s.logger != nil {
		s.logger.Printf(format, args...)
	}
}

func (s *DeviceEKStorage) ekLogCTraceTimed(ctx context.Context, msg string, f func() error) func() {
	if s.logger != nil {
		s.logger.Print(msg)
	}
	return s.G().CTraceTimed(ctx, msg, f)
}

func (s *DeviceEKStorage) keyPrefixFromUsername(username libkb.NormalizedUsername) string {
	return fmt.Sprintf("%s-%s-", deviceEKPrefix, username)
}

func (s *DeviceEKStorage) keyPrefix(ctx context.Context) (prefix string, err error) {
	uv, err := s.G().GetMeUV(ctx)
	if err != nil {
		return prefix, err
	}
	return fmt.Sprintf("%s%s-", s.keyPrefixFromUsername(s.G().Env.GetUsername()), uv.EldestSeqno), nil
}

func (s *DeviceEKStorage) key(ctx context.Context, generation keybase1.EkGeneration) (key string, err error) {
	prefix, err := s.keyPrefix(ctx)
	if err != nil {
		return key, err
	}
	return fmt.Sprintf("%s%d%s", prefix, generation, deviceEKSuffix), nil
}

// keyToEldestSeqno parses out the `eldestSeqno` from a key of the form
// deviceEKPrefix-username-eldestSeqno-generation.ek. If we have a key for a
// eldestSeqno that is not our current, we purge it since we don't want the
// ephemeral key to stick around if we've reset. If we are unable to parse out
// the value, the key is not valid, or not for the logged in user we return -1
func (s *DeviceEKStorage) keyToEldestSeqno(key string) keybase1.Seqno {
	if !strings.HasPrefix(key, deviceEKPrefix) {
		return -1
	}
	parts := strings.Split(key, "-")
	if len(parts) != 4 {
		return -1
	}
	// Make sure this key is for our current user and not a different one.
	if parts[1] != s.G().Env.GetUsername().String() {
		return -1
	}
	e, err := strconv.ParseUint(parts[2], 10, 64)
	if err != nil {
		return -1
	}
	return keybase1.Seqno(e)
}

// keyToEldestSeqno parses out the `generation` from a key of the form
// deviceEKPrefix-username-eldestSeqno-generation.ek. Unparseable keys return a
// generation of -1 and should be ignored.
func (s *DeviceEKStorage) keyToGeneration(ctx context.Context, key string) keybase1.EkGeneration {
	prefix, err := s.keyPrefix(ctx)
	if err != nil {
		s.G().Log.CDebugf(ctx, "keyToGeneration: unable to get keyPrefix: %v", err)
		return -1
	}
	if !strings.HasPrefix(key, prefix) || !strings.HasSuffix(key, deviceEKSuffix) {
		s.G().Log.CDebugf(ctx, "keyToGeneration: key missing prefix: %v or suffix: %s", prefix, deviceEKSuffix)
		return -1
	}

	key = strings.TrimSuffix(key, deviceEKSuffix)
	parts := strings.Split(key, prefix)
	if len(parts) != 2 {
		s.G().Log.CDebugf(ctx, "keyToGeneration: unexpected parts: %v, prefix: %v", parts)
		return -1
	}
	g, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil {
		s.G().Log.CDebugf(ctx, "keyToGeneration: unable to parseUint: %v", err)
		return -1
	}
	return keybase1.EkGeneration(g)
}

func (s *DeviceEKStorage) Put(ctx context.Context, generation keybase1.EkGeneration, deviceEK keybase1.DeviceEk) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("DeviceEKStorage#Put: generation:%v", generation), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	// sanity check that we got the right generation
	if deviceEK.Metadata.Generation != generation {
		return newEKCorruptedErr(ctx, s.G(), DeviceEKStr, generation, deviceEK.Metadata.Generation)
	}

	key, err := s.key(ctx, generation)
	if err != nil {
		return err
	}
	// Fill in this puppy.
	if deviceEK.Metadata.DeviceCtime == 0 {
		deviceEK.Metadata.DeviceCtime = keybase1.ToTime(time.Now())
	}
	if err = s.storage.Put(ctx, key, deviceEK); err != nil {
		return err
	}

	// cache the result
	cache, err := s.getCache(ctx)
	if err != nil {
		return err
	}
	cache[generation] = deviceEKCacheItem{
		DeviceEK: deviceEK,
		Err:      nil,
	}
	return nil
}

func (s *DeviceEKStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("DeviceEKStorage#Get: generation:%v", generation), func() error { return err })()
	s.Lock()
	defer s.Unlock()

	// Try the cache first
	cache, err := s.getCache(ctx)
	if err != nil {
		return deviceEK, err
	}
	cacheItem, ok := cache[generation]
	if ok {
		return cacheItem.DeviceEK, cacheItem.Err
	}
	// Try persistent storage.
	deviceEK, err = s.get(ctx, generation)
	switch err.(type) {
	case nil, erasablekv.UnboxError:
		// cache the result
		cache[generation] = deviceEKCacheItem{
			DeviceEK: deviceEK,
			Err:      err,
		}
		return deviceEK, err
	default:
		return deviceEK, err
	}
}

func (s *DeviceEKStorage) get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("DeviceEKStorage#get: generation:%v", generation), func() error { return err })()

	key, err := s.key(ctx, generation)
	if err != nil {
		return deviceEK, err
	}

	if err = s.storage.Get(ctx, key, &deviceEK); err != nil {
		switch err.(type) {
		case erasablekv.UnboxError:
			s.ekLogf(ctx, "DeviceEKStorage#get: corrupted generation: %v -> %v: %v", key, generation, err)
			if ierr := s.storage.Erase(ctx, key); ierr != nil {
				s.ekLogf(ctx, "DeviceEKStorage#get: unable to delete corrupted generation: %v", ierr)
			}
		}
		return deviceEK, err
	}
	// sanity check that we got the right generation
	if deviceEK.Metadata.Generation != generation {
		return deviceEK, newEKCorruptedErr(ctx, s.G(), DeviceEKStr, generation, deviceEK.Metadata.Generation)
	}
	return deviceEK, nil
}

func (s *DeviceEKStorage) Delete(ctx context.Context, generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.delete(ctx, generation)
}

func (s *DeviceEKStorage) delete(ctx context.Context, generation keybase1.EkGeneration) (err error) {
	defer s.ekLogCTraceTimed(ctx, fmt.Sprintf("DeviceEKStorage#delete: generation:%v", generation), func() error { return err })()

	// clear the cache
	cache, err := s.getCache(ctx)
	if err != nil {
		return err
	}
	key, err := s.key(ctx, generation)
	if err != nil {
		return err
	}
	if err = s.storage.Erase(ctx, key); err != nil {
		return err
	}
	delete(cache, generation)
	return nil
}

func (s *DeviceEKStorage) getCache(ctx context.Context) (cache deviceEKCache, err error) {
	if !s.indexed {
		keys, err := s.storage.AllKeys(ctx, deviceEKSuffix)
		if err != nil {
			return nil, err
		}
		for _, key := range keys {
			generation := s.keyToGeneration(ctx, key)
			if generation < 0 {
				s.G().Log.CDebugf(ctx, "DeviceEKStorage#getCache: unable to get generation from key: %s", key)
				continue
			}
			deviceEK, err := s.get(ctx, generation)
			switch err.(type) {
			case nil, erasablekv.UnboxError:
				s.cache[generation] = deviceEKCacheItem{
					DeviceEK: deviceEK,
					Err:      err,
				}
			default:
				return nil, err
			}
		}
		s.indexed = true
	}
	return s.cache, nil
}

func (s *DeviceEKStorage) ClearCache() {
	s.Lock()
	defer s.Unlock()
	s.clearCache()
}

func (s *DeviceEKStorage) clearCache() {
	s.cache = make(deviceEKCache)
	s.indexed = false
}

func (s *DeviceEKStorage) GetAll(ctx context.Context) (deviceEKs DeviceEKMap, err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#GetAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(ctx)
	if err != nil {
		return nil, err
	}
	deviceEKs = make(DeviceEKMap)
	for gen, cacheItem := range cache {
		if cacheItem.Err != nil {
			continue
		}
		deviceEKs[gen] = cacheItem.DeviceEK
	}
	return deviceEKs, nil
}

func (s *DeviceEKStorage) GetAllActive(ctx context.Context, merkleRoot libkb.MerkleRoot) (metadatas []keybase1.DeviceEkMetadata, err error) {
	defer s.G().CTraceTimed(ctx, "GetAllActive", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(ctx)
	if err != nil {
		return nil, err
	}

	activeKeysInOrder := []keybase1.DeviceEkMetadata{}
	for _, cacheItem := range cache {
		if cacheItem.Err != nil {
			continue
		}
		deviceEK := cacheItem.DeviceEK
		// Skip expired keys. Expired keys are spared from deletion past for a
		// window past their expiry date, in case they're needed for
		// decryption, but they're never signed over or used for encryption.
		if ctimeIsStale(deviceEK.Metadata.Ctime.Time(), merkleRoot) {
			continue
		}
		// Collect out of order, then sort below.
		activeKeysInOrder = append(activeKeysInOrder, deviceEK.Metadata)
	}
	sort.Slice(activeKeysInOrder, func(a, b int) bool { return activeKeysInOrder[a].Generation < activeKeysInOrder[b].Generation })

	return activeKeysInOrder, nil
}

// ListAllForUser lists the internal storage name of deviceEKs of the logged in
// user. This is used for logsend purposes to debug ek state.
func (s *DeviceEKStorage) ListAllForUser(ctx context.Context) (all []string, err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#ListAllForUser", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	return s.listAllForUser(ctx, s.G().Env.GetUsername())
}

func (s *DeviceEKStorage) listAllForUser(ctx context.Context, username libkb.NormalizedUsername) (all []string, err error) {
	// key in the sense of a key-value pair, not a crypto key!
	keys, err := s.storage.AllKeys(ctx, deviceEKSuffix)
	if err != nil {
		return nil, err
	}
	prefix := s.keyPrefixFromUsername(username)
	for _, key := range keys {
		if strings.HasPrefix(key, prefix) {
			all = append(all, key)
		}
	}
	return all, nil
}

func (s *DeviceEKStorage) MaxGeneration(ctx context.Context) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#MaxGeneration", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	maxGeneration = -1
	cache, err := s.getCache(ctx)
	if err != nil {
		return maxGeneration, err
	}
	for generation, cacheItem := range cache {
		if cacheItem.Err != nil {
			continue
		}
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}

func (s *DeviceEKStorage) DeleteExpired(ctx context.Context, merkleRoot libkb.MerkleRoot) (expired []keybase1.EkGeneration, err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#DeleteExpired", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(ctx)
	if err != nil {
		return nil, err
	}

	// Fall back to the device's local time if we don't have a merkle root so
	// we can complete deletions offline.
	var now time.Time
	if merkleRoot.IsNil() {
		now = time.Now()
	} else {
		now = keybase1.TimeFromSeconds(merkleRoot.Ctime()).Time()
	}

	keyMap := make(keyExpiryMap)
	// We delete expired and invalid cache entries but only return the expired.
	for generation, cacheItem := range cache {
		if cacheItem.Err != nil {
			continue
		} else {
			deviceEK := cacheItem.DeviceEK
			var ctime keybase1.Time
			// If we have a nil root _and_ a valid DeviceCtime, use that. If we're
			// missing a DeviceCtime it's better to use the slightly off
			// merkleCtime than a 0
			if merkleRoot.IsNil() && deviceEK.Metadata.DeviceCtime > 0 {
				ctime = deviceEK.Metadata.DeviceCtime
			} else {
				ctime = deviceEK.Metadata.Ctime
			}
			keyMap[generation] = ctime
		}
	}

	expired = s.getExpiredGenerations(context.Background(), keyMap, now)
	epick := libkb.FirstErrorPicker{}
	for _, generation := range expired {
		epick.Push(s.delete(ctx, generation))
	}

	epick.Push(s.deletedWrongEldestSeqno(ctx))
	return expired, epick.Error()
}

// getExpiredGenerations calculates which keys have expired and are safe to
// delete. Keys normally expire after `libkb.MaxEphemeralContentLifetime`
// unless there has been a gap in their generation. If there has been a gap of
// more than a day (the normal generation time), a key can be re-used for up to
// `libkb.MaxEphemeralKeyStaleness` until it is considered expired. To
// determine expiration, we look at all of the current keys and account for any
// gaps since we don't want to expire a key if it is still used to encrypt a
// different key or ephemeral content. With deviceEKs we also have to account
// for a deviceEK being created out of lock step with a userEK. Consider the
// following scenario:
//
// At t=0, deviceA creates deviceEK_A_1 and userEK_1. At t=0.5, deviceB creates
// devicekEK_B_1. At t=1, deviceEK_A_2 and userEK_2 are created and at t=1.5
// deviceEK_B_2 is created. deviceEK_B_1 cannot be deleted until userEK_2 is
// expired, or deviceB will delete it's deviceEK early. Since userEK_3 has not
// yet been created, we may have to keep deviceEK_B_1 around until userEK_2 is
// stale, at which time no more teamEKs will be encrypted by it. To account for
// this (without having to interact with the userEK level via server
// assistance) we extend the lifetime of deviceEK_B_1 to expire
// `libkb.MaxEphemeralContentLifetime` after the creation of deviceEK_B_3, with
// a maximum window of `libkb.MaxEphemeralKeyStaleness`. This is correct
// because userEK_3 *must* be created at or before deviceEK_B_3's creation.
func (s *DeviceEKStorage) getExpiredGenerations(ctx context.Context, keyMap keyExpiryMap, now time.Time) (expired []keybase1.EkGeneration) {
	// Sort the generations we have so we can walk through them in order.
	var keys []keybase1.EkGeneration
	for k := range keyMap {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	for i, generation := range keys {
		keyCtime := keyMap[generation].Time()

		// Offset between the current key and the generation after it. Allowed
		// to be at most libkb.MaxEphemeralKeyStaleness
		expiryOffset1 := libkb.MaxEphemeralKeyStaleness
		if i < len(keys)-1 {
			expiryOffset1 = keyMap[keys[i+1]].Time().Sub(keyCtime)
			// Offset can be max libkb.MaxEphemeralKeyStaleness
			if expiryOffset1 > libkb.MaxEphemeralKeyStaleness {
				expiryOffset1 = libkb.MaxEphemeralKeyStaleness
			}
		}

		// Offset between the key one generation older and two generations
		// older than the current key. Allowed to be at most
		// libkb.MaxEphemeralKeyStaleness
		expiryOffset2 := libkb.MaxEphemeralKeyStaleness
		if i < len(keys)-2 {
			expiryOffset2 = keyMap[keys[i+2]].Time().Sub(keyMap[keys[i+1]].Time())
			if expiryOffset2 > libkb.MaxEphemeralKeyStaleness {
				expiryOffset2 = libkb.MaxEphemeralKeyStaleness
			}
		}

		expiryOffset := expiryOffset1 + expiryOffset2
		if now.Sub(keyCtime) >= (libkb.MinEphemeralKeyLifetime + expiryOffset) {
			s.ekLogf(ctx, "getExpiredGenerations: expired generation:%v, now: %v, keyCtime:%v, expiryOffset:%v, keyMap: %v, i:%v",
				generation, now, keyCtime, expiryOffset, keyMap, i)
			expired = append(expired, generation)
		}
	}
	return expired
}

func (s *DeviceEKStorage) deletedWrongEldestSeqno(ctx context.Context) (err error) {
	keys, err := s.storage.AllKeys(ctx, deviceEKSuffix)
	if err != nil {
		return err
	}
	uv, err := s.G().GetMeUV(ctx)
	if err != nil {
		return err
	}
	epick := libkb.FirstErrorPicker{}
	for _, key := range keys {
		eldestSeqno := s.keyToEldestSeqno(key)
		if eldestSeqno < 0 {
			continue
		}
		if eldestSeqno != uv.EldestSeqno {
			s.ekLogf(ctx, "DeviceEKStorage#deletedWrongEldestSeqno: key: %v, uv: %v", key, uv)
			epick.Push(s.storage.Erase(ctx, key))
		}
	}
	return epick.Error()
}

func (s *DeviceEKStorage) ForceDeleteAll(ctx context.Context, username libkb.NormalizedUsername) (err error) {
	defer s.ekLogCTraceTimed(ctx, "DeviceEKStorage#ForceDeleteAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	// only delete if the key is owned by the current user
	keys, err := s.listAllForUser(ctx, username)
	if err != nil {
		return err
	}
	epick := libkb.FirstErrorPicker{}
	for _, key := range keys {
		s.ekLogf(ctx, "DeviceEKStorage#ForceDeleteAll: key: %v", key)
		epick.Push(s.storage.Erase(ctx, key))
	}

	s.clearCache()
	return epick.Error()
}
