package libkb

import (
	"os"
	"runtime"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
)

const (
	DevelServerURI      = "http://localhost:3000"
	ProductionServerURI = "https://keybase.io"
)

var ServerURI = DevelServerURI

const (
	ConfigFile  = "config.json"
	SessionFile = "session.json"
	DBFile      = "keybase.leveldb"
	SocketFile  = "keybased.sock"
	PIDFile     = "keybased.pid"

	SecretKeyringTemplate = "secretkeys.%u.mpack"

	APIVersion       = "1.0"
	APIURIPathPrefix = "/_/api/" + APIVersion
	DaemonPort       = 40933
	GoClientID       = "keybase.io go client"
	IdentifyAs       = GoClientID + " v" + ClientVersion + " " + runtime.GOOS
)

var UserAgent = "Keybase-Go-CLI/" + ClientVersion + " (" + runtime.Version() + " on " + runtime.GOOS + ")"

const (
	PermFile          os.FileMode = 0600
	PermDir           os.FileMode = 0700
	UmaskablePermFile os.FileMode = 0666
)

const (
	UserCacheSize        = 0x1000
	PGPFingerprintHexLen = 40

	ProofCacheSize      = 0x10000
	ProofCacheLongDur   = 6 * time.Hour
	ProofCacheMediumDur = 30 * time.Minute
	ProofCacheShortDur  = 1 * time.Minute

	SigShortIDBytes = 27
)

var MerkleProdKIDs = []string{
	"010159baae6c7d43c66adf8fb7bb2b8b4cbe408c062cfc369e693ccb18f85631dbcd0a",
}
var MerkleTestKIDs = []string{
	"0101be58b6c82db64f6ccabb05088db443c69f87d5d48857d709ed6f73948dabe67d0a",
}

const (
	KeybaseKIDV1       = 1 // Uses SHA-256
	KeybaseSignatureV1 = 1

	SigExpireIn       = 24 * 60 * 60 * 365 * 10 // 10 years
	NaclEdDSAExpireIn = 24 * 60 * 60 * 365 * 3  // 3 years
	NaclDHExpireIn    = 24 * 60 * 60 * 365 * 3  // 3 years
	AuthExpireIn      = 24 * 60 * 60 * 365      // 1 year
	KeyExpireIn       = 24 * 60 * 60 * 365 * 8  // 8 years
	SubkeyExpireIn    = 24 * 60 * 60 * 365 * 4  // 4 years
)

// Status codes.  This list should match keybase/lib/constants.iced.
const (
	SC_OK                        = 0
	SC_LOGIN_REQUIRED            = 201
	SC_BAD_SESSION               = 202
	SC_BAD_LOGIN_PASSWORD        = 204
	SC_GENERIC                   = 218
	SC_ALREADY_LOGGED_IN         = 235
	SC_CANCELED                  = 237
	SC_BAD_SIGNUP_USERNAME_TAKEN = 701
	SC_KEY_NOT_FOUND             = 901
	SC_KEY_IN_USE                = 907
	SC_KEY_BAD_GEN               = 913
	SC_KEY_NO_SECRET             = 914
	SC_KEY_NO_ACTIVE             = 915
	SC_BAD_TRACK_SESSION         = 1301
	SC_STREAM_EXISTS             = 1501
	SC_STREAM_NOT_FOUND          = 1502
	SC_STREAM_WRONG_KIND         = 1503
	SC_STREAM_EOF                = 1504
	SC_API_NETWORK_ERROR         = 1601
	SC_PROOF_ERROR               = 1701
	SC_IDENTIFICATION_EXPIRED    = 1702
)

const (
	ID_SUFFIX_KID = 0x0a
)

const (
	MERKLE_TREE_NODE = 1
	MERKLE_TREE_LEAF = 2
)

const (
	SIBKEY_TYPE = "sibkey"
	SUBKEY_TYPE = "subkey"
	ELDEST_TYPE = "eldest"
)

const (
	SIG_TYPE_NONE           = 0
	SIG_TYPE_SELF_SIG       = 1
	SIG_TYPE_REMOTE_PROOF   = 2
	SIG_TYPE_TRACK          = 3
	SIG_TYPE_UNTRACK        = 4
	SIG_TYPE_REVOKE         = 5
	SIG_TYPE_CRYPTOCURRENCY = 6
	SIG_TYPE_ANNOUNCEMENT   = 7
)

type KeyType int

