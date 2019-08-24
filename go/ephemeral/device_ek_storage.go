package ephemeral

import (
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

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
	sync.Mutex
	storage libkb.ErasableKVStore
	cache   deviceEKCache
	indexed bool
	logger  *log.Logger
}

func getLogger(mctx libkb.MetaContext) *log.Logger {
	filename := mctx.G().Env.GetEKLogFile()

	lfc := &logger.LogFileConfig{
		Path:               filename,
		MaxAge:             30 * 24 * time.Hour, // 30 days
		MaxKeepFiles:       3,
		SkipRedirectStdErr: true,
	}
	switch mctx.G().GetAppType() {
	case libkb.MobileAppType:
		lfc.MaxSize = 1 * 1024 * 1024 // 1mb
	default:
		lfc.MaxSize = 128 * 1024 * 1024 // 128mb
	}
	lfw := logger.NewLogFileWriter(*lfc)
	if err := lfw.Open(time.Now()); err != nil {
		mctx.Debug("Unable to getLogger %v", err)
		return nil
	}
	l := log.New(lfw, getLogPrefix(mctx), log.LstdFlags|log.Lshortfile)
	return l
}

func getLogPrefix(mctx libkb.MetaContext) string {
	return fmt.Sprintf("[username=%v] ", mctx.G().Env.GetUsername())
}

func getLocalStorageSecretBoxKey(mctx libkb.MetaContext) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := mctx.ActiveDevice().EncryptionKey()
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonErasableKVLocalStorage)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}

func deviceEKKeygen(mctx libkb.MetaContext, noiseBytes libkb.NoiseBytes) (fkey [32]byte, err error) {
	enckey, err := getLocalStorageSecretBoxKey(mctx)
	if err != nil {
		return fkey, err
	}

	xor, err := libkb.NoiseXOR(enckey, noiseBytes)
	if err != nil {
		return fkey, err
	}
	copy(fkey[:], xor)
	return fkey, nil
}

func NewDeviceEKStorage(mctx libkb.MetaContext) *DeviceEKStorage {
	return &DeviceEKStorage{
		storage: libkb.NewFileErasableKVStore(mctx, deviceEKSubDir, deviceEKKeygen),
		cache:   make(deviceEKCache),
		logger:  getLogger(mctx),
	}
}

func (s *DeviceEKStorage) SetLogPrefix(mctx libkb.MetaContext) {
	s.Lock()
	defer s.Unlock()
	if s.logger != nil {
		s.logger.SetPrefix(getLogPrefix(mctx))
	}
}

// Log sensitive deletion actions to a separate log file so we don't lose the
// logs during normal rotation.
func (s *DeviceEKStorage) ekLogf(mctx libkb.MetaContext, format string, args ...interface{}) {
	mctx.Debug(format, args...)
	if s.logger != nil {
		s.logger.Printf(format, args...)
	}
}

func (s *DeviceEKStorage) ekLogCTraceTimed(mctx libkb.MetaContext, msg string, f func() error) func() {
	if s.logger != nil {
		s.logger.Print(msg)
	}
	return mctx.TraceTimed(msg, f)
}

func (s *DeviceEKStorage) keyPrefixFromUsername(username libkb.NormalizedUsername) string {
	return fmt.Sprintf("%s-%s-", deviceEKPrefix, username)
}

func (s *DeviceEKStorage) keyPrefix(mctx libkb.MetaContext) (prefix string, err error) {
	uv, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return prefix, err
	}
	username := mctx.ActiveDevice().Username(mctx)
	return fmt.Sprintf("%s%s-", s.keyPrefixFromUsername(username), uv.EldestSeqno), nil
}

