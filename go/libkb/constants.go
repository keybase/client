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
	IdentifyAs       = GoClientID + " v" + Version + " " + runtime.GOOS
)

var UserAgent = "Keybase-Go-CLI/" + Version + " (" + runtime.Version() + " on " + runtime.GOOS + ")"

const (
	PermFile          os.FileMode = 0600
	PermDir           os.FileMode = 0700
	UmaskablePermFile os.FileMode = 0666
)

const (
	UserCacheSize        = 0x1000
	PGPFingerprintHexLen = 40

	ProofCacheSize      = 0x1000
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
	OneYearInSeconds   = 24 * 60 * 60 * 365

	SigExpireIn       = OneYearInSeconds * 16 // 16 years
	NaclEdDSAExpireIn = OneYearInSeconds * 16 // 16 years
	NaclDHExpireIn    = OneYearInSeconds * 16 // 16 years
	KeyExpireIn       = OneYearInSeconds * 16 // 16 years
	SubkeyExpireIn    = OneYearInSeconds * 16 // 16 years
	AuthExpireIn      = OneYearInSeconds      // 1 year
)

// Status codes.  This list should match keybase/lib/constants.iced.
const (
	SCOk                     = 0
	SCLoginRequired          = 201
	SCBadSession             = 202
	SCBadLoginPassword       = 204
	SCNotFound               = 205
	SCGeneric                = 218
	SCAlreadyLoggedIn        = 235
	SCCanceled               = 237
	SCBadSignupUsernameTaken = 701
	SCKeyNotFound            = 901
	SCKeyInUse               = 907
	SCKeyBadGen              = 913
	SCKeyNoSecret            = 914
	SCKeyBadUIDs             = 915
	SCKeyNoActive            = 916
	SCKeyNoSig               = 917
	SCKeyBadSig              = 918
	SCKeyBadEldest           = 919
	SCKeyNoEldest            = 920
	SCKeyDuplicateUpdate     = 921
	SCBadTrackSession        = 1301
	SCStreamExists           = 1501
	SCStreamNotFound         = 1502
	SCStreamWrongKind        = 1503
	SCStreamEOF              = 1504
	SCAPINetworkError        = 1601
	SCTimeout                = 1602
	SCProofError             = 1701
	SCIdentificationExpired  = 1702
)

const (
	IDSuffixKID = 0x0a
)

const (
	MerkleTreeNode = 1
	MerkleTreeLeaf = 2
)

type LinkType string
type DelegationType LinkType

const (
	AuthenticationType    LinkType = "auth"
	CryptocurrencyType             = "cryptocurrency"
	RevokeType                     = "revoke"
	TrackType                      = "track"
	UntrackType                    = "untrack"
	UpdatePassphraseType           = "update_passphrase_hash"
	WebServiceBindingType          = "web_service_binding"

	EldestType    DelegationType = "eldest"
	PGPUpdateType                = "pgp_update"
	SibkeyType                   = "sibkey"
	SubkeyType                   = "subkey"
)

const (
	SigTypeNone           = 0
	SigTypeSelfSig        = 1
	SigTypeRemoteProof    = 2
	SigTypeTrack          = 3
	SigTypeUntrack        = 4
	SigTypeRevoke         = 5
	SigTypeCryptocurrency = 6
	SigTypeAnnouncement   = 7
)

type KeyType int

const (
	KeyTypeNone                  KeyType = 0
	KeyTypeOpenPGPPublic                 = 1
	KeyTypeP3skbPrivate                  = 2
	KeyTypeKbNaclEddsa                   = 3
	KeyTypeKbNaclDH                      = 4
	KeyTypeKbNaclEddsaServerHalf         = 5
	KeyTypeKbNaclDHServerHalf            = 6
)

const (
	DeviceStatusNone    = 0
	DeviceStatusActive  = 1
	DeviceStatusDefunct = 2
)

// these strings need to match the keys in
// keybase/lib_public/public_constants.iced ->
// public_constants.device.type
const (
	DeviceTypeDesktop = "desktop"
	DeviceTypeMobile  = "mobile"
	DeviceTypePaper   = "backup"
)

const DownloadURL = "https://keybase.io/download"

var PGPVersion = "Keybase Go " + Version + " (" + runtime.GOOS + ")"

var PGPArmorHeaders = map[string]string{
	"Version": PGPVersion,
	"Comment": DownloadURL,
}

var RemoteServiceTypes = map[string]keybase1.ProofType{
	"keybase":    keybase1.ProofType_KEYBASE,
	"twitter":    keybase1.ProofType_TWITTER,
	"github":     keybase1.ProofType_GITHUB,
	"reddit":     keybase1.ProofType_REDDIT,
	"coinbase":   keybase1.ProofType_COINBASE,
	"hackernews": keybase1.ProofType_HACKERNEWS,
	"https":      keybase1.ProofType_GENERIC_WEB_SITE,
	"http":       keybase1.ProofType_GENERIC_WEB_SITE,
	"dns":        keybase1.ProofType_DNS,
	"rooter":     keybase1.ProofType_ROOTER,
}

var RemoteServiceOrder = []keybase1.ProofType{
	keybase1.ProofType_KEYBASE,
	keybase1.ProofType_TWITTER,
	keybase1.ProofType_GITHUB,
	keybase1.ProofType_REDDIT,
	keybase1.ProofType_COINBASE,
	keybase1.ProofType_HACKERNEWS,
	keybase1.ProofType_GENERIC_WEB_SITE,
	keybase1.ProofType_ROOTER,
}

const CanonicalHost = "keybase.io"

const (
	HTTPDefaultTimeout = 10 * time.Second
)

// Packet tags for OpenPGP and also Keybase packets
const (
	KeybasePacketV1 = 1
	TagP3skb        = 513
	TagSignature    = 514
	TagEncryption   = 515
)

const (
	KIDPGPBase    AlgoType = 0x00
	KIDPGPRsa              = 0x1
	KIDPGPElgamal          = 0x10
	KIDPGPDsa              = 0x11
	KIDPGPEcdh             = 0x12
	KIDPGPEcdsa            = 0x13
	KIDNaclEddsa           = 0x20
	KIDNaclDH              = 0x21
)

// OpenPGP hash IDs, taken from http://tools.ietf.org/html/rfc4880#section-9.4
const (
	HashPGPMd5       = 1
	HashPGPSha1      = 2
	HashPGPRipemd160 = 3
	HashPGPSha256    = 8
	HashPGPSha384    = 9
	HashPGPSha512    = 10
	HashPGPSha224    = 11
)

const (
	SigKbEddsa = KIDNaclEddsa
)

const (
	ServerUpdateLag = time.Minute
)

// key_revocation_types
const (
	RevSimpleDelete = 0
	RevFull         = 1
	RevDated        = 2
)

type KeyStatus int

const (
	KeyUncancelled KeyStatus = iota
	KeyRevoked
	KeyDeleted
	KeySuperseded
)

type KeyRole int

const (
	DLGNone KeyRole = iota
	DLGSibkey
	DLGSubkey
)

const (
	KexScryptCost       = 32768
	KexScryptR          = 8
	KexScryptP          = 1
	KexScryptKeylen     = 32
	KexSessionIDEntropy = 65 // kex doc specifies 65 bits of entropy
)

const (
	PaperKeyScryptCost    = 32768
	PaperKeyScryptR       = 8
	PaperKeyScryptP       = 1
	PaperKeyScryptKeylen  = 128
	PaperKeyPhraseEntropy = 144
	PaperKeyVersion       = 0
)

const UserSummaryLimit = 500 // max number of user summaries in one request

const MinPassphraseLength = 12
