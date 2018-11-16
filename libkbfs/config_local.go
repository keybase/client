// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"flag"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/cache"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsedits"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	metrics "github.com/rcrowley/go-metrics"
	"github.com/shirou/gopsutil/mem"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
	"golang.org/x/net/trace"
)

const (
	// Max supported size of a directory entry name.
	maxNameBytesDefault = 255
	// Default time after setting the rekey bit before prompting for a
	// paper key.
	rekeyWithPromptWaitTimeDefault = 10 * time.Minute
	// see Config doc for the purpose of DelayedCancellationGracePeriod
	delayedCancellationGracePeriodDefault = 2 * time.Second
	// tlfValidDurationDefault is the default for tlf validity before redoing identify.
	tlfValidDurationDefault = 6 * time.Hour
	// bgFlushDirOpThresholdDefault is the default for how many
	// directory operations should be batched together in a single
	// background flush.
	bgFlushDirOpBatchSizeDefault = 100
	// bgFlushPeriodDefault is the default for how long to wait for a
	// batch to fill up before syncing a set of changes to the servers.
	bgFlushPeriodDefault         = 1 * time.Second
	keyBundlesCacheCapacityBytes = 10 * cache.MB
	// folder name for persisted config parameters.
	syncedTlfConfigFolderName = "synced_tlf_config"

	// By default, this will be the block type given to all blocks
	// that aren't explicitly some other type.
	defaultBlockTypeDefault = keybase1.BlockType_DATA

	// By default, allow 10% of the free bytes on disk to be used in the disk block cache.
	defaultDiskBlockCacheFraction = 0.10

	// By default, allow 100% of the free bytes on disk to be used in the sync
	// block cache.
	defaultSyncBlockCacheFraction = 1.00

	// By default, use v1 block encryption.
	defaultBlockCryptVersion = kbfscrypto.EncryptionSecretbox
)

// ConfigLocal implements the Config interface using purely local
// server objects (no KBFS operations used RPCs).
type ConfigLocal struct {
	lock             sync.RWMutex
	kbfs             KBFSOps
	keyman           KeyManager
	rep              Reporter
	kcache           KeyCache
	kbcache          kbfsmd.KeyBundleCache
	bcache           BlockCache
	dirtyBcache      DirtyBlockCache
	diskBlockCache   DiskBlockCache
	diskMDCache      DiskMDCache
	diskQuotaCache   DiskQuotaCache
	codec            kbfscodec.Codec
	mdops            MDOps
	kops             KeyOps
	crypto           Crypto
	chat             Chat
	mdcache          MDCache
	bops             BlockOps
	mdserv           MDServer
	bserv            BlockServer
	keyserv          KeyServer
	service          KeybaseService
	bsplit           BlockSplitter
	notifier         Notifier
	clock            Clock
	kbpki            KBPKI
	renamer          ConflictRenamer
	userHistory      *kbfsedits.UserHistory
	registry         metrics.Registry
	loggerFn         func(prefix string) logger.Logger
	noBGFlush        bool // logic opposite so the default value is the common setting
	rwpWaitTime      time.Duration
	diskLimiter      DiskLimiter
	syncedTlfs       map[tlf.ID]FolderSyncConfig
	defaultBlockType keybase1.BlockType
	kbfsService      *KBFSService
	kbCtx            Context
	rootNodeWrappers []func(Node) Node
	tlfClearCancels  map[tlf.ID]context.CancelFunc

	maxNameBytes           uint32
	rekeyQueue             RekeyQueue
	storageRoot            string
	diskCacheMode          DiskCacheMode
	diskBlockCacheFraction float64
	syncBlockCacheFraction float64

	traceLock    sync.RWMutex
	traceEnabled bool

	delayedCancellationGracePeriod time.Duration

	// allKnownConfigsForTesting is used for testing, and contains all created
	// Config objects in this test.
	allKnownConfigsForTesting *[]Config

	// tlfValidDuration is the time TLFs are valid before redoing identification.
	tlfValidDuration time.Duration

	// bgFlushDirOpBatchSize indicates how many directory operations
	// should be batched together in a single background flush.
	bgFlushDirOpBatchSize int

	// bgFlushPeriod indicates how long to wait for a batch to fill up
	// before syncing a set of changes to the servers.
	bgFlushPeriod time.Duration

	// metadataVersion is the version to use when creating new metadata.
	metadataVersion kbfsmd.MetadataVer

	// blockCryptVersion is the version to use when encrypting blocks.
	blockCryptVersion kbfscrypto.EncryptionVer

	mode InitMode

	quotaUsage      map[keybase1.UserOrTeamID]*EventuallyConsistentQuotaUsage
	rekeyFSMLimiter *OngoingWorkLimiter
}

// DiskCacheMode represents the mode of initialization for the disk cache.
type DiskCacheMode int

var _ flag.Value = (*DiskCacheMode)(nil)

const (
	// DiskCacheModeOff indicates to leave off the disk cache.
	DiskCacheModeOff DiskCacheMode = iota
	// DiskCacheModeLocal indicates to use a local disk cache.
	DiskCacheModeLocal
	// DiskCacheModeRemote indicates to use a remote disk cache.
	DiskCacheModeRemote
)

// String outputs a human-readable description of this DiskBlockCacheMode.
func (m DiskCacheMode) String() string {
	switch m {
	case DiskCacheModeOff:
		return "off"
	case DiskCacheModeLocal:
		return "local"
	case DiskCacheModeRemote:
		return "remote"
	}
	return "unknown"
}

// Set parses a string representing a disk block cache initialization mode,
// and outputs the mode value corresponding to that string. Defaults to
// DiskCacheModeOff.
func (m *DiskCacheMode) Set(s string) error {
	*m = DiskCacheModeOff
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "local":
		*m = DiskCacheModeLocal
	case "remote":
		*m = DiskCacheModeRemote
	}
	return nil
}