const (
	KEY_TYPE_NONE                      KeyType = 0
	KEY_TYPE_OPEN_PGP_PUBLIC                   = 1
	KEY_TYPE_P3SKB_PRIVATE                     = 2
	KEY_TYPE_KB_NACL_EDDSA                     = 3
	KEY_TYPE_KB_NACL_DH                        = 4
	KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF         = 5
	KEY_TYPE_KB_NACL_DH_SERVER_HALF            = 6
)

const (
	DEVICE_STATUS_NONE    = 0
	DEVICE_STATUS_ACTIVE  = 1
	DEVICE_STATUS_DEFUNCT = 2
)

const (
	DEVICE_TYPE_DESKTOP = "desktop"
	DEVICE_TYPE_MOBILE  = "mobile"
	DEVICE_TYPE_WEB     = "web"
)

const DOWNLOAD_URL = "https://keybase.io/download"

var PGP_VERSION = "Keybase Go " + ClientVersion + " (" + runtime.GOOS + ")"

var PgpArmorHeaders = map[string]string{
	"Version": PGP_VERSION,
	"Comment": DOWNLOAD_URL,
}

var REMOTE_SERVICE_TYPES = map[string]keybase1.ProofType{
	"keybase":    keybase1.ProofType_KEYBASE,
	"twitter":    keybase1.ProofType_TWITTER,
	"github":     keybase1.ProofType_GITHUB,
	"reddit":     keybase1.ProofType_REDDIT,
	"coinbase":   keybase1.ProofType_COINBASE,
	"hackernews": keybase1.ProofType_HACKERNEWS,
	"https":      keybase1.ProofType_GENERIC_WEB_SITE,
	"http":       keybase1.ProofType_GENERIC_WEB_SITE,
	"dns":        keybase1.ProofType_DNS,
}

var RemoteServiceOrder = []keybase1.ProofType{
	keybase1.ProofType_KEYBASE,
	keybase1.ProofType_TWITTER,
	keybase1.ProofType_GITHUB,
	keybase1.ProofType_REDDIT,
	keybase1.ProofType_COINBASE,
	keybase1.ProofType_HACKERNEWS,
	keybase1.ProofType_GENERIC_WEB_SITE,
}

const CANONICAL_HOST = "keybase.io"

const (
	HTTP_DEFAULT_TIMEOUT = 10 * time.Second
)

// Packet tags for OpenPGP and also Keybase packets
const (
	KEYBASE_PACKET_V1 = 1
	TAG_P3SKB         = 513
	TAG_SIGNATURE     = 514
)

const (
	KID_PGP_BASE    AlgoType = 0x00
	KID_PGP_RSA              = 0x1
	KID_PGP_ELGAMAL          = 0x10
	KID_PGP_DSA              = 0x11
	KID_PGP_ECDH             = 0x12
	KID_PGP_ECDSA            = 0x13
	KID_NACL_EDDSA           = 0x20
	KID_NACL_DH              = 0x21
)

// OpenPGP hash IDs, taken from http://tools.ietf.org/html/rfc4880#section-9.4
const (
	HASH_PGP_MD5       = 1
	HASH_PGP_SHA1      = 2
	HASH_PGP_RIPEMD160 = 3
	HASH_PGP_SHA256    = 8
	HASH_PGP_SHA384    = 9
	HASH_PGP_SHA512    = 10
	HASH_PGP_SHA224    = 11
)

const (
	SIG_KB_EDDSA = KID_NACL_EDDSA
)

const (
	SERVER_UPDATE_LAG = time.Minute
)

// key_revocation_types
const (
	REV_SIMPLE_DELETE = 0
	REV_FULL          = 1
	REV_DATED         = 2
)

type KeyStatus int

const (
	KEY_UNCANCELLED KeyStatus = iota
	KEY_REVOKED
	KEY_DELETED
	KEY_SUPERSEDED
)

type KeyRole int

const (
	DLG_NONE KeyRole = iota
	DLG_SIBKEY
	DLG_SUBKEY
)

const (
	KEX_SCRYPT_COST   = 32768
	KEX_SCRYPT_R      = 8
	KEX_SCRYPT_P      = 1
	KEX_SCRYPT_KEYLEN = 32
)

const KEX_SESSION_ID_ENTROPY = 65 // kex doc specifies 65 bits of entropy

const USER_SUMMARY_LIMIT = 500 // max number of user summaries in one request
