// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

const (
	// Max supported plaintext size of a file in KBFS.  TODO: increase
	// this once we support multiple levels of indirection.
	maxFileBytesDefault = 2 * 1024 * 1024 * 1024
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
	// How old must the most recent revision be before we run QR?
	qrMinHeadAgeDefault = 5 * time.Minute
	// tlfValidDurationDefault is the default for tlf validity before redoing identify.
	tlfValidDurationDefault = 6 * time.Hour
)

// ConfigLocal implements the Config interface using purely local
// server objects (no KBFS operations used RPCs).
type ConfigLocal struct {
	lock        sync.RWMutex
	kbfs        KBFSOps
	keyman      KeyManager
	rep         Reporter
	kcache      KeyCache
	kbcache     KeyBundleCache
	bcache      BlockCache
	dirtyBcache DirtyBlockCache
	codec       kbfscodec.Codec
	mdops       MDOps
	kops        KeyOps
	crypto      Crypto
	mdcache     MDCache
	bops        BlockOps
	mdserv      MDServer
	bserv       BlockServer
	keyserv     KeyServer
	service     KeybaseService
	bsplit      BlockSplitter
	notifier    Notifier
	clock       Clock
	kbpki       KBPKI
	renamer     ConflictRenamer
	registry    metrics.Registry
	loggerFn    func(prefix string) logger.Logger
	noBGFlush   bool // logic opposite so the default value is the common setting
	rwpWaitTime time.Duration

	maxFileBytes uint64
	maxNameBytes uint32
	maxDirBytes  uint64
	rekeyQueue   RekeyQueue

	qrPeriod                       time.Duration
	qrUnrefAge                     time.Duration
	qrMinHeadAge                   time.Duration
	delayedCancellationGracePeriod time.Duration

	// allKnownConfigsForTesting is used for testing, and contains all created
	// Config objects in this test.
	allKnownConfigsForTesting *[]Config

	// tlfValidDuration is the time TLFs are valid before redoing identification.
	tlfValidDuration time.Duration
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

// NewConfigLocal constructs a new ConfigLocal with default components.
func NewConfigLocal() *ConfigLocal {
	config := &ConfigLocal{}
	config.SetClock(wallClock{})
	config.SetReporter(NewReporterSimple(config.Clock(), 10))
	config.SetConflictRenamer(WriterDeviceDateConflictRenamer{config})
	config.ResetCaches()
	config.SetCodec(kbfscodec.NewMsgpack())
	config.SetBlockOps(&BlockOpsStandard{config})
	config.SetKeyOps(&KeyOpsStandard{config})
	config.SetRekeyQueue(NewRekeyQueueStandard(config))

	config.maxFileBytes = maxFileBytesDefault
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

// Crypto implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Crypto() Crypto {
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
	return defaultClientMetadataVer
}

// DataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DataVersion() DataVer {
	return FilesWithHolesDataVer
}

// DoBackgroundFlushes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DoBackgroundFlushes() bool {
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
	return c.rwpWaitTime
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

// MaxFileBytes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaxFileBytes() uint64 {
	return c.maxFileBytes
}

// MaxNameBytes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaxNameBytes() uint32 {
	return c.maxNameBytes
}

// MaxDirBytes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MaxDirBytes() uint64 {
	return c.maxDirBytes
}

func (c *ConfigLocal) resetCachesWithoutShutdown() DirtyBlockCache {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.mdcache = NewMDCacheStandard(defaultMDCacheCapacity)
	c.kcache = NewKeyCacheStandard(defaultMDCacheCapacity)
	c.kbcache = NewKeyBundleCacheStandard(defaultMDCacheCapacity * 2)
	// Limit the block cache to 10K entries or 1024 blocks (currently 512MiB)
	c.bcache = NewBlockCacheStandard(10000, MaxBlockSizeBytesDefault*1024)
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

	// The maximum number of bytes we can try to sync at once (also
	// limits the amount of memory used by dirty blocks).  We make it
	// slightly bigger than the max number of parallel bytes in order
	// to reserve reuse put "slots" while waiting for earlier puts to
	// finish.  This also limits the maxinim amount of memory used by
	// the dirty block cache (to around 100MB with the current
	// defaults).
	maxSyncBufferSize :=
		int64(MaxBlockSizeBytesDefault * maxParallelBlockPuts * 2)

	// Start off conservatively to avoid getting immediate timeouts on
	// slow connections.
	startSyncBufferSize := minSyncBufferSize

	c.dirtyBcache = NewDirtyBlockCacheStandard(c.clock, c.MakeLogger,
		minSyncBufferSize, maxSyncBufferSize, startSyncBufferSize)
	return oldDirtyBcache
}

// ResetCaches implements the Config interface for ConfigLocal.
func (c *ConfigLocal) ResetCaches() {
	oldDirtyBcache := c.resetCachesWithoutShutdown()
	if err := c.journalizeBcaches(); err != nil {
		if log := c.MakeLogger(""); log != nil {
			log.CWarningf(nil, "Error journalizing dirty block cache: %v", err)
		}
	}
	if oldDirtyBcache != nil {
		// Shutdown outside of the lock so it doesn't block other
		// access to this config.
		if err := oldDirtyBcache.Shutdown(); err != nil {
			if log := c.MakeLogger(""); log != nil {
				log.CWarningf(nil,
					"Error shutting down old dirty block cache: %v", err)
			}
		}
	}
}