var _ Config = (*ConfigLocal)(nil)

// LocalUser represents a fake KBFS user, useful for testing.
type LocalUser struct {
	UserInfo
	Asserts []string
	// Index into UserInfo.CryptPublicKeys.
	CurrentCryptPublicKeyIndex int
	// Index into UserInfo.VerifyingKeys.
	CurrentVerifyingKeyIndex int
	// Unverified keys.
	UnverifiedKeys []keybase1.PublicKey
}

// GetCurrentCryptPublicKey returns this LocalUser's public encryption key.
func (lu *LocalUser) GetCurrentCryptPublicKey() kbfscrypto.CryptPublicKey {
	return lu.CryptPublicKeys[lu.CurrentCryptPublicKeyIndex]
}

// GetCurrentVerifyingKey returns this LocalUser's public signing key.
func (lu *LocalUser) GetCurrentVerifyingKey() kbfscrypto.VerifyingKey {
	return lu.VerifyingKeys[lu.CurrentVerifyingKeyIndex]
}

func verifyingKeysToPublicKeys(
	keys []kbfscrypto.VerifyingKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.KID(),
			IsSibkey: true,
		}
	}
	return publicKeys
}

func cryptPublicKeysToPublicKeys(
	keys []kbfscrypto.CryptPublicKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.KID(),
			IsSibkey: false,
		}
	}
	return publicKeys
}

// GetPublicKeys returns all of this LocalUser's public encryption keys.
func (lu *LocalUser) GetPublicKeys() []keybase1.PublicKey {
	sibkeys := verifyingKeysToPublicKeys(lu.VerifyingKeys)
	subkeys := cryptPublicKeysToPublicKeys(lu.CryptPublicKeys)
	return append(sibkeys, subkeys...)
}

func (lu LocalUser) deepCopy() LocalUser {
	luCopy := lu

	luCopy.VerifyingKeys = make(
		[]kbfscrypto.VerifyingKey, len(lu.VerifyingKeys))
	copy(luCopy.VerifyingKeys, lu.VerifyingKeys)

	luCopy.CryptPublicKeys = make(
		[]kbfscrypto.CryptPublicKey, len(lu.CryptPublicKeys))
	copy(luCopy.CryptPublicKeys, lu.CryptPublicKeys)

	luCopy.KIDNames = make(map[keybase1.KID]string, len(lu.KIDNames))
	for k, v := range lu.KIDNames {
		luCopy.KIDNames[k] = v
	}

	luCopy.RevokedVerifyingKeys = make(
		map[kbfscrypto.VerifyingKey]revokedKeyInfo,
		len(lu.RevokedVerifyingKeys))
	for k, v := range lu.RevokedVerifyingKeys {
		luCopy.RevokedVerifyingKeys[k] = v
	}

	luCopy.RevokedCryptPublicKeys = make(
		map[kbfscrypto.CryptPublicKey]revokedKeyInfo,
		len(lu.RevokedCryptPublicKeys))
	for k, v := range lu.RevokedCryptPublicKeys {
		luCopy.RevokedCryptPublicKeys[k] = v
	}

	luCopy.Asserts = make([]string, len(lu.Asserts))
	copy(luCopy.Asserts, lu.Asserts)
	luCopy.UnverifiedKeys = make([]keybase1.PublicKey, len(lu.UnverifiedKeys))
	copy(luCopy.UnverifiedKeys, lu.UnverifiedKeys)

	return luCopy
}

// Helper functions to get a various keys for a local user suitable
// for use with CryptoLocal. Each function will return the same key
// will always be returned for a given user.

// MakeLocalUserSigningKeyOrBust returns a unique signing key for this user.
func MakeLocalUserSigningKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.SigningKey {
	return kbfscrypto.MakeFakeSigningKeyOrBust(
		string(name) + " signing key")
}

// MakeLocalUserVerifyingKeyOrBust makes a new verifying key
// corresponding to the signing key for this user.
func MakeLocalUserVerifyingKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.VerifyingKey {
	return MakeLocalUserSigningKeyOrBust(name).GetVerifyingKey()
}

// MakeLocalUserCryptPrivateKeyOrBust returns a unique private
// encryption key for this user.
func MakeLocalUserCryptPrivateKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.CryptPrivateKey {
	return kbfscrypto.MakeFakeCryptPrivateKeyOrBust(
		string(name) + " crypt key")
}

// MakeLocalUserCryptPublicKeyOrBust returns the public key
// corresponding to the crypt private key for this user.
func MakeLocalUserCryptPublicKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.CryptPublicKey {
	return MakeLocalUserCryptPrivateKeyOrBust(name).GetPublicKey()
}

// MakeLocalTLFCryptKeyOrBust returns a unique private symmetric key
// for a TLF.
func MakeLocalTLFCryptKeyOrBust(
	name string, keyGen kbfsmd.KeyGen) kbfscrypto.TLFCryptKey {
	// Put the key gen first to make it more likely to fit into the
	// 32-character "random" seed.
	return kbfscrypto.MakeFakeTLFCryptKeyOrBust(
		string(name) + " " + string(keyGen) + " crypt key ")
}

