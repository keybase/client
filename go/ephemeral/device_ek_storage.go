package ephemeral

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/erasablekv"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const deviceEKSubDir = "device-eks"
const deviceEKPrefix = "deviceEphemeralKey"

type DeviceEKMap map[keybase1.EkGeneration]keybase1.DeviceEk

type DeviceEKStorage struct {
	libkb.Contextified
	sync.Mutex
	storage erasablekv.ErasableKVStore
	cache   DeviceEKMap
	indexed bool
}

func NewDeviceEKStorage(g *libkb.GlobalContext) *DeviceEKStorage {
	return &DeviceEKStorage{
		Contextified: libkb.NewContextified(g),
		storage:      erasablekv.NewFileErasableKVStore(g, deviceEKSubDir),
		cache:        make(DeviceEKMap),
	}
}

func (s *DeviceEKStorage) keyPrefixFromUsername(username libkb.NormalizedUsername) string {
	return fmt.Sprintf("%s-%s-", deviceEKPrefix, username)
}

func (s *DeviceEKStorage) keyPrefix(ctx context.Context) (prefix string, err error) {
	uv, err := getCurrentUserUV(ctx, s.G())
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
	return fmt.Sprintf("%s%d.ek", prefix, generation), nil
}

func (s *DeviceEKStorage) keyToEldestSeqno(key string) (eldestSeqno keybase1.Seqno, err error) {
	if !strings.HasPrefix(key, deviceEKPrefix) {
		return -1, nil
	}
	parts := strings.Split(key, "-")

	// keyform: deviceEKPrefix-username-eldestSeqNo-generation.ek
	if len(parts) != 4 {
		return eldestSeqno, fmt.Errorf("Invalid key format for deviceEK: %v", key)
	}
	// Make sure this key is for our current user and not a different one.
	if parts[1] != s.G().Env.GetUsername().String() {
		return -1, nil
	}
	e, err := strconv.ParseUint(parts[2], 10, 64)
	if err != nil {
		return eldestSeqno, err
	}
	return keybase1.Seqno(e), nil
}

func (s *DeviceEKStorage) keyToGeneration(ctx context.Context, key string) (generation keybase1.EkGeneration, err error) {
	prefix, err := s.keyPrefix(ctx)
	if err != nil {
		return generation, err
	}
	if !strings.HasPrefix(key, prefix) {
		return -1, nil
	}
	key = strings.TrimSuffix(key, filepath.Ext(key))
	parts := strings.Split(key, prefix)
	// We can expect two elements in `parts` here since we check
	// strings.HasPrefix above.
	g, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil {
		return generation, err
	}
	return keybase1.EkGeneration(g), nil
}

func (s *DeviceEKStorage) Put(ctx context.Context, generation keybase1.EkGeneration, deviceEK keybase1.DeviceEk) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("DeviceEKStorage#Put: generation:%v", generation), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	key, err := s.key(ctx, generation)
	if err != nil {
		return err
	}
	// Fill in this puppy.
	if deviceEK.Metadata.DeviceCtime == 0 {
		deviceEK.Metadata.DeviceCtime = keybase1.ToTime(time.Now())
	}
	err = s.storage.Put(ctx, key, deviceEK)
	if err != nil {
		return err
	}

	// cache the result
	cache, err := s.getCache(ctx)
	if err != nil {
		return err
	}
	cache[generation] = deviceEK
	return nil
}

func (s *DeviceEKStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	s.Lock()
	defer s.Unlock()

	// Try the cache first
	cache, err := s.getCache(ctx)
	if err != nil {
		return deviceEK, err
	}
	deviceEK, ok := cache[generation]
	if ok {
		return deviceEK, nil
	}
	// Try persistent storage.
	deviceEK, err = s.get(ctx, generation)
	if err != nil {
		return deviceEK, err
	}
	// cache the result
	cache[generation] = deviceEK
	return deviceEK, nil
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
			s.G().Log.CDebugf(ctx, "DeviceEKStorage#get: corrupted generation: %s -> %s: %v", key, generation, err)
			if ierr := s.storage.Erase(ctx, key); ierr != nil {
				s.G().Log.CDebugf(ctx, "DeviceEKStorage#get: unable to delete corrupted generation: %v", ierr)
			}
		}
		return deviceEK, err
	}
	return deviceEK, nil
}

func (s *DeviceEKStorage) Delete(ctx context.Context, generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.delete(ctx, generation)
}