// MakeLogger implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MakeLogger(module string) logger.Logger {
	c.lock.RLock()
	defer c.lock.RUnlock()
	if c.loggerFn == nil {
		return nil
	}
	return c.loggerFn(module)
}

// SetLoggerMaker implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetLoggerMaker(
	loggerFn func(module string) logger.Logger) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.loggerFn = loggerFn
}

// newConfigLocalWithCryptoForSigning initializes a local crypto
// config w/a crypto interface, using the given signing key, that can
// be used for non-PKI crypto.
func newConfigLocalWithCryptoForSigning(
	signingKey kbfscrypto.SigningKey) *ConfigLocal {
	config := NewConfigLocal()
	config.SetLoggerMaker(func(m string) logger.Logger {
		return logger.NewNull()
	})
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust("nobody")
	crypto := NewCryptoLocal(config.Codec(), signingKey, cryptPrivateKey)
	config.SetCrypto(crypto)
	return config
}

// NewConfigLocalWithCrypto initializes a local crypto config w/a
// crypto interface that can be used for non-PKI crypto.
func NewConfigLocalWithCrypto() *ConfigLocal {
	signingKey := MakeLocalUserSigningKeyOrBust("nobody")
	return newConfigLocalWithCryptoForSigning(signingKey)
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

// SetTLFValidDuration implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetTLFValidDuration(r time.Duration) {
	c.tlfValidDuration = r
}

// TLFValidDuration implements the Config interface for ConfigLocal.
func (c *ConfigLocal) TLFValidDuration() time.Duration {
	return c.tlfValidDuration
}

// Shutdown implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Shutdown() error {
	c.RekeyQueue().Clear()
	c.RekeyQueue().Wait(context.Background())
	if c.CheckStateOnShutdown() {
		// Before we do anything, wait for all archiving and
		// journaling to finish.
		for _, config := range *c.allKnownConfigsForTesting {
			kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
			if !ok {
				continue
			}
			for _, fbo := range kbfsOps.ops {
				ctx := context.Background()
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

	var errors []error
	err := c.KBFSOps().Shutdown()
	if err != nil {
		errors = append(errors, err)
		// Continue with shutdown regardless of err.
	}
	c.MDServer().Shutdown()
	c.KeyServer().Shutdown()
	c.KeybaseService().Shutdown()
	c.BlockServer().Shutdown()
	c.Crypto().Shutdown()
	c.Reporter().Shutdown()
	err = c.DirtyBlockCache().Shutdown()
	if err != nil {
		errors = append(errors, err)
	}

	if len(errors) == 1 {
		return errors[0]
	} else if len(errors) > 1 {
		// Aggregate errors
		return fmt.Errorf("Multiple errors on shutdown: %v", errors)
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

func (c *ConfigLocal) journalizeBcaches() error {
	jServer, err := GetJournalServer(c)
	if err != nil {
		// Journaling is disabled.
		return nil
	}

	syncCache, ok := c.DirtyBlockCache().(*DirtyBlockCacheStandard)
	if !ok {
		return fmt.Errorf("Dirty bcache unexpectedly type %T", syncCache)
	}
	syncCache.name = "sync"
	jServer.delegateDirtyBlockCache = syncCache

	// Make a dirty block cache specifically for the journal
	// server.  Since this doesn't rely directly on the network,
	// there's no need for an adaptive sync buffer size, so we
	// always set the min and max to the same thing.
	maxSyncBufferSize :=
		int64(MaxBlockSizeBytesDefault * maxParallelBlockPuts * 2)
	journalCache := NewDirtyBlockCacheStandard(c.clock, c.MakeLogger,
		maxSyncBufferSize, maxSyncBufferSize, maxSyncBufferSize)
	journalCache.name = "journal"
	c.SetDirtyBlockCache(jServer.dirtyBlockCache(journalCache))

	jServer.delegateBlockCache = c.BlockCache()
	c.SetBlockCache(jServer.blockCache())
	return nil
}

// EnableJournaling creates a JournalServer, but journaling must still
// be enabled manually for individual folders.
func (c *ConfigLocal) EnableJournaling(journalRoot string) {
	jServer, err := GetJournalServer(c)
	if err == nil {
		// Journaling shouldn't be enabled twice for the same
		// config.
		panic(errors.New("Trying to enable journaling twice"))
	}

	// TODO: Sanity-check the root directory, e.g. create
	// it if it doesn't exist, make sure that it doesn't
	// point to /keybase itself, etc.
	log := c.MakeLogger("")
	branchListener := c.KBFSOps().(branchChangeListener)
	flushListener := c.KBFSOps().(mdFlushListener)
	jServer = makeJournalServer(c, log, journalRoot, c.BlockCache(),
		c.DirtyBlockCache(), c.BlockServer(), c.MDOps(), branchListener,
		flushListener)
	ctx := context.Background()
	uid, key, err := getCurrentUIDAndVerifyingKey(ctx, c.KBPKI())
	if err != nil {
		log.Warning("Failed to get current UID and key; not enabling existing journals: %v", err)
		return
	}
	err = jServer.EnableExistingJournals(ctx, uid, key, TLFJournalBackgroundWorkEnabled)
	if err != nil {
		log.Warning("Failed to enable existing journals: %v", err)
	}
	c.SetBlockServer(jServer.blockServer())
	c.SetMDOps(jServer.mdOps())
	if err := c.journalizeBcaches(); err != nil {
		panic(err)
	}
}