// MakeLocalUsers is a helper function to generate a list of
// LocalUsers suitable to use with KeybaseDaemonLocal.
func MakeLocalUsers(users []kbname.NormalizedUsername) []LocalUser {
	localUsers := make([]LocalUser, len(users))
	for i := 0; i < len(users); i++ {
		verifyingKey := MakeLocalUserVerifyingKeyOrBust(users[i])
		cryptPublicKey := MakeLocalUserCryptPublicKeyOrBust(users[i])
		localUsers[i] = LocalUser{
			UserInfo: UserInfo{
				Name:            users[i],
				UID:             keybase1.MakeTestUID(uint32(i + 1)),
				VerifyingKeys:   []kbfscrypto.VerifyingKey{verifyingKey},
				CryptPublicKeys: []kbfscrypto.CryptPublicKey{cryptPublicKey},
				KIDNames: map[keybase1.KID]string{
					verifyingKey.KID(): "dev1",
				},
			},
			CurrentCryptPublicKeyIndex: 0,
			CurrentVerifyingKeyIndex:   0,
		}
	}
	return localUsers
}

func makeLocalTeams(
	teams []kbname.NormalizedUsername, startingIndex int, ty tlf.Type) (
	localTeams []TeamInfo) {
	localTeams = make([]TeamInfo, len(teams))
	for index := 0; index < len(teams); index++ {
		i := index + startingIndex
		cryptKey := MakeLocalTLFCryptKeyOrBust(
			buildCanonicalPathForTlfType(
				tlf.SingleTeam, string(teams[index])),
			kbfsmd.FirstValidKeyGen)
		localTeams[index] = TeamInfo{
			Name: teams[index],
			TID:  keybase1.MakeTestTeamID(uint32(i+1), ty == tlf.Public),
			CryptKeys: map[kbfsmd.KeyGen]kbfscrypto.TLFCryptKey{
				kbfsmd.FirstValidKeyGen: cryptKey,
			},
			LatestKeyGen: kbfsmd.FirstValidKeyGen,
		}
		// If this is a subteam, set the root ID.
		if strings.Contains(string(teams[index]), ".") {
			parts := strings.SplitN(string(teams[index]), ".", 2)
			for j := 0; j < index; j++ {
				if parts[0] == string(localTeams[j].Name) {
					localTeams[index].RootID = localTeams[j].TID
					break
				}
			}
		}
	}
	return localTeams
}

// MakeLocalTeams is a helper function to generate a list of local
// teams suitable to use with KeybaseDaemonLocal.  Any subteams must come
// after their root team names in the `teams` slice.
func MakeLocalTeams(teams []kbname.NormalizedUsername) []TeamInfo {
	return makeLocalTeams(teams, 0, tlf.Private)
}

// getDefaultCleanBlockCacheCapacity returns the default clean block
// cache capacity. If we can get total RAM of the system, we cap at
// the smaller of <1/4 of available memory> and
// <MaxBlockSizeBytesDefault * DefaultBlocksInMemCache>; otherwise,
// fallback to latter.
func getDefaultCleanBlockCacheCapacity() uint64 {
	capacity := uint64(MaxBlockSizeBytesDefault) * DefaultBlocksInMemCache
	vmstat, err := mem.VirtualMemory()
	if err == nil {
		ramBased := vmstat.Total / 8
		if ramBased < capacity {
			capacity = ramBased
		}
	}
	return capacity
}

// NewConfigLocal constructs a new ConfigLocal with some default
// components that don't depend on a logger. The caller will have to
// fill in the rest.
//
// TODO: Now that NewConfigLocal takes loggerFn, add more default
// components.
func NewConfigLocal(mode InitMode,
	loggerFn func(module string) logger.Logger,
	storageRoot string, diskCacheMode DiskCacheMode,
	kbCtx Context) *ConfigLocal {
	config := &ConfigLocal{
		loggerFn:        loggerFn,
		storageRoot:     storageRoot,
		mode:            mode,
		diskCacheMode:   diskCacheMode,
		kbCtx:           kbCtx,
		tlfClearCancels: make(map[tlf.ID]context.CancelFunc),
	}
	config.SetCodec(kbfscodec.NewMsgpack())
	if diskCacheMode == DiskCacheModeLocal {
		config.loadSyncedTlfsLocked()
	}
	config.SetClock(wallClock{})
	config.SetReporter(NewReporterSimple(config.Clock(), 10))
	config.SetConflictRenamer(WriterDeviceDateConflictRenamer{config})
	config.ResetCaches()
	config.SetKeyOps(&KeyOpsStandard{config})
	config.SetRekeyQueue(NewRekeyQueueStandard(config))
	config.SetUserHistory(kbfsedits.NewUserHistory())

	config.maxNameBytes = maxNameBytesDefault
	config.rwpWaitTime = rekeyWithPromptWaitTimeDefault

	config.delayedCancellationGracePeriod = delayedCancellationGracePeriodDefault
	// Don't bother creating the registry if UseNilMetrics is set, or
	// if we're in minimal mode.
	if !metrics.UseNilMetrics && config.Mode().MetricsEnabled() {
		registry := metrics.NewRegistry()
		config.SetMetricsRegistry(registry)
	}

	config.tlfValidDuration = tlfValidDurationDefault
	config.bgFlushDirOpBatchSize = bgFlushDirOpBatchSizeDefault
	config.bgFlushPeriod = bgFlushPeriodDefault
	config.metadataVersion = defaultClientMetadataVer
	config.defaultBlockType = defaultBlockTypeDefault
	config.quotaUsage =
		make(map[keybase1.UserOrTeamID]*EventuallyConsistentQuotaUsage)
	config.rekeyFSMLimiter = NewOngoingWorkLimiter(config.Mode().RekeyWorkers())
	config.diskBlockCacheFraction = defaultDiskBlockCacheFraction
	config.syncBlockCacheFraction = defaultSyncBlockCacheFraction

	config.blockCryptVersion = defaultBlockCryptVersion

	return config
}

// KBFSOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KBFSOps() KBFSOps {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.kbfs
}

// SetKBFSOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKBFSOps(k KBFSOps) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.kbfs = k
}

