package libkbfs

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
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
	maxDirBytesDefault = 512 * 1024
	// Default time after setting the rekey bit before prompting for a
	// paper key.
	rekeyWithPromptWaitTimeDefault = 10 * time.Minute
	// How often do we check for stuff to reclaim?
	qrPeriodDefault = 1 * time.Minute
	// How long must something be unreferenced before we reclaim it?
	qrUnrefAgeDefault = 1 * time.Minute
	// tlfValidDurationDefault is the default for tlf validity before redoing identify.
	tlfValidDurationDefault = 6 * time.Hour
)

// ConfigLocal implements the Config interface using purely local
// server objects (no KBFS operations used RPCs).
type ConfigLocal struct {
	kbfs   KBFSOps
	keyman KeyManager
	rep    Reporter
	kcache KeyCache
	bcache BlockCache
	codec  Codec
	mdops  MDOps
	kops   KeyOps

	// TODO: We probably want to do the same thing for everything
	// else.
	cryptoLock sync.RWMutex
	crypto     Crypto

	mdcacheLock sync.RWMutex
	mdcache     MDCache

	bopsLock sync.RWMutex
	bops     BlockOps

	mdserv  MDServer
	bserv   BlockServer
	keyserv KeyServer

	daemonLock sync.RWMutex
	daemon     KeybaseDaemon

	bsplit   BlockSplitter
	notifier Notifier

	clockLock sync.RWMutex
	clock     Clock

	kbpkiLock sync.RWMutex
	kbpki     KBPKI

	renamer     ConflictRenamer
	registry    metrics.Registry
	loggerFn    func(prefix string) logger.Logger
	noBGFlush   bool // logic opposite so the default value is the common setting
	rwpWaitTime time.Duration

	sharingBeforeSignupEnabledLock sync.Mutex
	sharingBeforeSignupEnabled     bool

	maxFileBytes uint64
	maxNameBytes uint32
	maxDirBytes  uint64
	rekeyQueue   RekeyQueue

	qrPeriod   time.Duration
	qrUnrefAge time.Duration

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
}

// GetCurrentCryptPublicKey returns this LocalUser's public encryption key.
func (lu *LocalUser) GetCurrentCryptPublicKey() CryptPublicKey {
	return lu.CryptPublicKeys[lu.CurrentCryptPublicKeyIndex]
}

// GetCurrentVerifyingKey returns this LocalUser's public signing key.
func (lu *LocalUser) GetCurrentVerifyingKey() VerifyingKey {
	return lu.VerifyingKeys[lu.CurrentVerifyingKeyIndex]
}

func verifyingKeysToPublicKeys(keys []VerifyingKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.kid,
			IsSibkey: true,
		}
	}
	return publicKeys
}

func cryptPublicKeysToPublicKeys(keys []CryptPublicKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.kid,
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
func MakeLocalUserSigningKeyOrBust(name libkb.NormalizedUsername) SigningKey {
	return MakeFakeSigningKeyOrBust(string(name) + " signing key")
}

// MakeLocalUserVerifyingKeyOrBust makes a new verifying key
// corresponding to the signing key for this user.
func MakeLocalUserVerifyingKeyOrBust(name libkb.NormalizedUsername) VerifyingKey {
	return MakeLocalUserSigningKeyOrBust(name).GetVerifyingKey()
}

// MakeLocalUserCryptPrivateKeyOrBust returns a unique private
// encryption key for this user.
func MakeLocalUserCryptPrivateKeyOrBust(name libkb.NormalizedUsername) CryptPrivateKey {
	return MakeFakeCryptPrivateKeyOrBust(string(name) + " crypt key")
}

// MakeLocalUserCryptPublicKeyOrBust returns the public key
// corresponding to the crypt private key for this user.
func MakeLocalUserCryptPublicKeyOrBust(name libkb.NormalizedUsername) CryptPublicKey {
	return MakeLocalUserCryptPrivateKeyOrBust(name).getPublicKey()
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
				VerifyingKeys:   []VerifyingKey{verifyingKey},
				CryptPublicKeys: []CryptPublicKey{cryptPublicKey},
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
	config.SetMDCache(NewMDCacheStandard(5000))
	config.SetKeyCache(NewKeyCacheStandard(5000))
	// Limit the block cache to 10K entries or 512 MB of bytes
	config.SetBlockCache(NewBlockCacheStandard(config, 10000, 512*1024*1024))
	config.SetCodec(NewCodecMsgpack())
	config.SetBlockOps(&BlockOpsStandard{config})
	config.SetKeyOps(&KeyOpsStandard{config})
	config.SetRekeyQueue(NewRekeyQueueStandard(config))

	config.maxFileBytes = maxFileBytesDefault
	config.maxNameBytes = maxNameBytesDefault
	config.maxDirBytes = maxDirBytesDefault
	config.rwpWaitTime = rekeyWithPromptWaitTimeDefault

	config.qrPeriod = qrPeriodDefault
	config.qrUnrefAge = qrUnrefAgeDefault

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
	return c.kbfs
}

// SetKBFSOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKBFSOps(k KBFSOps) {
	c.kbfs = k
}

