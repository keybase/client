package libkb

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// TODO consolidate these types when deviceEK generation is merged

// TODO Move this stuff to it's own file for all exploding messages typedefs
const EKSeedLen = 32
const deviceEKPrefix = "device-ephemeral-key-"

type DeviceEKSeed [EKSeedLen]byte
type DeviceEKGeneration uint


func (d *DeviceEKSeed) Bytes() []byte{
	return d[:]
}

func newDeviceEKSeedFromBytes(b []byte) (seed DeviceEphemeralSeed, err error) {
	if len(b) != EphemeralSeedLen {
		err = fmt.Errorf("Wrong EphemeralSeedLen len: %d != %d", len(b), EphemeralSeedLen)
		return seed, err
	}
	copy(seed[:], b)
	return seed, nil
}

type DeviceEK struct {
	Generation    DeviceEKGeneration `codec:"V"`
	HashMeta      keybase1.HashMeta `codec:"HM"`
	Seed          DeviceEphemeralSeed `codec:"S"`
}

func NewDeviceEKFromPacket(g *GlobalContext, packet KeybasePacket) (deviceEK DeviceEK, err error) {
		deviceEK, ok := packet.Body.(*DeviceEK)
		if !ok {
			return deviceEK, fmt.Errorf("Bad deviceEK sequence; got packet of wrong type %T", e.Body)
		}
		encryptionKey, err := g.ActiveDevice.EncryptionKey()
		if err != nil {
			return deviceEK, err
		}
		msg, _, err = encryptionKey.DecryptFromString(deviceEK.EncryptedSeed)
		if err != nil {
			return deviceEK, err
		}
		seed, err := newDeviceEKSeedFromBytes(msg)
		if err != nil {
			return deviceEK, nil
		}
		deviceEK.Seed = seed
		return deviceEK, err
	}


func (dek *DeviceEK) ToPacket() (packet *KeybasePacket, err error) {
	return NewKeybasePacket(dek, TagEncryption, KeybasePacketV1)
}

type DeviceEKKeyring struct {
	Contextified
	sync.Mutex
	encryptedDB *encryptedDB.EncryptedDB
}

func NewDeviceEKKeyring(g *GlobalContext) (keyring *DeviceEKKeyring, err error) {
	username := g.Env.GetUsername.String()
	storagePath := filepath.Join(g.Env.GetData(), "device-eks", username)
	err := MakeParentDirs(g.Log, storagePath)
	if err != nil {
		return nil, err
	}
	return &DeviceEKKeyring{
		Contextified: NewContextified(g),
		storagePath: storagePath,
		keys:   make(map[DeviceEKGeneration]*DeviceEK),

	}, nil
}

func (k *DeviceEKKeyring) filepath(generation DeviceEKGeneration) string {
	filename := fmt.Sprintf("%s-%d.ek", deviceEKPrefix, generation)
	return filepath.Join(k.storagePath, filename)
}

func (k *DeviceEKKeyring) Get(generation DeviceEKGeneration) (deviceEK DeviceEK, err error) {
	k.Lock()
	defer k.Unlock()
	return k.get(generation)

func (k *DeviceEKKeyring) get(generation DeviceEKGeneration) (deviceEK DeviceEK, err error) {
	// first let's check if we have a cached copy
	deviceEK, ok := k.keys[generation]
	if ok {
		return deviceEK, nil
	}

	filepath := k.filepath(generation)
	packet, err := k.read(filepath)
	if err != nil {
		return deviceEK, err
	}
	deviceEK, err := newDeviceEKfromPacket(packet)
	if err != nil {
		return deviceEK, err
	}
// cache the result
	k.keys[generation] = deviceEK

	return deviceEK, nil
}
func(k *DeviceEKKeyring) read(filepath string) (packet KeybasePacket, err error) {
	file, err := os.OpenFile(filepath, os.O_RDONLY, 0)
	if err == nil {
		stream := base64.NewDecoder(base64.StdEncoding, file)
		packet, err = DecodePacketUnchecked(stream)
		tmp := file.Close()
		if err == nil && tmp != nil {
			err = tmp
		}
	}
	if err != nil {
		if os.IsNotExist(err) {
			k.G().Log.Debug("| Keybase deviceEK keyring doesn't exist: %s", filepath)
		} else {
			k.G().Log.Warning("Error opening %s: %s", filepath, err)
			MobilePermissionDeniedCheck(g, err, fmt.Sprintf("deviceEK keyring: %s", filepath))
		}
	}
	return packet, error
}

func (k *DeviceEKKeyring) clearWorkingDeviceEK() {
	k.workingDeviceEK = nil
}

func (k *DeviceEKKeyring) Put(generation DeviceEKGeneration, seed DeviceEKSeed, hashMeta keybase1.HashMeta) (err error) {
	k.Lock()
	defer k.Unlock()
	defer k.clearWorkingDeviceEK()

	err = k.delete(generation) // Scrub any existing secrets if they exist
	if err != nil {
		return err
	}

	encryptionKey, err := k.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return deviceEK, err
	}
	encryptedSeed, err = encryptionKey.EncryptToString(seed.Bytes())
	if err != nil {
		return err
	}
	deviceEK :=DeviceEK{
		// We're writing this to disk so we don't want the seed here.
		Generation:    generation,
		HashMeta:      hashMeta,
		EncryptedSeed: encryptedSeed,
	}

	// SafeWriteToFile needs this for the interface implementation.
	k.workingDeviceEK = &deviceEK

	err := SafeWriteToFile(k.G().Log, k, 0)
	if err != nil {
		return err
	}

	deviceEK.Seed = seed
	k.keys[generation] = deviceEK
	return nil
}