// KBPKI implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KBPKI() KBPKI {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.kbpki
}

// CurrentSessionGetter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) CurrentSessionGetter() CurrentSessionGetter {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.kbpki
}

// SetKBPKI implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKBPKI(k KBPKI) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.kbpki = k
}

// KeyManager implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyManager() KeyManager {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.keyman
}

// SetKeyManager implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyManager(k KeyManager) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.keyman = k
}

// KeyGetter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) keyGetter() blockKeyGetter {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.keyman
}

// Reporter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Reporter() Reporter {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.rep
}

// SetReporter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetReporter(r Reporter) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.rep = r
}

// KeyCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyCache() KeyCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.kcache
}

// SetKeyCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyCache(k KeyCache) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.kcache = k
}

// KeyBundleCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyBundleCache() kbfsmd.KeyBundleCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.kbcache
}

// SetKeyBundleCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyBundleCache(k kbfsmd.KeyBundleCache) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.kbcache = k
}

// BlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockCache() BlockCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.bcache
}

// SetBlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockCache(b BlockCache) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.bcache = b
}

// DirtyBlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DirtyBlockCache() DirtyBlockCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.dirtyBcache
}

// SetDirtyBlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetDirtyBlockCache(d DirtyBlockCache) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.dirtyBcache = d
}

// DiskBlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DiskBlockCache() DiskBlockCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.diskBlockCache
}

// SetDiskBlockCacheFraction implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetDiskBlockCacheFraction(fraction float64) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.diskBlockCacheFraction = fraction
}

// SetSyncBlockCacheFraction implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetSyncBlockCacheFraction(fraction float64) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.syncBlockCacheFraction = fraction
}

// DiskMDCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DiskMDCache() DiskMDCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.diskMDCache
}

// DiskQuotaCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DiskQuotaCache() DiskQuotaCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.diskQuotaCache
}

// DiskLimiter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DiskLimiter() DiskLimiter {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.diskLimiter
}

// Crypto implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Crypto() Crypto {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.crypto
}

// Chat implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Chat() Chat {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.chat
}

// Signer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Signer() kbfscrypto.Signer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.crypto
}

// SetCrypto implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetCrypto(cr Crypto) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.crypto = cr
}

// SetChat implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetChat(ch Chat) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.chat = ch
}

// CryptoPure implements the Config interface for ConfigLocal.
func (c *ConfigLocal) cryptoPure() cryptoPure {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.crypto
}

// Codec implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Codec() kbfscodec.Codec {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.codec
}

// SetCodec implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetCodec(co kbfscodec.Codec) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.codec = co
	RegisterOps(c.codec)
}

// MDOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MDOps() MDOps {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.mdops
}

// SetMDOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMDOps(m MDOps) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.mdops = m
}

// KeyOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyOps() KeyOps {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.kops
}

// SetKeyOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyOps(k KeyOps) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.kops = k
}

// MDCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MDCache() MDCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.mdcache
}

// SetMDCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMDCache(m MDCache) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.mdcache = m
}

// BlockOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockOps() BlockOps {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.bops
}

// SetBlockOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockOps(b BlockOps) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.bops = b
}

// MDServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MDServer() MDServer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.mdserv
}

// SetMDServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMDServer(m MDServer) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.mdserv = m
}

// BlockServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockServer() BlockServer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.bserv
}

// SetBlockServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockServer(b BlockServer) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.bserv = b
}

// KeyServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyServer() KeyServer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.keyserv
}

// SetKeyServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyServer(k KeyServer) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.keyserv = k
}

// KeybaseService implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeybaseService() KeybaseService {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.service
}

// SetKeybaseService implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeybaseService(k KeybaseService) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.service = k
}

// BlockSplitter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockSplitter() BlockSplitter {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.bsplit
}

// SetBlockSplitter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockSplitter(b BlockSplitter) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.bsplit = b
}

// Notifier implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Notifier() Notifier {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.notifier
}

// SetNotifier implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetNotifier(n Notifier) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.notifier = n
}

// Clock implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Clock() Clock {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.clock
}

// SetClock implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetClock(cl Clock) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.clock = cl
}

// ConflictRenamer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) ConflictRenamer() ConflictRenamer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.renamer
}

// SetConflictRenamer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetConflictRenamer(cr ConflictRenamer) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.renamer = cr
}

// UserHistory implements the Config interface for ConfigLocal.
func (c *ConfigLocal) UserHistory() *kbfsedits.UserHistory {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.userHistory
}

// SetUserHistory implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetUserHistory(uh *kbfsedits.UserHistory) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.userHistory = uh
}

// MetadataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MetadataVersion() kbfsmd.MetadataVer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.metadataVersion
}

// SetMetadataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMetadataVersion(mdVer kbfsmd.MetadataVer) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.metadataVersion = mdVer
}

// DataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DataVersion() DataVer {
	return IndirectDirsDataVer
}

// BlockCryptVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockCryptVersion() kbfscrypto.EncryptionVer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.blockCryptVersion
}

// SetBlockCryptVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockCryptVersion(ver kbfscrypto.EncryptionVer) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.blockCryptVersion = ver
}

// DefaultBlockType implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DefaultBlockType() keybase1.BlockType {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.defaultBlockType
}

// SetDefaultBlockType implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetDefaultBlockType(blockType keybase1.BlockType) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.defaultBlockType = blockType
}

// DoBackgroundFlushes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DoBackgroundFlushes() bool {
	if !c.Mode().BackgroundFlushesEnabled() {
		return false
	}

	c.lock.RLock()
	defer c.lock.RUnlock()
	return !c.noBGFlush
}

