package libkbfs

import (
	"github.com/keybase/client/go/libkb"
)

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
	kserv    KeyServer
	bserv    BlockServer
	bsplit   BlockSplitter
	notifier Notifier
}

type LocalUser struct {
	Name         string
	Uid          libkb.UID
	Asserts      []string
	Sibkeys      []Key
	Subkeys      []Key
	DeviceSubkey Key
}

// Helper function to generate a signing key for a local user suitable
// to use with CryptoLocal.
func GetLocalUserSigningKey(name string) Key {
	return NewFakeSigningKeyOrBust(name + " sibkey")
}

func GetLocalUserSibkey(name string) Key {
	// Seed must match the one used in GetLocalUserSigningKey().
	return NewFakeVerifyingKeyOrBust(name + " sibkey")
}

func GetLocalUserSubkey(name string) Key {
	return NewFakeBoxPublicKeyOrBust(name + " subkey")
}

// Helper function to generate a list of LocalUsers suitable to use
// with KBPKILocal.
func MakeLocalUsers(users []string) []LocalUser {
	localUsers := make([]LocalUser, len(users))
	for i := 0; i < len(users); i++ {
		sibkey := GetLocalUserSibkey(users[i])
		subkey := GetLocalUserSubkey(users[i])
		localUsers[i] = LocalUser{
			Name:         users[i],
			Uid:          libkb.UID{byte(i + 1)},
			Sibkeys:      []Key{sibkey},
			Subkeys:      []Key{subkey},
			DeviceSubkey: subkey,
		}
	}
	return localUsers
}

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
	config.SetKeyOps(&KeyOpsNull{})
	config.SetBlockOps(&BlockOpsStandard{config})
	//config.SetKeyServer
	config.SetBlockServer(NewBlockServerLocal("kbfs_block"))
	// 64K blocks by default, block changes embedded max == 8K
	config.SetBlockSplitter(&BlockSplitterSimple{64 * 1024, 8 * 1024})
	config.SetNotifier(config.kbfs.(*KBFSOpsStandard))
	return config
}

func (c *ConfigLocal) KBFSOps() KBFSOps {
	return c.kbfs
}

func (c *ConfigLocal) SetKBFSOps(k KBFSOps) {
	c.kbfs = k
}

func (c *ConfigLocal) KBPKI() KBPKI {
	return c.kbpki
}

func (c *ConfigLocal) SetKBPKI(k KBPKI) {
	c.kbpki = k
}

func (c *ConfigLocal) KeyManager() KeyManager {
	return c.keyman
}

func (c *ConfigLocal) SetKeyManager(k KeyManager) {
	c.keyman = k
}

func (c *ConfigLocal) Reporter() Reporter {
	return c.rep
}

func (c *ConfigLocal) SetReporter(r Reporter) {
	c.rep = r
}

func (c *ConfigLocal) MDCache() MDCache {
	return c.mdcache
}

func (c *ConfigLocal) SetMDCache(m MDCache) {
	c.mdcache = m
}

func (c *ConfigLocal) KeyCache() KeyCache {
	return c.kcache
}

func (c *ConfigLocal) SetKeyCache(k KeyCache) {
	c.kcache = k
}

func (c *ConfigLocal) BlockCache() BlockCache {
	return c.bcache
}

func (c *ConfigLocal) SetBlockCache(b BlockCache) {
	c.bcache = b
}

func (c *ConfigLocal) Crypto() Crypto {
	return c.crypto
}

func (c *ConfigLocal) SetCrypto(cr Crypto) {
	c.crypto = cr
}

func (c *ConfigLocal) Codec() Codec {
	return c.codec
}

func (c *ConfigLocal) SetCodec(co Codec) {
	c.codec = co
}

func (c *ConfigLocal) MDOps() MDOps {
	return c.mdops
}

func (c *ConfigLocal) SetMDOps(m MDOps) {
	c.mdops = m
}

func (c *ConfigLocal) KeyOps() KeyOps {
	return c.kops
}

func (c *ConfigLocal) SetKeyOps(k KeyOps) {
	c.kops = k
}

func (c *ConfigLocal) BlockOps() BlockOps {
	return c.bops
}

func (c *ConfigLocal) SetBlockOps(b BlockOps) {
	c.bops = b
}

func (c *ConfigLocal) MDServer() MDServer {
	return c.mdserv
}

func (c *ConfigLocal) SetMDServer(m MDServer) {
	c.mdserv = m
}

func (c *ConfigLocal) KeyServer() KeyServer {
	return c.kserv
}

func (c *ConfigLocal) SetKeyServer(k KeyServer) {
	c.kserv = k
}

func (c *ConfigLocal) BlockServer() BlockServer {
	return c.bserv
}

func (c *ConfigLocal) SetBlockServer(b BlockServer) {
	c.bserv = b
}

func (c *ConfigLocal) BlockSplitter() BlockSplitter {
	return c.bsplit
}

func (c *ConfigLocal) SetBlockSplitter(b BlockSplitter) {
	c.bsplit = b
}

func (c *ConfigLocal) Notifier() Notifier {
	return c.notifier
}

func (c *ConfigLocal) SetNotifier(n Notifier) {
	c.notifier = n
}

func (c *ConfigLocal) DataVersion() Ver {
	return 0
}

func (c *ConfigLocal) ReqsBufSize() int {
	return 20
}
