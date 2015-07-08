package libkbfs

import keybase1 "github.com/keybase/client/protocol/go"

// ConfigLocal implements the Config interface using purely local
// server objects (no KBFS operations used RPCs).
type ConfigLocal struct {
	kbfs     KBFSOps
	kbpki    KBPKI
	keyman   KeyManager
	rep      Reporter
	mdcache  MDCache
	kcache   KeyCache
	bcache   BlockCache
	crypto   Crypto
	codec    Codec
	mdops    MDOps
	kops     KeyOps
	bops     BlockOps
	mdserv   MDServer
	bserv    BlockServer
	bsplit   BlockSplitter
	notifier Notifier
}

// LocalUser represents a fake KBFS user, useful for testing.
type LocalUser struct {
	Name                  string
	UID                   keybase1.UID
	Asserts               []string
	VerifyingKeys         []VerifyingKey
	CryptPublicKeys       []CryptPublicKey
	CurrentPublicKeyIndex int
}

// GetCurrentCryptPublicKey returns this LocalUser's public encryption key.
func (lu *LocalUser) GetCurrentCryptPublicKey() CryptPublicKey {
	return lu.CryptPublicKeys[lu.CurrentPublicKeyIndex]
}

func verifyingKeysToPublicKeys(keys []VerifyingKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.KID,
			IsSibkey: true,
		}
	}
	return publicKeys
}

func cryptPublicKeysToPublicKeys(keys []CryptPublicKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.KID,
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
func MakeLocalUserSigningKeyOrBust(name string) SigningKey {
	return MakeFakeSigningKeyOrBust(name + " signing key")
}

// MakeLocalUserVerifyingKeyOrBust makes a new verifying key
// corresponding to the signing key for this user.
func MakeLocalUserVerifyingKeyOrBust(name string) VerifyingKey {
	return MakeLocalUserSigningKeyOrBust(name).getVerifyingKey()
}

// MakeLocalUserCryptPrivateKeyOrBust returns a unique private
// encryption key for this user.
func MakeLocalUserCryptPrivateKeyOrBust(name string) CryptPrivateKey {
	return MakeFakeCryptPrivateKeyOrBust(name + " crypt key")
}

// MakeLocalUserCryptPublicKeyOrBust returns the public key
// corresponding to the crypt private key for this user.
func MakeLocalUserCryptPublicKeyOrBust(name string) CryptPublicKey {
	return MakeLocalUserCryptPrivateKeyOrBust(name).getPublicKey()
}

// MakeLocalUsers is a helper function to generate a list of
// LocalUsers suitable to use with KBPKILocal.
func MakeLocalUsers(users []string) []LocalUser {
	localUsers := make([]LocalUser, len(users))
	for i := 0; i < len(users); i++ {
		verifyingKey := MakeLocalUserVerifyingKeyOrBust(users[i])
		cryptPublicKey := MakeLocalUserCryptPublicKeyOrBust(users[i])
		localUsers[i] = LocalUser{
			Name:                  users[i],
			UID:                   keybase1.MakeTestUID(uint32(i + 1)),
			VerifyingKeys:         []VerifyingKey{verifyingKey},
			CryptPublicKeys:       []CryptPublicKey{cryptPublicKey},
			CurrentPublicKeyIndex: 0,
		}
	}
	return localUsers
}

// NewConfigLocal constructs a new ConfigLocal with default components.
func NewConfigLocal() *ConfigLocal {
	config := &ConfigLocal{}
	config.SetKBFSOps(NewKBFSOpsStandard(config))
	config.SetKeyManager(&KeyManagerStandard{config})
	config.SetReporter(&ReporterSimple{})
	config.SetMDCache(NewMDCacheStandard(5000))
	config.SetKeyCache(&KeyCacheNull{})
	config.SetBlockCache(NewBlockCacheStandard(5000))
	config.SetCodec(NewCodecMsgpack())
	config.SetMDOps(&MDOpsStandard{config})
	config.SetBlockOps(&BlockOpsStandard{config})
	// 64K blocks by default, block changes embedded max == 8K
	config.SetBlockSplitter(&BlockSplitterSimple{64 * 1024, 8 * 1024})
	config.SetNotifier(config.kbfs.(*KBFSOpsStandard))
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
	return c.kbpki
}

// SetKBPKI implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetKBPKI(k KBPKI) {
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

// MDCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) MDCache() MDCache {
	return c.mdcache
}

// SetMDCache implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetMDCache(m MDCache) {
	c.mdcache = m
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
	return c.crypto
}

// SetCrypto implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetCrypto(cr Crypto) {
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

// BlockOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) BlockOps() BlockOps {
	return c.bops
}

// SetBlockOps implements the Config interface for ConfigLocal.
func (c *ConfigLocal) SetBlockOps(b BlockOps) {
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

// DataVersion implements the Config interface for ConfigLocal.
func (c *ConfigLocal) DataVersion() DataVer {
	return 1
}

// ReqsBufSize implements the Config interface for ConfigLocal.
func (c *ConfigLocal) ReqsBufSize() int {
	return 20
}