// SetDoBackgroundFlushes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetDoBackgroundFlushes(doBGFlush bool) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.noBGFlush = !doBGFlush
}

// RekeyWithPromptWaitTime implements the Config interface for
// ConfigLocal.
func (c *ConfigLocal) RekeyWithPromptWaitTime() time.Duration {
	c.lock.Lock()
	defer c.lock.Unlock()
	return c.rwpWaitTime
}

// SetRekeyWithPromptWaitTime implements the Config interface for
// ConfigLocal.
func (c *ConfigLocal) SetRekeyWithPromptWaitTime(d time.Duration) {
	c.lock.RLock()
	defer c.lock.RUnlock()
	c.rwpWaitTime = d
}

// Mode implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Mode() InitMode {
	return c.mode
}

// IsTestMode implements the Config interface for ConfigLocal.
func (c *ConfigLocal) IsTestMode() bool {
	return c.mode.IsTestMode()
}

// DelayedCancellationGracePeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DelayedCancellationGracePeriod() time.Duration {
	return c.delayedCancellationGracePeriod
}

// SetDelayedCancellationGracePeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetDelayedCancellationGracePeriod(d time.Duration) {
	c.delayedCancellationGracePeriod = d
}

// ReqsBufSize implements the Config interface for ConfigLocal.
func (c *ConfigLocal) ReqsBufSize() int {
	return 20
}

// MaxNameBytes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaxNameBytes() uint32 {
	return c.maxNameBytes
}

// StorageRoot implements the Config interface for ConfigLocal.
func (c *ConfigLocal) StorageRoot() string {
	return c.storageRoot
}

func (c *ConfigLocal) resetCachesWithoutShutdown() DirtyBlockCache {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.mdcache = NewMDCacheStandard(defaultMDCacheCapacity)
	c.kcache = NewKeyCacheStandard(defaultMDCacheCapacity)
	c.kbcache = kbfsmd.NewKeyBundleCacheLRU(keyBundlesCacheCapacityBytes)

	log := c.MakeLogger("")
	var capacity uint64
	if c.bcache == nil {
		capacity = getDefaultCleanBlockCacheCapacity()
		log.Debug("setting default clean block cache capacity to %d",
			capacity)
	} else {
		capacity = c.bcache.GetCleanBytesCapacity()
		log.Debug("setting clean block cache capacity based on existing value %d",
			capacity)
	}
	c.bcache = NewBlockCacheStandard(10000, capacity)

	if !c.Mode().DirtyBlockCacheEnabled() {
		return nil
	}

	oldDirtyBcache := c.dirtyBcache

	// TODO: we should probably fail or re-schedule this reset if
	// there is anything dirty in the dirty block cache.

	// The minimum number of bytes we'll try to sync in parallel.
	// This should be roughly the minimum amount of bytes we expect
	// our worst supported connection to send within the timeout
	// forced on us by the upper layer (19 seconds on OS X).  With the
	// current default of a single block, this minimum works out to
	// ~1MB, so we can support a connection speed as low as ~54 KB/s.
	minSyncBufferSize := int64(MaxBlockSizeBytesDefault)

	// The maximum number of bytes we can try to sync at once (also limits the
	// amount of memory used by dirty blocks). We use the same value from clean
	// block cache capacity here.
	maxSyncBufferSize := int64(capacity)

	// Start off conservatively to avoid getting immediate timeouts on
	// slow connections.
	startSyncBufferSize := minSyncBufferSize

	dbcLog := c.MakeLogger("DBC")
	c.dirtyBcache = NewDirtyBlockCacheStandard(c.clock, dbcLog,
		minSyncBufferSize, maxSyncBufferSize, startSyncBufferSize)
	return oldDirtyBcache
}

// ResetCaches implements the Config interface for ConfigLocal.
func (c *ConfigLocal) ResetCaches() {
	oldDirtyBcache := c.resetCachesWithoutShutdown()
	jServer, err := GetJournalServer(c)
	if err == nil {
		if err := c.journalizeBcaches(jServer); err != nil {
			if log := c.MakeLogger(""); log != nil {
				log.CWarningf(nil, "Error journalizing dirty block cache: %+v", err)
			}
		}
	}
	if oldDirtyBcache != nil {
		// Shutdown outside of the lock so it doesn't block other
		// access to this config.
		if err := oldDirtyBcache.Shutdown(); err != nil {
			if log := c.MakeLogger(""); log != nil {
				log.CWarningf(nil,
					"Error shutting down old dirty block cache: %+v", err)
			}
		}
	}
}

// MakeLogger implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MakeLogger(module string) logger.Logger {
	// No need to lock since c.loggerFn is initialized once at
	// construction. Also resetCachesWithoutShutdown would deadlock.
	return c.loggerFn(module)
}

// MetricsRegistry implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MetricsRegistry() metrics.Registry {
	return c.registry
}

// SetRekeyQueue implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetRekeyQueue(r RekeyQueue) {
	c.rekeyQueue = r
}

// RekeyQueue implements the Config interface for ConfigLocal.
func (c *ConfigLocal) RekeyQueue() RekeyQueue {
	return c.rekeyQueue
}

// SetMetricsRegistry implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMetricsRegistry(r metrics.Registry) {
	c.registry = r
}

// SetTraceOptions implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetTraceOptions(enabled bool) {
	c.traceLock.Lock()
	defer c.traceLock.Unlock()
	c.traceEnabled = enabled
}

// MaybeStartTrace implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaybeStartTrace(
	ctx context.Context, family, title string) context.Context {
	traceEnabled := func() bool {
		c.traceLock.RLock()
		defer c.traceLock.RUnlock()
		return c.traceEnabled
	}()
	if !traceEnabled {
		return ctx
	}

	tr := trace.New(family, title)
	tr.SetMaxEvents(25)
	ctx = trace.NewContext(ctx, tr)
	return ctx
}