func (s *DeviceEKStorage) delete(ctx context.Context, generation keybase1.EkGeneration) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("DeviceEKStorage#delete: generation:%v", generation), func() error { return err })()

	// clear the cache
	cache, err := s.getCache(ctx)
	if err != nil {
		return err
	}
	delete(cache, generation)
	key, err := s.key(ctx, generation)
	if err != nil {
		return err
	}
	return s.storage.Erase(ctx, key)
}

func (s *DeviceEKStorage) getCache(ctx context.Context) (cache DeviceEKMap, err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#getCache", func() error { return err })()

	if !s.indexed {
		keys, err := s.storage.AllKeys(ctx)
		if err != nil {
			return nil, err
		}
		for _, key := range keys {
			generation, err := s.keyToGeneration(ctx, key)
			if err != nil {
				return nil, err
			}
			if generation < 0 {
				s.G().Log.CDebugf(ctx, "getCache: invalid generation: %s -> %s", key, generation)
				continue
			}
			deviceEK, err := s.get(ctx, generation)
			if err != nil {
				switch err.(type) {
				case erasablekv.UnboxError:
					s.G().Log.Debug("DeviceEKStorage#getCache failed to get item from storage: %v", err)
					continue
				default:
					return nil, err
				}
			}
			s.cache[generation] = deviceEK
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
	s.cache = make(DeviceEKMap)
	s.indexed = false
}

func (s *DeviceEKStorage) GetAll(ctx context.Context) (deviceEKs DeviceEKMap, err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#GetAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	return s.getCache(ctx)
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
	for _, deviceEK := range cache {
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
	keys, err := s.storage.AllKeys(ctx)
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
	for generation := range cache {
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
	for generation, deviceEK := range cache {
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

	// Sort the generations we have so we can walk through them in order.
	for i, generation := range keys {
		keyCtime := keyMap[generation].Time()

		expiryOffset1 := libkb.MaxEphemeralKeyStaleness
		if i < len(keys)-1 {
			expiryOffset1 = keyMap[keys[i+1]].Time().Sub(keyCtime)
			// Offset can be max libkb.MaxEphemeralKeyStaleness
			if expiryOffset1 > libkb.MaxEphemeralKeyStaleness {
				expiryOffset1 = libkb.MaxEphemeralKeyStaleness
			}
		}

		expiryOffset2 := libkb.MaxEphemeralKeyStaleness
		if i < len(keys)-2 {
			expiryOffset2 = keyMap[keys[i+2]].Time().Sub(keyMap[keys[i+1]].Time())
			// Offset can be max libkb.MaxEphemeralKeyStaleness
			if expiryOffset2 > libkb.MaxEphemeralKeyStaleness {
				expiryOffset2 = libkb.MaxEphemeralKeyStaleness
			}
		}

		expiryOffset := expiryOffset1 + expiryOffset2
		if now.Sub(keyCtime) >= (libkb.MinEphemeralKeyLifetime + expiryOffset) {
			s.G().Log.CDebugf(ctx, "getExpiredGenerations: expired generation:%v, now: %v, keyCtime:%v, expiryOffset:%v, keyMap: %v, i:%v",
				generation, now, keyCtime, expiryOffset, keyMap, i)
			expired = append(expired, generation)
		}
	}
	return expired
}

func (s *DeviceEKStorage) deletedWrongEldestSeqno(ctx context.Context) (err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#deletedWrongEldestSeqno", func() error { return err })()

	keys, err := s.storage.AllKeys(ctx)
	if err != nil {
		return err
	}
	uv, err := getCurrentUserUV(ctx, s.G())
	if err != nil {
		return err
	}
	epick := libkb.FirstErrorPicker{}
	for _, key := range keys {
		eldestSeqno, err := s.keyToEldestSeqno(key)
		if err != nil || eldestSeqno < 0 {
			s.G().Log.CDebugf(ctx, "deletedWrongEldestSeqno: skipping delete, invalid keyToEldestSeqno: %s -> %s, error: %s", key, eldestSeqno, err)
			continue
		}
		if eldestSeqno != uv.EldestSeqno {
			epick.Push(s.storage.Erase(ctx, key))
		}
	}
	return epick.Error()
}

func (s *DeviceEKStorage) ForceDeleteAll(ctx context.Context, username libkb.NormalizedUsername) (err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#ForceDeleteAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	// only delete if the key is owned by the current user
	keys, err := s.listAllForUser(ctx, username)
	if err != nil {
		return err
	}
	epick := libkb.FirstErrorPicker{}
	for _, key := range keys {
		epick.Push(s.storage.Erase(ctx, key))
	}

	s.clearCache()
	return epick.Error()
}