func (k *DeviceEKKeyring) GetFilename() string {
	// set this up for tmp storage for working generation
	return k.filepath(k.workingDeviceEK.Generation)
}

func (k *DeviceEKKeyring) WriteTo(w io.Writer) (int64, error) {
	k.G().Log.Debug("+ DeviceEKKeyring WriteTo")
	defer k.G().Log.Debug("- DeviceEKKeyring WriteTo")

	packet, err := k.workingDeviceEK.ToPacket()
	if err != nil {
		return err
	}
	b64 := base64.NewEncoder(base64.StdEncoding, w)
	defer b64.Close()

	if err = packet.EncodeTo(b64); err != nil {
		k.G().Log.Warning("Encoding problem: %s", err)
		return 0, err
	}

	// explicitly check for error on Close:
	if err := b64.Close(); err != nil {
		k.G().Log.Warning("DeviceEKKeyring: WriteTo b64.Close() error: %s", err)
		return 0, err
	}
	k.G().Log.Debug("DeviceEKKeyring: b64 stream closed successfully")

	return 0, nil
}

func (k *DeviceEKKeyring) Delete(generation DeviceEKGeneration) error {
	k.Lock()
	defer k.Unlock()
	return k.delete(generation)
}

func (k *DeviceEKKeyring) delete(generation DeviceEKGeneration) error {
	// clear the cache
	delete(k.keys, generation)

	filepath := k.filepath(generation)
	exists, err := FileExists(filepath)
	if err != nil {
		return err
	}
	if exists {
		err = ShredFile(path)
		if err != nil {
			return err
		}
	}
	return nil
}

func (k *DeviceEKKeyring) index() (err error) {
	k.Lock()
	defer k.Unlock()
	files, err := filepath.Glob(filepath.Join(k.storagePath, "*.ek"))
	if err != nil {
		return err
	}

	for _, file := range files {
		if strings.HasPrefix(file, deviceEKPrefix) {
			parts := strings.Split(file, deviceEKPrefix)
			generation, err := strconv.ParseUint(parts[1], 10, 64)
			if err != nil {
				return err
			}
			deviceEK, err = k.get(generation)
			if err != nil {
				return err
			}
			k.keys[generation] = deviceEK
		}
	}
	return nil
}

func (k *DeviceEKKeyring) GetAllDeviceEKs() (deviceEKs map[DeviceEKGeneration]DeviceEphemeralSeed, err error) {
	err := k.index()
	return k.keys, err
}