// MaybeFinishTrace implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaybeFinishTrace(ctx context.Context, err error) {
	if tr, ok := trace.FromContext(ctx); ok {
		if err != nil {
			tr.LazyPrintf("err=%+v", err)
			tr.SetError()
		}
		tr.Finish()
	}
}

// SetTLFValidDuration implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetTLFValidDuration(r time.Duration) {
	c.tlfValidDuration = r
}

// TLFValidDuration implements the Config interface for ConfigLocal.
func (c *ConfigLocal) TLFValidDuration() time.Duration {
	return c.tlfValidDuration
}

// SetBGFlushDirOpBatchSize implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBGFlushDirOpBatchSize(s int) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.bgFlushDirOpBatchSize = s
}

// BGFlushDirOpBatchSize implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BGFlushDirOpBatchSize() int {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.bgFlushDirOpBatchSize
}

// SetBGFlushPeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBGFlushPeriod(p time.Duration) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.bgFlushPeriod = p
}

// BGFlushPeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BGFlushPeriod() time.Duration {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.bgFlushPeriod
}

// Shutdown implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Shutdown(ctx context.Context) error {
	c.RekeyQueue().Shutdown()
	if c.CheckStateOnShutdown() && c.allKnownConfigsForTesting != nil {
		// Before we do anything, wait for all archiving and
		// journaling to finish.
		for _, config := range *c.allKnownConfigsForTesting {
			kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
			if !ok {
				continue
			}
			if err := kbfsOps.shutdownEdits(ctx); err != nil {
				return err
			}
			for _, fbo := range kbfsOps.ops {
				if err := fbo.fbm.waitForArchives(ctx); err != nil {
					return err
				}
				if err := fbo.fbm.waitForDeletingBlocks(ctx); err != nil {
					return err
				}
				log := config.MakeLogger("")
				if err := WaitForTLFJournal(ctx, config, fbo.id(),
					log); err != nil {
					return err
				}
				// The above wait could have resulted in some MD
				// flushes, so now we have to wait on any archives as
				// well.  We only need one more check for this, since
				// archives don't produce MDs.
				if err := fbo.mdFlushes.Wait(ctx); err != nil {
					return err
				}
				if err := fbo.fbm.waitForArchives(ctx); err != nil {
					return err
				}
				if err := WaitForTLFJournal(ctx, config, fbo.id(),
					log); err != nil {
					return err
				}
			}
		}
	}

	var errorList []error
	err := c.KBFSOps().Shutdown(ctx)
	if err != nil {
		errorList = append(errorList, err)
		// Continue with shutdown regardless of err.
		err = nil
	}
	c.BlockOps().Shutdown()
	c.MDServer().Shutdown()
	c.KeyServer().Shutdown()
	c.KeybaseService().Shutdown()
	c.BlockServer().Shutdown(ctx)
	c.Crypto().Shutdown()
	c.Reporter().Shutdown()
	dirtyBcache := c.DirtyBlockCache()
	if dirtyBcache != nil {
		err = dirtyBcache.Shutdown()
	}
	if err != nil {
		errorList = append(errorList, err)
	}
	dbc := c.DiskBlockCache()
	if dbc != nil {
		dbc.Shutdown(ctx)
	}
	dmc := c.DiskMDCache()
	if dmc != nil {
		dmc.Shutdown(ctx)
	}
	dqc := c.DiskQuotaCache()
	if dqc != nil {
		dqc.Shutdown(ctx)
	}
	kbfsServ := c.kbfsService
	if kbfsServ != nil {
		kbfsServ.Shutdown()
	}

	if len(errorList) == 1 {
		return errorList[0]
	} else if len(errorList) > 1 {
		// Aggregate errors
		return errors.Errorf("Multiple errors on shutdown: %+v", errorList)
	}

	c.lock.Lock()
	defer c.lock.Unlock()
	for _, cancel := range c.tlfClearCancels {
		cancel()
	}

	return nil
}

// CheckStateOnShutdown implements the Config interface for ConfigLocal.
func (c *ConfigLocal) CheckStateOnShutdown() bool {
	if md, ok := c.MDServer().(mdServerLocal); ok {
		return !md.isShutdown()
	}
	return false
}

func (c *ConfigLocal) journalizeBcaches(jServer *JournalServer) error {
	syncCache, ok := c.DirtyBlockCache().(*DirtyBlockCacheStandard)
	if !ok {
		return errors.Errorf("Dirty bcache unexpectedly type %T", syncCache)
	}
	jServer.delegateDirtyBlockCache = syncCache

	// Make a dirty block cache specifically for the journal
	// server.  Since this doesn't rely directly on the network,
	// there's no need for an adaptive sync buffer size, so we
	// always set the min and max to the same thing.
	maxSyncBufferSize := int64(ForcedBranchSquashBytesThresholdDefault)
	log := c.MakeLogger("DBCJ")
	journalCache := NewDirtyBlockCacheStandard(c.clock, log,
		maxSyncBufferSize, maxSyncBufferSize, maxSyncBufferSize)
	c.SetDirtyBlockCache(jServer.dirtyBlockCache(journalCache))

	jServer.delegateBlockCache = c.BlockCache()
	c.SetBlockCache(jServer.blockCache())
	return nil
}

