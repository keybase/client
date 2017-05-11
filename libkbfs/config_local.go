// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/pkg/errors"
	metrics "github.com/rcrowley/go-metrics"
	"github.com/shirou/gopsutil/mem"
	"golang.org/x/net/context"
	"golang.org/x/net/trace"
)

const (
	// Max supported size of a directory entry name.
	maxNameBytesDefault = 255
	// Maximum supported plaintext size of a directory in KBFS. TODO:
	// increase this once we support levels of indirection for
	// directories.
	maxDirBytesDefault = MaxBlockSizeBytesDefault
	// Default time after setting the rekey bit before prompting for a
	// paper key.
	rekeyWithPromptWaitTimeDefault = 10 * time.Minute
	// see Config doc for the purpose of DelayedCancellationGracePeriod
	delayedCancellationGracePeriodDefault = 2 * time.Second
	// How often do we check for stuff to reclaim?
	qrPeriodDefault = 1 * time.Minute
	// How long must something be unreferenced before we reclaim it?
	qrUnrefAgeDefault = 1 * time.Minute
	// How old must the most recent TLF revision be before another
	// device can run QR on that TLF?  This is large, to avoid
	// unnecessary conflicts on the TLF between devices.
	qrMinHeadAgeDefault = 24 * time.Hour
	// tlfValidDurationDefault is the default for tlf validity before redoing identify.
	tlfValidDurationDefault = 6 * time.Hour
	// bgFlushDirOpThresholdDefault is the default for how many
	// directory operations should be batched together in a single
	// background flush.
	bgFlushDirOpBatchSizeDefault = 100
	// bgFlushPeriodDefault is the default for how long to wait for a
	// batch to fill up before syncing a set of changes to the servers.
	bgFlushPeriodDefault = 1 * time.Second
)

// ConfigLocal implements the Config interface using purely local
// server objects (no KBFS operations used RPCs).
type ConfigLocal struct {
	lock           sync.RWMutex
	kbfs           KBFSOps
	keyman         KeyManager
	rep            Reporter
	kcache         KeyCache
	kbcache        KeyBundleCache
	bcache         BlockCache
	dirtyBcache    DirtyBlockCache
	diskBlockCache DiskBlockCache
	codec          kbfscodec.Codec
	mdops          MDOps
	kops           KeyOps
	crypto         Crypto
	mdcache        MDCache
	bops           BlockOps
	mdserv         MDServer
	bserv          BlockServer
	keyserv        KeyServer
	service        KeybaseService
	bsplit         BlockSplitter
	notifier       Notifier
	clock          Clock
	kbpki          KBPKI
	renamer        ConflictRenamer
	registry       metrics.Registry
	loggerFn       func(prefix string) logger.Logger
	noBGFlush      bool // logic opposite so the default value is the common setting
	rwpWaitTime    time.Duration
	diskLimiter    DiskLimiter

	maxNameBytes uint32
	maxDirBytes  uint64
	rekeyQueue   RekeyQueue
	storageRoot  string

	traceLock    sync.RWMutex
	traceEnabled bool

	qrPeriod                       time.Duration
	qrUnrefAge                     time.Duration
	qrMinHeadAge                   time.Duration
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
	metadataVersion MetadataVer

	mode InitMode
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

// Helper functions to get a various keys for a local user suitable
// for use with CryptoLocal. Each function will return the same key
// will always be returned for a given user.

// MakeLocalUserSigningKeyOrBust returns a unique signing key for this user.
func MakeLocalUserSigningKeyOrBust(
	name libkb.NormalizedUsername) kbfscrypto.SigningKey {
	return kbfscrypto.MakeFakeSigningKeyOrBust(
		string(name) + " signing key")
}

// MakeLocalUserVerifyingKeyOrBust makes a new verifying key
// corresponding to the signing key for this user.
func MakeLocalUserVerifyingKeyOrBust(
	name libkb.NormalizedUsername) kbfscrypto.VerifyingKey {
	return MakeLocalUserSigningKeyOrBust(name).GetVerifyingKey()
}

// MakeLocalUserCryptPrivateKeyOrBust returns a unique private
// encryption key for this user.
func MakeLocalUserCryptPrivateKeyOrBust(
	name libkb.NormalizedUsername) kbfscrypto.CryptPrivateKey {
	return kbfscrypto.MakeFakeCryptPrivateKeyOrBust(
		string(name) + " crypt key")
}

// MakeLocalUserCryptPublicKeyOrBust returns the public key
// corresponding to the crypt private key for this user.
func MakeLocalUserCryptPublicKeyOrBust(
	name libkb.NormalizedUsername) kbfscrypto.CryptPublicKey {
	return MakeLocalUserCryptPrivateKeyOrBust(name).GetPublicKey()
}

// MakeLocalUsers is a helper function to generate a list of
// LocalUsers suitable to use with KBPKILocal.
func MakeLocalUsers(users []libkb.NormalizedUsername) []LocalUser {
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
func NewConfigLocal(mode InitMode, loggerFn func(module string) logger.Logger,
	storageRoot string) *ConfigLocal {
	config := &ConfigLocal{
		loggerFn:    loggerFn,
		storageRoot: storageRoot,
		mode:        mode,
	}
	config.SetClock(wallClock{})
	config.SetReporter(NewReporterSimple(config.Clock(), 10))
	config.SetConflictRenamer(WriterDeviceDateConflictRenamer{config})
	config.ResetCaches()
	config.SetCodec(kbfscodec.NewMsgpack())
	config.SetKeyOps(&KeyOpsStandard{config})
	config.SetRekeyQueue(NewRekeyQueueStandard(config))

	config.maxNameBytes = maxNameBytesDefault
	config.maxDirBytes = maxDirBytesDefault
	config.rwpWaitTime = rekeyWithPromptWaitTimeDefault

	config.delayedCancellationGracePeriod = delayedCancellationGracePeriodDefault
	config.qrPeriod = qrPeriodDefault
	config.qrUnrefAge = qrUnrefAgeDefault
	config.qrMinHeadAge = qrMinHeadAgeDefault

	// Don't bother creating the registry if UseNilMetrics is set.
	if !metrics.UseNilMetrics {
		registry := metrics.NewRegistry()
		config.SetMetricsRegistry(registry)
	}

	config.tlfValidDuration = tlfValidDurationDefault
	config.bgFlushDirOpBatchSize = bgFlushDirOpBatchSizeDefault
	config.bgFlushPeriod = bgFlushPeriodDefault
	config.metadataVersion = defaultClientMetadataVer

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

// currentSessionGetter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) currentSessionGetter() currentSessionGetter {
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
func (c *ConfigLocal) KeyBundleCache() KeyBundleCache {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.kbcache
}

// SetKeyBundleCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyBundleCache(k KeyBundleCache) {
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

// MetadataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MetadataVersion() MetadataVer {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.metadataVersion
}

// SetMetadataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMetadataVersion(mdVer MetadataVer) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.metadataVersion = mdVer
}

// DataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DataVersion() DataVer {
	return AtLeastTwoLevelsOfChildrenDataVer
}