// KBPKI implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KBPKI() KBPKI {
	c.kbpkiLock.RLock()
	defer c.kbpkiLock.RUnlock()
	return c.kbpki
}

// SetKBPKI implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKBPKI(k KBPKI) {
	c.kbpkiLock.Lock()
	defer c.kbpkiLock.Unlock()
	c.kbpki = k
}

// KeyManager implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyManager() KeyManager {
	return c.keyman
}

// SetKeyManager implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyManager(k KeyManager) {
	c.keyman = k
}

// Reporter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Reporter() Reporter {
	return c.rep
}

// SetReporter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetReporter(r Reporter) {
	c.rep = r
}

// KeyCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyCache() KeyCache {
	return c.kcache
}

// SetKeyCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyCache(k KeyCache) {
	c.kcache = k
}

// BlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockCache() BlockCache {
	return c.bcache
}

// SetBlockCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockCache(b BlockCache) {
	c.bcache = b
}

// Crypto implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Crypto() Crypto {
	c.cryptoLock.RLock()
	defer c.cryptoLock.RUnlock()
	return c.crypto
}

// SetCrypto implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetCrypto(cr Crypto) {
	c.cryptoLock.Lock()
	defer c.cryptoLock.Unlock()
	c.crypto = cr
}

// Codec implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Codec() Codec {
	return c.codec
}

// SetCodec implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetCodec(co Codec) {
	c.codec = co
	RegisterOps(c.codec)
}

// MDOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MDOps() MDOps {
	return c.mdops
}

// SetMDOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMDOps(m MDOps) {
	c.mdops = m
}

// KeyOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyOps() KeyOps {
	return c.kops
}

// SetKeyOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyOps(k KeyOps) {
	c.kops = k
}

// MDCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MDCache() MDCache {
	c.mdcacheLock.RLock()
	defer c.mdcacheLock.RUnlock()
	return c.mdcache
}

// SetMDCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMDCache(m MDCache) {
	c.mdcacheLock.Lock()
	defer c.mdcacheLock.Unlock()
	c.mdcache = m
}

// BlockOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockOps() BlockOps {
	c.bopsLock.RLock()
	defer c.bopsLock.RUnlock()
	return c.bops
}

// SetBlockOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockOps(b BlockOps) {
	c.bopsLock.Lock()
	defer c.bopsLock.Unlock()
	c.bops = b
}

// MDServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MDServer() MDServer {
	return c.mdserv
}

// SetMDServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMDServer(m MDServer) {
	c.mdserv = m
}

// BlockServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockServer() BlockServer {
	return c.bserv
}

// SetBlockServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockServer(b BlockServer) {
	c.bserv = b
}

// KeyServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeyServer() KeyServer {
	return c.keyserv
}

// SetKeyServer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeyServer(k KeyServer) {
	c.keyserv = k
}

// KeybaseDaemon implements the Config interface for ConfigLocal.
func (c *ConfigLocal) KeybaseDaemon() KeybaseDaemon {
	c.daemonLock.RLock()
	defer c.daemonLock.RUnlock()
	return c.daemon
}

// SetKeybaseDaemon implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKeybaseDaemon(k KeybaseDaemon) {
	c.daemonLock.Lock()
	defer c.daemonLock.Unlock()
	c.daemon = k
}

// BlockSplitter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockSplitter() BlockSplitter {
	return c.bsplit
}

// SetBlockSplitter implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockSplitter(b BlockSplitter) {
	c.bsplit = b
}

// Notifier implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Notifier() Notifier {
	return c.notifier
}