func (c *ConfigLocal) getQuotaUsage(
	chargedTo keybase1.UserOrTeamID) *EventuallyConsistentQuotaUsage {
	c.lock.RLock()
	quota, ok := c.quotaUsage[chargedTo]
	if ok {
		c.lock.RUnlock()
		return quota
	}
	c.lock.RUnlock()

	c.lock.Lock()
	defer c.lock.Unlock()
	quota, ok = c.quotaUsage[chargedTo]
	if !ok {
		if chargedTo.IsTeamOrSubteam() {
			quota = NewEventuallyConsistentTeamQuotaUsage(
				c, chargedTo.AsTeamOrBust(), "BDL")
		} else {
			quota = NewEventuallyConsistentQuotaUsage(c, "BDL")
		}
		c.quotaUsage[chargedTo] = quota
	}
	return quota
}

// EnableDiskLimiter fills in c.ciskLimiter for use in journaling and
// disk caching. It returns the EventuallyConsistentQuotaUsage object
// used by the disk limiter.
func (c *ConfigLocal) EnableDiskLimiter(configRoot string) error {
	if c.diskLimiter != nil {
		return errors.New("c.diskLimiter is already non-nil")
	}

	params := makeDefaultBackpressureDiskLimiterParams(
		configRoot, c.getQuotaUsage, c.diskBlockCacheFraction, c.syncBlockCacheFraction)
	log := c.MakeLogger("")
	log.Debug("Setting disk storage byte limit to %d and file limit to %d",
		params.byteLimit, params.fileLimit)
	os.MkdirAll(configRoot, 0700)

	diskLimiter, err := newBackpressureDiskLimiter(log, params)
	if err != nil {
		return err
	}
	c.diskLimiter = diskLimiter
	return nil
}

// EnableJournaling creates a JournalServer and attaches it to
// this config. journalRoot must be non-empty. Errors returned are
// non-fatal.
func (c *ConfigLocal) EnableJournaling(
	ctx context.Context, journalRoot string,
	bws TLFJournalBackgroundWorkStatus) error {
	jServer, err := GetJournalServer(c)
	if err == nil {
		// Journaling shouldn't be enabled twice for the same
		// config.
		return errors.New("Trying to enable journaling twice")
	}

	// TODO: Sanity-check the root directory, e.g. create
	// it if it doesn't exist, make sure that it doesn't
	// point to /keybase itself, etc.
	log := c.MakeLogger("")
	branchListener := c.KBFSOps().(branchChangeListener)
	flushListener := c.KBFSOps().(mdFlushListener)

	// Make sure the journal root exists.
	err = ioutil.MkdirAll(journalRoot, 0700)
	if err != nil {
		return err
	}

	jServer = makeJournalServer(c, log, journalRoot, c.BlockCache(),
		c.DirtyBlockCache(), c.BlockServer(), c.MDOps(), branchListener,
		flushListener)

	c.SetBlockServer(jServer.blockServer())
	c.SetMDOps(jServer.mdOps())

	bcacheErr := c.journalizeBcaches(jServer)
	enableErr := func() error {
		// If this fails, then existing journals will be
		// enabled when we receive the login notification.
		session, err := c.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return err
		}

		err = jServer.EnableExistingJournals(
			ctx, session.UID, session.VerifyingKey, bws)
		if err != nil {
			return err
		}

		wg := jServer.MakeFBOsForExistingJournals(ctx)
		wg.Wait()
		return nil
	}()
	switch {
	case bcacheErr != nil && enableErr != nil:
		return errors.Errorf(
			"Got errors %+v and %+v", bcacheErr, enableErr)
	case bcacheErr != nil:
		return bcacheErr
	case enableErr != nil:
		return enableErr
	}

	return nil
}

func (c *ConfigLocal) resetDiskBlockCacheLocked() error {
	dbc, err := newDiskBlockCacheWrapped(c, c.storageRoot)
	if err != nil {
		return err
	}
	c.diskBlockCache = dbc
	return nil
}

// MakeDiskBlockCacheIfNotExists implements the Config interface for
// ConfigLocal.
func (c *ConfigLocal) MakeDiskBlockCacheIfNotExists() error {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.diskBlockCache != nil {
		return nil
	}
	switch c.diskCacheMode {
	case DiskCacheModeOff:
		return nil
	case DiskCacheModeLocal:
		return c.resetDiskBlockCacheLocked()
	case DiskCacheModeRemote:
		dbc, err := NewDiskBlockCacheRemote(c.kbCtx, c)
		if err != nil {
			return err
		}
		c.diskBlockCache = dbc
		return nil
	}
	return nil
}

func (c *ConfigLocal) resetDiskMDCacheLocked() error {
	dmc, err := newDiskMDCacheLocal(c, c.storageRoot)
	if err != nil {
		return err
	}
	if c.diskMDCache != nil {
		c.diskMDCache.Shutdown(context.TODO())
	}
	c.diskMDCache = dmc
	return nil
}

// MakeDiskMDCacheIfNotExists implements the Config interface for
// ConfigLocal.
func (c *ConfigLocal) MakeDiskMDCacheIfNotExists() error {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.diskMDCache != nil {
		return nil
	}
	return c.resetDiskMDCacheLocked()
}

func (c *ConfigLocal) resetDiskQuotaCacheLocked() error {
	dqc, err := newDiskQuotaCacheLocal(c, c.storageRoot)
	if err != nil {
		return err
	}
	if c.diskQuotaCache != nil {
		c.diskQuotaCache.Shutdown(context.TODO())
	}
	c.diskQuotaCache = dqc
	return nil
}

// MakeDiskQuotaCacheIfNotExists implements the Config interface for
// ConfigLocal.
func (c *ConfigLocal) MakeDiskQuotaCacheIfNotExists() error {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.diskQuotaCache != nil {
		return nil
	}
	return c.resetDiskQuotaCacheLocked()
}

func (c *ConfigLocal) openConfigLevelDB(configName string) (*levelDb, error) {
	dbPath := filepath.Join(c.storageRoot, configName)
	stor, err := storage.OpenFile(dbPath, false)
	if err != nil {
		return nil, err
	}
	return openLevelDB(stor)
}