// DoBackgroundFlushes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DoBackgroundFlushes() bool {
	if c.mode == InitMinimal {
		// Don't do background flushes when in minimal mode, since
		// there shouldn't be any data writes.
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

// DelayedCancellationGracePeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DelayedCancellationGracePeriod() time.Duration {
	return c.delayedCancellationGracePeriod
}

// SetDelayedCancellationGracePeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetDelayedCancellationGracePeriod(d time.Duration) {
	c.delayedCancellationGracePeriod = d
}

// QuotaReclamationPeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) QuotaReclamationPeriod() time.Duration {
	return c.qrPeriod
}

// QuotaReclamationMinUnrefAge implements the Config interface for ConfigLocal.
func (c *ConfigLocal) QuotaReclamationMinUnrefAge() time.Duration {
	return c.qrUnrefAge
}

// QuotaReclamationMinHeadAge implements the Config interface for ConfigLocal.
func (c *ConfigLocal) QuotaReclamationMinHeadAge() time.Duration {
	return c.qrMinHeadAge
}

// ReqsBufSize implements the Config interface for ConfigLocal.
func (c *ConfigLocal) ReqsBufSize() int {
	return 20
}

// MaxNameBytes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaxNameBytes() uint32 {
	return c.maxNameBytes
}

// MaxDirBytes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaxDirBytes() uint64 {
	return c.maxDirBytes
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
	c.kbcache = NewKeyBundleCacheStandard(defaultMDCacheCapacity * 2)

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

	if c.mode == InitMinimal {
		// No blocks will be dirtied in minimal mode, so don't bother
		// with the dirty block cache.
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
	if c.CheckStateOnShutdown() {
		// Before we do anything, wait for all archiving and
		// journaling to finish.
		for _, config := range *c.allKnownConfigsForTesting {
			kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
			if !ok {
				continue
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

	if len(errorList) == 1 {
		return errorList[0]
	} else if len(errorList) > 1 {
		// Aggregate errors
		return errors.Errorf("Multiple errors on shutdown: %+v", errorList)
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

// EnableDiskLimiter fills in c.ciskLimiter for use in journaling and
// disk caching. It returns the EventuallyConsistentQuotaUsage object
// used by the disk limiter.
func (c *ConfigLocal) EnableDiskLimiter(configRoot string) (
	*EventuallyConsistentQuotaUsage, error) {
	if c.diskLimiter != nil {
		return nil, errors.New("c.diskLimiter is already non-nil")
	}

	// TODO: Ideally, we'd have a shared instance in the Config.
	quotaUsage := NewEventuallyConsistentQuotaUsage(c, "BDL")
	params := makeDefaultBackpressureDiskLimiterParams(
		configRoot, quotaUsage)
	log := c.MakeLogger("")
	log.Debug("Setting disk storage byte limit to %d and file limit to %d",
		params.byteLimit, params.fileLimit)
	os.MkdirAll(configRoot, 0700)

	diskLimiter, err := newBackpressureDiskLimiter(log, params)
	if err != nil {
		return nil, err
	}
	c.diskLimiter = diskLimiter
	return quotaUsage, err
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

// SetDiskBlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetDiskBlockCache(dbc DiskBlockCache) {
	c.lock.Lock()
	defer c.lock.Unlock()
	ctx := context.TODO()
	if c.diskBlockCache != nil {
		c.diskBlockCache.Shutdown(ctx)
	}
	c.diskBlockCache = dbc
}