func (k *DeviceEKKeyring) GetMaxGeneration() (maxGeneration DeviceEKGeneration, err error) {
	err := k.index()
	if err != nil {
		return maxGeneration, err
	}
	for generation, _ := range k.keys {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}

// Store TeamData's on disk. Threadsafe.
type DiskStorage struct {
	libkb.Contextified
	sync.Mutex
	encryptedDB *encrypteddb.EncryptedDB
}

// Increment to invalidate the disk cache.
const diskStorageVersion = 9

type DiskStorageItem struct {
	Version int                `codec:"V"`
	State   *keybase1.TeamData `codec:"S"`
}

func NewDiskStorage(g *libkb.GlobalContext) *DiskStorage {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return getLocalStorageSecretBoxKey(ctx, g)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return &DiskStorage{
		Contextified: libkb.NewContextified(g),
		encryptedDB:  encrypteddb.New(g, dbFn, keyFn),
	}
}

func (s *DiskStorage) Put(ctx context.Context, state *keybase1.TeamData) error {
	s.Lock()
	defer s.Unlock()

	if !s.G().ActiveDevice.Valid() && state.Chain.Public {
		s.G().Log.CDebugf(ctx, "skipping team store since user is logged out")
		return nil
	}

	key := s.dbKey(ctx, state.Chain.Id, state.Chain.Public)
	item := DiskStorageItem{
		Version: diskStorageVersion,
		State:   state,
	}

	err := s.encryptedDB.Put(ctx, key, item)
	if err != nil {
		return err
	}
	return nil
}

// Res is valid if (found && err == nil)
func (s *DiskStorage) Get(ctx context.Context, teamID keybase1.TeamID, public bool) (res *keybase1.TeamData, found bool, err error) {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, teamID, public)
	var item DiskStorageItem
	found, err = s.encryptedDB.Get(ctx, key, &item)
	if (err != nil) || !found {
		return res, found, err
	}

	if item.Version != diskStorageVersion {
		// Pretend it wasn't found.
		return res, false, nil
	}

	// Sanity check
	if len(item.State.Chain.Id) == 0 {
		return res, false, fmt.Errorf("decode from disk had empty team id")
	}
	if !item.State.Chain.Id.Eq(teamID) {
		return res, false, fmt.Errorf("decode from disk had wrong team id %v != %v", item.State.Chain.Id, teamID)
	}
	if item.State.Chain.Public != public {
		return res, false, fmt.Errorf("decode from disk had wrong publicness %v != %v (%v)", item.State.Chain.Public, public, teamID)
	}

	return item.State, true, nil
}

func (s *DiskStorage) Delete(ctx context.Context, teamID keybase1.TeamID, public bool) error {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, teamID, public)
	return s.encryptedDB.Delete(ctx, key)
}

func (s *DiskStorage) dbKey(ctx context.Context, teamID keybase1.TeamID, public bool) libkb.DbKey {
	key := fmt.Sprintf("tid:%s", teamID)
	if public {
		key = fmt.Sprintf("tid:%s|pub", teamID)
	}
	return libkb.DbKey{
		Typ: libkb.DBChatInbox,
		Key: key,
	}
}

// --------------------------------------------------

const MemCacheLRUSize = 200

// Store some TeamSigChainState's in memory. Threadsafe.
type MemoryStorage struct {
	libkb.Contextified
	lru *lru.Cache
}

func NewMemoryStorage(g *libkb.GlobalContext) *MemoryStorage {
	nlru, err := lru.New(MemCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &MemoryStorage{
		Contextified: libkb.NewContextified(g),
		lru:          nlru,
	}
}

func (s *MemoryStorage) Put(ctx context.Context, state *keybase1.TeamData) {
	s.lru.Add(s.key(state.Chain.Id, state.Chain.Public), state)
}

// Can return nil.
func (s *MemoryStorage) Get(ctx context.Context, teamID keybase1.TeamID, public bool) *keybase1.TeamData {
	untyped, ok := s.lru.Get(s.key(teamID, public))
	if !ok {
		return nil
	}
	state, ok := untyped.(*keybase1.TeamData)
	if !ok {
		s.G().Log.Warning("Team MemoryStorage got bad type from lru: %T", untyped)
		return nil
	}
	return state
}

func (s *MemoryStorage) Delete(ctx context.Context, teamID keybase1.TeamID, public bool) {
	s.lru.Remove(s.key(teamID, public))
}

func (s *MemoryStorage) Clear() {
	s.lru.Purge()
}

func (s *MemoryStorage) key(teamID keybase1.TeamID, public bool) (key string) {
	key = fmt.Sprintf("tid:%s", teamID)
	if public {
		key = fmt.Sprintf("tid:%s|pub", teamID)
	}
	return key
}

// --------------------------------------------------

func getLocalStorageSecretBoxKey(ctx context.Context, g *libkb.GlobalContext) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, getLameSecretUI, libkb.DeviceEncryptionKeyType,
		"encrypt teams storage")
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonTeamsLocalStorage)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}

type LameSecretUI struct{}

func (d LameSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

var getLameSecretUI = func() libkb.SecretUI { return LameSecretUI{} }