func (c *ConfigLocal) loadSyncedTlfsLocked() (err error) {
	syncedTlfs := make(map[tlf.ID]FolderSyncConfig)
	if c.IsTestMode() {
		c.syncedTlfs = syncedTlfs
		return nil
	}
	if c.storageRoot == "" {
		return errors.New("empty storageRoot specified for non-test run")
	}
	ldb, err := c.openConfigLevelDB(syncedTlfConfigFolderName)
	if err != nil {
		return err
	}
	defer ldb.Close()
	iter := ldb.NewIterator(nil, nil)
	defer iter.Release()

	log := c.MakeLogger("")
	// If there are any un-parseable IDs, delete them.
	deleteBatch := new(leveldb.Batch)
	for iter.Next() {
		key := string(iter.Key())
		tlfID, err := tlf.ParseID(key)
		if err != nil {
			log.Debug("deleting TLF %s from synced TLF list", key)
			deleteBatch.Delete(iter.Key())
			continue
		}
		var config FolderSyncConfig
		val := iter.Value()
		if val != nil {
			err = c.codec.Decode(val, &config)
			if err != nil {
				return err
			}
		} else {
			// For backwards-compatibility, consider a nil value to
			// mean "enabled".
			config.Mode = keybase1.FolderSyncMode_ENABLED
		}
		syncedTlfs[tlfID] = config
	}
	c.syncedTlfs = syncedTlfs
	return ldb.Write(deleteBatch, nil)
}

// GetTlfSyncState implements the isSyncedTlfGetter interface for
// ConfigLocal.
func (c *ConfigLocal) GetTlfSyncState(tlfID tlf.ID) FolderSyncConfig {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.syncedTlfs[tlfID]
}

// IsSyncedTlf implements the isSyncedTlfGetter interface for ConfigLocal.
func (c *ConfigLocal) IsSyncedTlf(tlfID tlf.ID) bool {
	return c.GetTlfSyncState(tlfID).Mode == keybase1.FolderSyncMode_ENABLED
}

// SetTlfSyncState implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetTlfSyncState(tlfID tlf.ID, config FolderSyncConfig) (
	<-chan error, error) {
	c.lock.Lock()
	defer c.lock.Unlock()
	diskCacheWrapped, ok := c.diskBlockCache.(*diskBlockCacheWrapped)
	if !ok {
		return nil, errors.Errorf(
			"invalid disk cache type to set TLF sync state: %T",
			c.diskBlockCache)
	}
	if !diskCacheWrapped.IsSyncCacheEnabled() {
		return nil, errors.New("sync block cache is not enabled")
	}

	if !c.IsTestMode() {
		if c.storageRoot == "" {
			return nil, errors.New(
				"empty storageRoot specified for non-test run")
		}
		ldb, err := c.openConfigLevelDB(syncedTlfConfigFolderName)
		if err != nil {
			return nil, err
		}
		defer ldb.Close()
		tlfBytes, err := tlfID.MarshalText()
		if err != nil {
			return nil, err
		}
		if config.Mode == keybase1.FolderSyncMode_DISABLED {
			err = ldb.Delete(tlfBytes, nil)
		} else {
			if cancel, ok := c.tlfClearCancels[tlfID]; ok {
				cancel()
			}
			buf, err := c.codec.Encode(&config)
			if err != nil {
				return nil, err
			}
			err = ldb.Put(tlfBytes, buf, nil)
		}
		if err != nil {
			return nil, err
		}
	}

	ch := make(chan error, 1)
	if config.Mode == keybase1.FolderSyncMode_DISABLED {
		// Start a background goroutine deleting all the blocks
		// from this TLF.
		ctx, cancel := context.WithCancel(context.Background())
		if oldCancel, ok := c.tlfClearCancels[tlfID]; ok {
			oldCancel()
		}
		c.tlfClearCancels[tlfID] = cancel
		diskBlockCache := c.diskBlockCache
		go func() {
			defer cancel()
			ch <- diskBlockCache.ClearAllTlfBlocks(ctx, tlfID)
		}()
	} else {
		ch <- nil
	}

	c.syncedTlfs[tlfID] = config
	<-c.bops.TogglePrefetcher(true)
	return ch, nil
}

// PrefetchStatus implements the Config interface for ConfigLocal.
func (c *ConfigLocal) PrefetchStatus(ctx context.Context, tlfID tlf.ID,
	ptr BlockPointer) PrefetchStatus {
	_, prefetchStatus, _, err := c.BlockCache().GetWithPrefetch(ptr)
	if err != nil {
		prefetchStatus = NoPrefetch
		dbc := c.DiskBlockCache()
		if dbc != nil {
			_, _, prefetchStatus, err = dbc.Get(ctx, tlfID, ptr.ID)
			if err != nil {
				prefetchStatus = NoPrefetch
			}
		}
	}
	return prefetchStatus
}

// GetRekeyFSMLimiter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) GetRekeyFSMLimiter() *OngoingWorkLimiter {
	return c.rekeyFSMLimiter
}

// SetKBFSService sets the KBFSService for this ConfigLocal.
func (c *ConfigLocal) SetKBFSService(k *KBFSService) {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.kbfsService != nil {
		c.kbfsService.Shutdown()
	}
	c.kbfsService = k
}

// RootNodeWrappers implements the Config interface for ConfigLocal.
func (c *ConfigLocal) RootNodeWrappers() []func(Node) Node {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.rootNodeWrappers[:]
}

// AddRootNodeWrapper implements the Config interface for ConfigLocal.
func (c *ConfigLocal) AddRootNodeWrapper(f func(Node) Node) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.rootNodeWrappers = append(c.rootNodeWrappers, f)
}