// SetNotifier implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetNotifier(n Notifier) {
	c.notifier = n
}

// Clock implements the Config interface for ConfigLocal.
func (c *ConfigLocal) Clock() Clock {
	c.clockLock.RLock()
	defer c.clockLock.RUnlock()
	return c.clock
}

// SetClock implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetClock(cl Clock) {
	c.clockLock.Lock()
	defer c.clockLock.Unlock()
	c.clock = cl
}

// ConflictRenamer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) ConflictRenamer() ConflictRenamer {
	return c.renamer
}

// SetConflictRenamer implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetConflictRenamer(cr ConflictRenamer) {
	c.renamer = cr
}

// MetadataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MetadataVersion() MetadataVer {
	return InitialExtraMetadataVer
}

// DataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DataVersion() DataVer {
	return 1
}

// DoBackgroundFlushes implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DoBackgroundFlushes() bool {
	return !c.noBGFlush
}

// RekeyWithPromptWaitTime implements the Config interface for
// ConfigLocal.
func (c *ConfigLocal) RekeyWithPromptWaitTime() time.Duration {
	return c.rwpWaitTime
}

// SharingBeforeSignupEnabled returns whether or not this client will
// handle sharing before signup.
func (c *ConfigLocal) SharingBeforeSignupEnabled() bool {
	c.sharingBeforeSignupEnabledLock.Lock()
	defer c.sharingBeforeSignupEnabledLock.Unlock()
	return c.sharingBeforeSignupEnabled
}

// SetSharingBeforeSignupEnabled sets whether or not this client will
// handle sharing before signup.
func (c *ConfigLocal) SetSharingBeforeSignupEnabled(sharingBeforeSignupEnabled bool) {
	c.sharingBeforeSignupEnabledLock.Lock()
	defer c.sharingBeforeSignupEnabledLock.Unlock()
	c.sharingBeforeSignupEnabled = sharingBeforeSignupEnabled
}

// QuotaReclamationPeriod implements the Config interface for ConfigLocal.
func (c *ConfigLocal) QuotaReclamationPeriod() time.Duration {
	return c.qrPeriod
}

// QuotaReclamationMinUnrefAge implements the Config interface for ConfigLocal.
func (c *ConfigLocal) QuotaReclamationMinUnrefAge() time.Duration {
	return c.qrUnrefAge
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

// MakeLogger implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MakeLogger(module string) logger.Logger {
	return c.loggerFn(module)
}

// SetLoggerMaker implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetLoggerMaker(
	loggerFn func(module string) logger.Logger) {
	c.loggerFn = loggerFn
}

// NewConfigLocalWithCryptoForSigning initializes a local crypto
// config w/a crypto interface, using the given signing key, that can
// be used for non-PKI crypto.
func NewConfigLocalWithCryptoForSigning(signingKey SigningKey) *ConfigLocal {
	config := NewConfigLocal()
	config.SetLoggerMaker(func(m string) logger.Logger {
		return logger.NewNull()
	})
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust("nobody")
	crypto := NewCryptoLocal(config, signingKey, cryptPrivateKey)
	config.SetCrypto(crypto)
	return config
}

// NewConfigLocalWithCrypto initializes a local crypto config w/a crypto interface that can be used for non-PKI crypto.
func NewConfigLocalWithCrypto() *ConfigLocal {
	signingKey := MakeLocalUserSigningKeyOrBust("nobody")
	return NewConfigLocalWithCryptoForSigning(signingKey)
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
		// Before we do anything, wait for all archiving to finish.
		for _, config := range *c.allKnownConfigsForTesting {
			kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
			if !ok {
				continue
			}
			for _, fbo := range kbfsOps.ops {
				err := fbo.fbm.waitForArchives(context.Background())
				if err != nil {
					return err
				}
			}
		}
	}

	err := c.KBFSOps().Shutdown()
	// Continue with shutdown regardless of err.
	c.MDServer().Shutdown()
	c.KeyServer().Shutdown()
	c.KeybaseDaemon().Shutdown()
	c.BlockServer().Shutdown()
	c.Crypto().Shutdown()
	c.Reporter().Shutdown()
	return err
}

// CheckStateOnShutdown implements the Config interface for ConfigLocal.
func (c *ConfigLocal) CheckStateOnShutdown() bool {
	if md, ok := c.MDServer().(*MDServerLocal); ok {
		return !md.isShutdown()
	}
	return false
}