func (s *DeviceEKStorage) key(mctx libkb.MetaContext, generation keybase1.EkGeneration) (key string, err error) {
	prefix, err := s.keyPrefix(mctx)
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
func (s *DeviceEKStorage) keyToEldestSeqno(mctx libkb.MetaContext, key string) keybase1.Seqno {
	if !strings.HasPrefix(key, deviceEKPrefix) {
		return -1
	}
	parts := strings.Split(key, "-")
	if len(parts) != 4 {
		return -1
	}
	// Make sure this key is for our current user and not a different one.
	username := mctx.ActiveDevice().Username(mctx)
	if parts[1] != username.String() {
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
func (s *DeviceEKStorage) keyToGeneration(mctx libkb.MetaContext, key string) keybase1.EkGeneration {
	prefix, err := s.keyPrefix(mctx)
	if err != nil {
		mctx.Debug("keyToGeneration: unable to get keyPrefix: %v", err)
		return -1
	}
	if !strings.HasPrefix(key, prefix) || !strings.HasSuffix(key, deviceEKSuffix) {
		mctx.Debug("keyToGeneration: key missing prefix: %v or suffix: %s", prefix, deviceEKSuffix)
		return -1
	}

	key = strings.TrimSuffix(key, deviceEKSuffix)
	parts := strings.Split(key, prefix)
	if len(parts) != 2 {
		mctx.Debug("keyToGeneration: unexpected parts: %v, prefix: %v", parts)
		return -1
	}
	g, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil {
		mctx.Debug("keyToGeneration: unable to parseUint: %v", err)
		return -1
	}
	return keybase1.EkGeneration(g)
}

func (s *DeviceEKStorage) Put(mctx libkb.MetaContext, generation keybase1.EkGeneration, deviceEK keybase1.DeviceEk) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("DeviceEKStorage#Put: generation:%v", generation), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	// sanity check that we got the right generation
	if deviceEK.Metadata.Generation != generation {
		return newEKCorruptedErr(mctx, DeviceEKKind, generation, deviceEK.Metadata.Generation)
	}

	key, err := s.key(mctx, generation)
	if err != nil {
		return err
	}
	// Fill in this puppy.
	if deviceEK.Metadata.DeviceCtime == 0 {
		deviceEK.Metadata.DeviceCtime = keybase1.ToTime(time.Now())
	}
	if err = s.storage.Put(mctx, key, deviceEK); err != nil {
		return err
	}

	// cache the result
	cache, err := s.getCache(mctx)
	if err != nil {
		return err
	}
	cache[generation] = deviceEKCacheItem{
		DeviceEK: deviceEK,
		Err:      nil,
	}
	return nil
}

func (s *DeviceEKStorage) Get(mctx libkb.MetaContext, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("DeviceEKStorage#Get: generation:%v", generation), func() error { return err })()
	s.Lock()
	defer s.Unlock()

	// Try the cache first
	cache, err := s.getCache(mctx)
	if err != nil {
		return deviceEK, err
	}
	cacheItem, ok := cache[generation]
	if ok {
		return cacheItem.DeviceEK, cacheItem.Err
	}
	// Try persistent storage.
	deviceEK, err = s.get(mctx, generation)
	switch err.(type) {
	case nil, libkb.UnboxError:
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

func (s *DeviceEKStorage) get(mctx libkb.MetaContext, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("DeviceEKStorage#get: generation:%v", generation), func() error { return err })()

	key, err := s.key(mctx, generation)
	if err != nil {
		return deviceEK, err
	}

	if err = s.storage.Get(mctx, key, &deviceEK); err != nil {
		if _, ok := err.(libkb.UnboxError); ok {
			s.ekLogf(mctx, "DeviceEKStorage#get: corrupted generation: %v -> %v: %v", key, generation, err)
			if ierr := s.storage.Erase(mctx, key); ierr != nil {
				s.ekLogf(mctx, "DeviceEKStorage#get: unable to delete corrupted generation: %v", ierr)
			}
		}
		return deviceEK, err
	}
	// sanity check that we got the right generation
	if deviceEK.Metadata.Generation != generation {
		return deviceEK, newEKCorruptedErr(mctx, DeviceEKKind, generation, deviceEK.Metadata.Generation)
	}
	return deviceEK, nil
}

func (s *DeviceEKStorage) Delete(mctx libkb.MetaContext, generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.delete(mctx, generation)
}

func (s *DeviceEKStorage) delete(mctx libkb.MetaContext, generation keybase1.EkGeneration) (err error) {
	defer s.ekLogCTraceTimed(mctx, fmt.Sprintf("DeviceEKStorage#delete: generation:%v", generation), func() error { return err })()

	// clear the cache
	cache, err := s.getCache(mctx)
	if err != nil {
		return err
	}
	key, err := s.key(mctx, generation)
	if err != nil {
		return err
	}
	if err = s.storage.Erase(mctx, key); err != nil {
		return err
	}
	delete(cache, generation)
	return nil
}

func (s *DeviceEKStorage) getCache(mctx libkb.MetaContext) (cache deviceEKCache, err error) {
	if !s.indexed {
		keys, err := s.storage.AllKeys(mctx, deviceEKSuffix)
		if err != nil {
			return nil, err
		}
		for _, key := range keys {
			generation := s.keyToGeneration(mctx, key)
			if generation < 0 {
				mctx.Debug("DeviceEKStorage#getCache: unable to get generation from key: %s", key)
				continue
			}
			deviceEK, err := s.get(mctx, generation)
			switch err.(type) {
			case nil, libkb.UnboxError:
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

func (s *DeviceEKStorage) GetAll(mctx libkb.MetaContext) (deviceEKs DeviceEKMap, err error) {
	defer mctx.TraceTimed("DeviceEKStorage#GetAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(mctx)
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

func (s *DeviceEKStorage) GetAllActive(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (metadatas []keybase1.DeviceEkMetadata, err error) {
	defer mctx.TraceTimed("GetAllActive", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(mctx)
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
func (s *DeviceEKStorage) ListAllForUser(mctx libkb.MetaContext) (all []string, err error) {
	defer mctx.TraceTimed("DeviceEKStorage#ListAllForUser", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	return s.listAllForUser(mctx, mctx.ActiveDevice().Username(mctx))
}

func (s *DeviceEKStorage) listAllForUser(mctx libkb.MetaContext, username libkb.NormalizedUsername) (all []string, err error) {
	// key in the sense of a key-value pair, not a crypto key!
	keys, err := s.storage.AllKeys(mctx, deviceEKSuffix)
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

func (s *DeviceEKStorage) MaxGeneration(mctx libkb.MetaContext, includeErrs bool) (maxGeneration keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed("DeviceEKStorage#MaxGeneration", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	maxGeneration = -1
	cache, err := s.getCache(mctx)
	if err != nil {
		return maxGeneration, err
	}
	for generation, cacheItem := range cache {
		if cacheItem.Err != nil && !includeErrs {
			continue
		}
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}

func (s *DeviceEKStorage) DeleteExpired(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (expired []keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed("DeviceEKStorage#DeleteExpired", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(mctx)
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

	expired = s.getExpiredGenerations(mctx, keyMap, now)
	epick := libkb.FirstErrorPicker{}
	for _, generation := range expired {
		epick.Push(s.delete(mctx, generation))
	}

	epick.Push(s.deletedWrongEldestSeqno(mctx))
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
func (s *DeviceEKStorage) getExpiredGenerations(mctx libkb.MetaContext, keyMap keyExpiryMap, now time.Time) (expired []keybase1.EkGeneration) {
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
			s.ekLogf(mctx, "getExpiredGenerations: expired generation:%v, now: %v, keyCtime:%v, expiryOffset:%v, keyMap: %v, i:%v",
				generation, now, keyCtime, expiryOffset, keyMap, i)
			expired = append(expired, generation)
		}
	}
	return expired
}

func (s *DeviceEKStorage) deletedWrongEldestSeqno(mctx libkb.MetaContext) (err error) {
	keys, err := s.storage.AllKeys(mctx, deviceEKSuffix)
	if err != nil {
		return err
	}
	uv, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return err
	}
	epick := libkb.FirstErrorPicker{}
	for _, key := range keys {
		eldestSeqno := s.keyToEldestSeqno(mctx, key)
		if eldestSeqno < 0 {
			continue
		}
		if eldestSeqno != uv.EldestSeqno {
			s.ekLogf(mctx, "DeviceEKStorage#deletedWrongEldestSeqno: key: %v, uv: %v", key, uv)
			epick.Push(s.storage.Erase(mctx, key))
		}
	}
	return epick.Error()
}

func (s *DeviceEKStorage) ForceDeleteAll(mctx libkb.MetaContext, username libkb.NormalizedUsername) (err error) {
	defer s.ekLogCTraceTimed(mctx, "DeviceEKStorage#ForceDeleteAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	// only delete if the key is owned by the current user
	keys, err := s.listAllForUser(mctx, username)
	if err != nil {
		return err
	}
	epick := libkb.FirstErrorPicker{}
	for _, key := range keys {
		s.ekLogf(mctx, "DeviceEKStorage#ForceDeleteAll: key: %v", key)
		epick.Push(s.storage.Erase(mctx, key))
	}

	s.clearCache()
	return epick.Error()
}
