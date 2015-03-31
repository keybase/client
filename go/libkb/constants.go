package libkb

import (
	"os"
	"runtime"
	"time"
)

var SERVER_URL = "https://api.keybase.io:443"
var CONFIG_FILE = "config.json"
var SESSION_FILE = "session.json"
var SECRET_KEYRING_TEMPLATE = "secretkeys.%u.mpack"
var DB_FILE = "keybase.leveldb"
var API_VERSION = "1.0"
var API_URI_PATH_PREFIX = "/_/api/" + API_VERSION
var DAEMON_PORT = 40933
var SOCKET_FILE = "keybased.sock"
var PID_FILE = "keybased.pid"

var GO_CLIENT_ID = "keybase.io go client"

var IDENTIFY_AS = GO_CLIENT_ID + " v" + CLIENT_VERSION + " " + runtime.GOOS
var USER_AGENT = ("Keybase-Go-CLI/" + CLIENT_VERSION +
	" (" + runtime.Version() + " on " + runtime.GOOS + ")")

var PERM_FILE os.FileMode = 0600
var PERM_DIR os.FileMode = 0700
var UMASKABLE_PERM_FILE os.FileMode = 0666

var USER_CACHE_SIZE = 0x1000
var PROOF_CACHE_SIZE = 0x10000
var PGP_FINGERPRINT_HEX_LEN = 40

var SIG_SHORT_ID_BYTES = 27

var MERKLE_PROD_KEY = "03E146CDAF8136680AD566912A32340CEC8C9492"
var MERKLE_TEST_KEY = "A05161510EE696601BA0EC7B3FD53B4871528CEF"

var KEYBASE_KID_V1 = 1 // Uses SHA-256
var KEYBASE_KID_V2 = 2 // Uses Shake256
var KEYBASE_SIGNATURE_V1 = 1
var SIG_EXPIRE_IN = 24 * 60 * 60 * 365 * 10       // 10 years
var NACL_EDDSA_EXPIRE_IN = 24 * 60 * 60 * 365 * 3 // 3 years
var NACL_DH_EXPIRE_IN = 24 * 60 * 60 * 365 * 3    // 3 years
var AUTH_EXPIRE_IN = 24 * 60 * 60 * 365           // 1 year
var KEY_EXPIRE_IN = 24 * 60 * 60 * 365 * 8        // 8 years
var SUBKEY_EXPIRE_IN = 24 * 60 * 60 * 365 * 4     // 4 years

var TRACK_SESSION_TIMEOUT = time.Minute

const (
	SC_OK                        = 0
	SC_LOGIN_REQUIRED            = 201
	SC_BAD_SESSION               = 202
	SC_BAD_LOGIN_PASSWORD        = 204
	SC_GENERIC                   = 218
	SC_ALREADY_LOGGED_IN         = 235
	SC_CANCELED                  = 237
	SC_BAD_SIGNUP_USERNAME_TAKEN = 701
	SC_KEY_IN_USE                = 907
	SC_KEY_BAD_GEN               = 913
	SC_KEY_NO_SECRET             = 914
	SC_BAD_TRACK_SESSION         = 1301
	SC_STREAM_EXISTS             = 1501
	SC_STREAM_NOT_FOUND          = 1502
	SC_STREAM_WRONG_KIND         = 1503
	SC_STREAM_EOF                = 1504
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

// Taken from node-client/src/constants.iced
const (
	PROOF_STATE_NONE         = 0
	PROOF_STATE_OK           = 1
	PROOF_STATE_TEMP_FAILURE = 2
	PROOF_STATE_PERM_FAILURE = 3
	PROOF_STATE_LOOKING      = 4
	PROOF_STATE_SUPERSEDED   = 5
	PROOF_STATE_POSTED       = 6
	PROOF_STATE_REVOKED      = 7
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

var PGP_VERSION = "Keybase Go " + CLIENT_VERSION + " (" + runtime.GOOS + ")"

func PgpArmorHeaders() map[string]string {
	return map[string]string{
		"Version": PGP_VERSION,
	}
}

var REMOTE_SERVICE_TYPES = map[string]int{
	"keybase":    PROOF_TYPE_KEYBASE,
	"twitter":    PROOF_TYPE_TWITTER,
	"github":     PROOF_TYPE_GITHUB,
	"reddit":     PROOF_TYPE_REDDIT,
	"coinbase":   PROOF_TYPE_COINBASE,
	"hackernews": PROOF_TYPE_HACKERNEWS,
	"https":      PROOF_TYPE_GENERIC_WEB_SITE,
	"http":       PROOF_TYPE_GENERIC_WEB_SITE,
	"dns":        PROOF_TYPE_DNS,
}

var CANONICAL_HOST = "keybase.io"

const (
	HTTP_DEFAULT_TIMEOUT = 10 * time.Second
)

// Packet tags for OpenPGP and also Keybase packets
var (
	KEYBASE_PACKET_V1 = 1
	TAG_P3SKB         = 513
	TAG_SIGNATURE     = 514
)

var (
	KID_PGP_BASE    = 0x00
	KID_PGP_RSA     = 0x1
	KID_PGP_ELGAMAL = 0x10
	KID_PGP_DSA     = 0x11
	KID_PGP_ECDH    = 0x12
	KID_PGP_ECDSA   = 0x13
	KID_NACL_EDDSA  = 0x20
	KID_NACL_DH     = 0x21
)

// OpenPGP hash IDs, taken from http://tools.ietf.org/html/rfc4880#section-9.4
var (
	HASH_PGP_MD5       = 1
	HASH_PGP_SHA1      = 2
	HASH_PGP_RIPEMD160 = 3
	HASH_PGP_SHA256    = 8
	HASH_PGP_SHA384    = 9
	HASH_PGP_SHA512    = 10
	HASH_PGP_SHA224    = 11
)

var (
	PROOF_TYPE_NONE             = 0
	PROOF_TYPE_KEYBASE          = 1
	PROOF_TYPE_TWITTER          = 2
	PROOF_TYPE_GITHUB           = 3
	PROOF_TYPE_REDDIT           = 4
	PROOF_TYPE_COINBASE         = 5
	PROOF_TYPE_HACKERNEWS       = 6
	PROOF_TYPE_GENERIC_WEB_SITE = 1000
	PROOF_TYPE_DNS              = 1001
)

var (
	SIG_KB_EDDSA = KID_NACL_EDDSA
)

var (
	SERVER_UPDATE_LAG = time.Minute
)

// key_revocation_types
var (
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
