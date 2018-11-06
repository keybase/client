// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"os"
	"runtime"
	"time"

	"github.com/keybase/client/go/kbconst"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
)

const (
	DevelServerURI      = "http://localhost:3000"
	StagingServerURI    = "https://stage0.keybase.io"
	ProductionServerURI = "https://api-0.core.keybaseapi.com"
	TorServerURI        = "http://fncuwbiisyh6ak3i.onion"
)

var TorProxy = "localhost:9050"

// TODO (CORE-6576): Remove these aliases once everything outside of
// this repo points to kbconst.RunMode.

type RunMode = kbconst.RunMode

const (
	DevelRunMode      RunMode = kbconst.DevelRunMode
	StagingRunMode    RunMode = kbconst.StagingRunMode
	ProductionRunMode RunMode = kbconst.ProductionRunMode
	RunModeError      RunMode = kbconst.RunModeError
	NoRunMode         RunMode = kbconst.NoRunMode
)

var ServerLookup = map[RunMode]string{
	DevelRunMode:      DevelServerURI,
	StagingRunMode:    StagingServerURI,
	ProductionRunMode: ProductionServerURI,
}

const (
	DevelGregorServerURI      = "fmprpc://localhost:9911"
	StagingGregorServerURI    = "fmprpc+tls://gregord.dev.keybase.io:4443"
	ProductionGregorServerURI = "fmprpc+tls://chat-0.core.keybaseapi.com:443"
)

var GregorServerLookup = map[RunMode]string{
	DevelRunMode:      DevelGregorServerURI,
	StagingRunMode:    StagingGregorServerURI,
	ProductionRunMode: ProductionGregorServerURI,
}

const (
	ConfigFile           = "config.json"
	SessionFile          = "session.json"
	UpdaterConfigFile    = "updater.json"
	DeviceCloneStateFile = "device_clone.json"
	DBFile               = "keybase.leveldb"
	ChatDBFile           = "keybase.chat.leveldb"
	SocketFile           = "keybased.sock"
	PIDFile              = "keybased.pid"

	SecretKeyringTemplate = "secretkeys.%u.mpack"

	APIVersion           = "1.0"
	APIURIPathPrefix     = "/_/api/" + APIVersion
	DaemonPort           = 40933
	GoClientID           = "keybase.io go client"
	KeybaseSaltpackBrand = "KEYBASE"
)

// Right now reddit is the only site that seems to have any requirements for
// our User-Agent string. (See https://github.com/reddit/reddit/wiki/API.)If
// something else comes up, we'll want to make this more configurable.
var UserAgent = runtime.GOOS + ":" + "Keybase CLI (" + runtime.Version() + "):" + Version

const (
	PermFile          os.FileMode = 0600
	PermDir           os.FileMode = 0700
	UmaskablePermFile os.FileMode = 0666
)

const (
	UserCacheMaxAge      = 5 * time.Minute
	PGPFingerprintHexLen = 40

	ProofCacheSize      = 0x1000
	ProofCacheLongDur   = 48 * time.Hour
	ProofCacheMediumDur = 6 * time.Hour
	ProofCacheShortDur  = 30 * time.Minute

	// How old the merkle root must be to ask for a refresh.
	// Measures time since the root was fetched, not time since published.
	MerkleStoreShouldRefresh time.Duration = 1 * time.Hour
	// An older merkle root than this is too old to use. All identifies will fail.
	MerkleStoreRequireRefresh time.Duration = 24 * time.Hour

	Identify2CacheLongTimeout   = 6 * time.Hour
	Identify2CacheBrokenTimeout = 1 * time.Hour
	Identify2CacheShortTimeout  = 1 * time.Minute

	// How long we'll go without rerequesting hints/merkle seqno. This is used in both
	// CachedUPAKLoader and FullSelfCacher. Note that this timeout has to exceed the
	// dtime value for Gregor IBMs that deal with user and key family changed notifications.
	// Because if the client is offline for more than that amount of time, then our cache
	// could be stale.
	CachedUserTimeout = 10 * time.Minute

	LinkCacheSize     = 4000
	LinkCacheCleanDur = 1 * time.Minute

	UPAKCacheSize                     = 2000
	UIDMapFullNameCacheSize           = 100000
	ImplicitTeamConflictInfoCacheSize = 10000
	ImplicitTeamCacheSize             = 10000

	PayloadCacheSize = 1000

	SigShortIDBytes  = 27
	LocalTrackMaxAge = 48 * time.Hour

	CriticalClockSkewLimit = time.Hour

	ChatBoxerMerkleFreshness    = 10 * time.Minute
	TeamMerkleFreshnessForAdmin = 30 * time.Second
	EphemeralKeyMerkleFreshness = 30 * time.Second

	// By default, only 48 files can be opened.
	LevelDBNumFiles = 48

	HomeCacheTimeout       = (time.Hour - time.Minute)
	HomePeopleCacheTimeout = 10 * time.Minute
)

const RemoteIdentifyUITimeout = 5 * time.Second

var MerkleProdKIDs = []string{
	"010159baae6c7d43c66adf8fb7bb2b8b4cbe408c062cfc369e693ccb18f85631dbcd0a",
	"01209ec31411b9b287f62630c2486005af27548ba62a59bbc802e656b888991a20230a",
}
var MerkleTestKIDs = []string{
	"0101be58b6c82db64f6ccabb05088db443c69f87d5d48857d709ed6f73948dabe67d0a",
	"0120328031cf9d2a6108036408aeb3646b8985f7f8ff1a8e635e829d248a48b1014d0a",
}
var MerkleStagingKIDs = []string{
	"0101bed85ce72cc315828367c28b41af585b6b7d95646a62ca829691d70f49184fa70a",
}

var CodeSigningProdKIDs = []string{
	"01209092ae4e790763dc7343851b977930f35b16cf43ab0ad900a2af3d3ad5cea1a10a", // keybot (device)
	"0120d3458bbecdfc0d0ae39fec05722c6e3e897c169223835977a8aa208dfcd902d30a", // max (device, home)
	"012065ae849d1949a8b0021b165b0edaf722e2a7a9036e07817e056e2d721bddcc0e0a", // max (paper key)
	"01203a5a45c545ef4f661b8b7573711aaecee3fd5717053484a3a3e725cd68abaa5a0a", // chris (device, ccpro)
	"012003d86864fb20e310590042ad3d5492c3f5d06728620175b03c717c211bfaccc20a", // chris (paper key, clay harbor)
}
var CodeSigningTestKIDs = []string{}
var CodeSigningStagingKIDs = []string{}

// SigVersion describes how the signature is computed. In signatures v1, the payload is a JSON
// blob. In Signature V2, it's a Msgpack wrapper that points via SHA256 to the V1 blob.
// V2 sigs allow for bandwidth-saving eliding of signature bodies that aren't relevant to clients.
type SigVersion int

const (
	KeybaseNullSigVersion SigVersion = 0
	KeybaseSignatureV1    SigVersion = 1
	KeybaseSignatureV2    SigVersion = 2
)

const (
	OneYearInSeconds = 24 * 60 * 60 * 365

	SigExpireIn            = OneYearInSeconds * 16 // 16 years
	NaclEdDSAExpireIn      = OneYearInSeconds * 16 // 16 years
	NaclDHExpireIn         = OneYearInSeconds * 16 // 16 years
	NaclPerUserKeyExpireIn = OneYearInSeconds * 16 // 16 years
	KeyExpireIn            = OneYearInSeconds * 16 // 16 years
	SubkeyExpireIn         = OneYearInSeconds * 16 // 16 years
	AuthExpireIn           = OneYearInSeconds      // 1 year

	ProvisioningKeyMemoryTimeout = time.Hour
)

// Status codes.  This list should match keybase/lib/status_codes.iced.
const (
	SCOk                               = int(keybase1.StatusCode_SCOk)
	SCInputError                       = int(keybase1.StatusCode_SCInputError)
	SCLoginRequired                    = int(keybase1.StatusCode_SCLoginRequired)
	SCBadSession                       = int(keybase1.StatusCode_SCBadSession)
	SCNoSession                        = int(keybase1.StatusCode_SCNoSession)
	SCBadLoginUserNotFound             = int(keybase1.StatusCode_SCBadLoginUserNotFound)
	SCBadLoginPassword                 = int(keybase1.StatusCode_SCBadLoginPassword)
	SCNotFound                         = int(keybase1.StatusCode_SCNotFound)
	SCDeleted                          = int(keybase1.StatusCode_SCDeleted)
	SCThrottleControl                  = int(keybase1.StatusCode_SCThrottleControl)
	SCGeneric                          = int(keybase1.StatusCode_SCGeneric)
	SCAlreadyLoggedIn                  = int(keybase1.StatusCode_SCAlreadyLoggedIn)
	SCCanceled                         = int(keybase1.StatusCode_SCCanceled)
	SCInputCanceled                    = int(keybase1.StatusCode_SCInputCanceled)
	SCExists                           = int(keybase1.StatusCode_SCExists)
	SCInvalidAddress                   = int(keybase1.StatusCode_SCInvalidAddress)
	SCReloginRequired                  = int(keybase1.StatusCode_SCReloginRequired)
	SCResolutionFailed                 = int(keybase1.StatusCode_SCResolutionFailed)
	SCProfileNotPublic                 = int(keybase1.StatusCode_SCProfileNotPublic)
	SCRateLimit                        = int(keybase1.StatusCode_SCRateLimit)
	SCBadSignupUsernameTaken           = int(keybase1.StatusCode_SCBadSignupUsernameTaken)
	SCBadInvitationCode                = int(keybase1.StatusCode_SCBadInvitationCode)
	SCFeatureFlag                      = int(keybase1.StatusCode_SCFeatureFlag)
	SCMissingResult                    = int(keybase1.StatusCode_SCMissingResult)
	SCKeyNotFound                      = int(keybase1.StatusCode_SCKeyNotFound)
	SCKeyCorrupted                     = int(keybase1.StatusCode_SCKeyCorrupted)
	SCKeyInUse                         = int(keybase1.StatusCode_SCKeyInUse)
	SCKeyBadGen                        = int(keybase1.StatusCode_SCKeyBadGen)
	SCKeyNoSecret                      = int(keybase1.StatusCode_SCKeyNoSecret)
	SCKeyBadUIDs                       = int(keybase1.StatusCode_SCKeyBadUIDs)
	SCKeyNoActive                      = int(keybase1.StatusCode_SCKeyNoActive)
	SCKeyNoSig                         = int(keybase1.StatusCode_SCKeyNoSig)
	SCKeyBadSig                        = int(keybase1.StatusCode_SCKeyBadSig)
	SCKeyBadEldest                     = int(keybase1.StatusCode_SCKeyBadEldest)
	SCKeyNoEldest                      = int(keybase1.StatusCode_SCKeyNoEldest)
	SCKeyDuplicateUpdate               = int(keybase1.StatusCode_SCKeyDuplicateUpdate)
	SCKeySyncedPGPNotFound             = int(keybase1.StatusCode_SCKeySyncedPGPNotFound)
	SCKeyNoMatchingGPG                 = int(keybase1.StatusCode_SCKeyNoMatchingGPG)
	SCKeyRevoked                       = int(keybase1.StatusCode_SCKeyRevoked)
	SCSigCannotVerify                  = int(keybase1.StatusCode_SCSigCannotVerify)
	SCSibkeyAlreadyExists              = int(keybase1.StatusCode_SCSibkeyAlreadyExists)
	SCSigCreationDisallowed            = int(keybase1.StatusCode_SCSigCreationDisallowed)
	SCDecryptionKeyNotFound            = int(keybase1.StatusCode_SCDecryptionKeyNotFound)
	SCBadTrackSession                  = int(keybase1.StatusCode_SCBadTrackSession)
	SCDeviceBadName                    = int(keybase1.StatusCode_SCDeviceBadName)
	SCDeviceNameInUse                  = int(keybase1.StatusCode_SCDeviceNameInUse)
	SCDeviceNotFound                   = int(keybase1.StatusCode_SCDeviceNotFound)
	SCDeviceMismatch                   = int(keybase1.StatusCode_SCDeviceMismatch)
	SCDeviceRequired                   = int(keybase1.StatusCode_SCDeviceRequired)
	SCDevicePrevProvisioned            = int(keybase1.StatusCode_SCDevicePrevProvisioned)
	SCDeviceProvisionViaDevice         = int(keybase1.StatusCode_SCDeviceProvisionViaDevice)
	SCDeviceNoProvision                = int(keybase1.StatusCode_SCDeviceNoProvision)
	SCDeviceProvisionOffline           = int(keybase1.StatusCode_SCDeviceProvisionOffline)
	SCStreamExists                     = int(keybase1.StatusCode_SCStreamExists)
	SCStreamNotFound                   = int(keybase1.StatusCode_SCStreamNotFound)
	SCStreamWrongKind                  = int(keybase1.StatusCode_SCStreamWrongKind)
	SCStreamEOF                        = int(keybase1.StatusCode_SCStreamEOF)
	SCGenericAPIError                  = int(keybase1.StatusCode_SCGenericAPIError)
	SCAPINetworkError                  = int(keybase1.StatusCode_SCAPINetworkError)
	SCTimeout                          = int(keybase1.StatusCode_SCTimeout)
	SCProofError                       = int(keybase1.StatusCode_SCProofError)
	SCIdentificationExpired            = int(keybase1.StatusCode_SCIdentificationExpired)
	SCSelfNotFound                     = int(keybase1.StatusCode_SCSelfNotFound)
	SCBadKexPhrase                     = int(keybase1.StatusCode_SCBadKexPhrase)
	SCNoUI                             = int(keybase1.StatusCode_SCNoUI)
	SCNoUIDelegation                   = int(keybase1.StatusCode_SCNoUIDelegation)
	SCIdentifyFailed                   = int(keybase1.StatusCode_SCIdentifyFailed)
	SCTrackingBroke                    = int(keybase1.StatusCode_SCTrackingBroke)
	SCKeyNoPGPEncryption               = int(keybase1.StatusCode_SCKeyNoPGPEncryption)
	SCKeyNoNaClEncryption              = int(keybase1.StatusCode_SCKeyNoNaClEncryption)
	SCWrongCryptoFormat                = int(keybase1.StatusCode_SCWrongCryptoFormat)
	SCGPGUnavailable                   = int(keybase1.StatusCode_SCGPGUnavailable)
	SCDecryptionError                  = int(keybase1.StatusCode_SCDecryptionError)
	SCChatInternal                     = int(keybase1.StatusCode_SCChatInternal)
	SCChatRateLimit                    = int(keybase1.StatusCode_SCChatRateLimit)
	SCChatConvExists                   = int(keybase1.StatusCode_SCChatConvExists)
	SCChatUnknownTLFID                 = int(keybase1.StatusCode_SCChatUnknownTLFID)
	SCChatNotInConv                    = int(keybase1.StatusCode_SCChatNotInConv)
	SCChatNotInTeam                    = int(keybase1.StatusCode_SCChatNotInTeam)
	SCChatBadMsg                       = int(keybase1.StatusCode_SCChatBadMsg)
	SCChatBroadcast                    = int(keybase1.StatusCode_SCChatBroadcast)
	SCChatAlreadySuperseded            = int(keybase1.StatusCode_SCChatAlreadySuperseded)
	SCChatAlreadyDeleted               = int(keybase1.StatusCode_SCChatAlreadyDeleted)
	SCChatTLFFinalized                 = int(keybase1.StatusCode_SCChatTLFFinalized)
	SCChatCollision                    = int(keybase1.StatusCode_SCChatCollision)
	SCChatStalePreviousState           = int(keybase1.StatusCode_SCChatStalePreviousState)
	SCMerkleClientError                = int(keybase1.StatusCode_SCMerkleClientError)
	SCBadEmail                         = int(keybase1.StatusCode_SCBadEmail)
	SCIdentifySummaryError             = int(keybase1.StatusCode_SCIdentifySummaryError)
	SCNeedSelfRekey                    = int(keybase1.StatusCode_SCNeedSelfRekey)
	SCNeedOtherRekey                   = int(keybase1.StatusCode_SCNeedOtherRekey)
	SCChatMessageCollision             = int(keybase1.StatusCode_SCChatMessageCollision)
	SCChatDuplicateMessage             = int(keybase1.StatusCode_SCChatDuplicateMessage)
	SCChatClientError                  = int(keybase1.StatusCode_SCChatClientError)
	SCAccountReset                     = int(keybase1.StatusCode_SCAccountReset)
	SCIdentifiesFailed                 = int(keybase1.StatusCode_SCIdentifiesFailed)
	SCTeamReadError                    = int(keybase1.StatusCode_SCTeamReadError)
	SCTeamWritePermDenied              = int(keybase1.StatusCode_SCTeamWritePermDenied)
	SCNoOp                             = int(keybase1.StatusCode_SCNoOp)
	SCTeamNotFound                     = int(keybase1.StatusCode_SCTeamNotFound)
	SCTeamTarDuplicate                 = int(keybase1.StatusCode_SCTeamTarDuplicate)
	SCTeamTarNotFound                  = int(keybase1.StatusCode_SCTeamTarNotFound)
	SCTeamMemberExists                 = int(keybase1.StatusCode_SCTeamMemberExists)
	SCTeamFTLOutdated                  = int(keybase1.StatusCode_SCTeamFTLOutdated)
	SCLoginStateTimeout                = int(keybase1.StatusCode_SCLoginStateTimeout)
	SCRevokeCurrentDevice              = int(keybase1.StatusCode_SCRevokeCurrentDevice)
	SCRevokeLastDevice                 = int(keybase1.StatusCode_SCRevokeLastDevice)
	SCRevokeLastDevicePGP              = int(keybase1.StatusCode_SCRevokeLastDevicePGP)
	SCTeamKeyMaskNotFound              = int(keybase1.StatusCode_SCTeamKeyMaskNotFound)
	SCGitInternal                      = int(keybase1.StatusCode_SCGitInternal)
	SCGitRepoAlreadyExists             = int(keybase1.StatusCode_SCGitRepoAlreadyExists)
	SCGitInvalidRepoName               = int(keybase1.StatusCode_SCGitInvalidRepoName)
	SCGitCannotDelete                  = int(keybase1.StatusCode_SCGitCannotDelete)
	SCGitRepoDoesntExist               = int(keybase1.StatusCode_SCGitRepoDoesntExist)
	SCTeamBanned                       = int(keybase1.StatusCode_SCTeamBanned)
	SCTeamInvalidBan                   = int(keybase1.StatusCode_SCTeamInvalidBan)
	SCNoSpaceOnDevice                  = int(keybase1.StatusCode_SCNoSpaceOnDevice)
	SCTeamInviteBadToken               = int(keybase1.StatusCode_SCTeamInviteBadToken)
	SCTeamInviteTokenReused            = int(keybase1.StatusCode_SCTeamInviteTokenReused)
	SCTeamBadMembership                = int(keybase1.StatusCode_SCTeamBadMembership)
	SCTeamProvisionalCanKey            = int(keybase1.StatusCode_SCTeamProvisionalCanKey)
	SCTeamProvisionalCannotKey         = int(keybase1.StatusCode_SCTeamProvisionalCannotKey)
	SCBadSignupUsernameDeleted         = int(keybase1.StatusCode_SCBadSignupUsernameDeleted)
	SCEphemeralPairwiseMACsMissingUIDs = int(keybase1.StatusCode_SCEphemeralPairwiseMACsMissingUIDs)
	SCEphemeralDeviceAfterEK           = int(keybase1.StatusCode_SCEphemeralDeviceAfterEK)
	SCEphemeralMemberAfterEK           = int(keybase1.StatusCode_SCEphemeralMemberAfterEK)
	SCEphemeralDeviceStale             = int(keybase1.StatusCode_SCEphemeralDeviceStale)
	SCEphemeralUserStale               = int(keybase1.StatusCode_SCEphemeralUserStale)
	SCStellarNeedDisclaimer            = int(keybase1.StatusCode_SCStellarNeedDisclaimer)
	SCStellarDeviceNotMobile           = int(keybase1.StatusCode_SCStellarDeviceNotMobile)
	SCStellarMobileOnlyPurgatory       = int(keybase1.StatusCode_SCStellarMobileOnlyPurgatory)
	SCStellarIncompatibleVersion       = int(keybase1.StatusCode_SCStellarIncompatibleVersion)
	SCStellarMissingAccount            = int(keybase1.StatusCode_SCStellarMissingAccount)
)

const (
	MerkleTreeNode = 1
	MerkleTreeLeaf = 2
)

type LinkType string
type DelegationType LinkType

const (
	LinkTypeAuthentication    LinkType = "auth"
	LinkTypeCryptocurrency    LinkType = "cryptocurrency"
	LinkTypeRevoke            LinkType = "revoke"
	LinkTypeTrack             LinkType = "track"
	LinkTypeUntrack           LinkType = "untrack"
	LinkTypeUpdatePassphrase  LinkType = "update_passphrase_hash"
	LinkTypeUpdateSettings    LinkType = "update_settings"
	LinkTypeWebServiceBinding LinkType = "web_service_binding"
	LinkTypePerUserKey        LinkType = "per_user_key"
	LinkTypeWalletStellar     LinkType = "wallet.stellar"

	// team links
	LinkTypeTeamRoot         LinkType = "team.root"
	LinkTypeNewSubteam       LinkType = "team.new_subteam"
	LinkTypeChangeMembership LinkType = "team.change_membership"
	LinkTypeRotateKey        LinkType = "team.rotate_key"
	LinkTypeLeave            LinkType = "team.leave"
	LinkTypeSubteamHead      LinkType = "team.subteam_head"
	LinkTypeRenameSubteam    LinkType = "team.rename_subteam"
	LinkTypeInvite           LinkType = "team.invite"
	LinkTypeRenameUpPointer  LinkType = "team.rename_up_pointer"
	LinkTypeDeleteRoot       LinkType = "team.delete_root"
	LinkTypeDeleteSubteam    LinkType = "team.delete_subteam"
	LinkTypeDeleteUpPointer  LinkType = "team.delete_up_pointer"
	LinkTypeKBFSSettings     LinkType = "team.kbfs"
	LinkTypeSettings         LinkType = "team.settings"

	DelegationTypeEldest    DelegationType = "eldest"
	DelegationTypePGPUpdate DelegationType = "pgp_update"
	DelegationTypeSibkey    DelegationType = "sibkey"
	DelegationTypeSubkey    DelegationType = "subkey"
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
	KeyTypeOpenPGPPublic         KeyType = 1
	KeyTypeP3skbPrivate          KeyType = 2
	KeyTypeKbNaclEddsa           KeyType = 3
	KeyTypeKbNaclDH              KeyType = 4
	KeyTypeKbNaclEddsaServerHalf KeyType = 5
	KeyTypeKbNaclDHServerHalf    KeyType = 6
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

const GenericSocialWebServiceBinding = "web_service_binding.generic_social"

var RemoteServiceTypes = map[string]keybase1.ProofType{
	"keybase":        keybase1.ProofType_KEYBASE,
	"twitter":        keybase1.ProofType_TWITTER,
	"facebook":       keybase1.ProofType_FACEBOOK,
	"github":         keybase1.ProofType_GITHUB,
	"reddit":         keybase1.ProofType_REDDIT,
	"coinbase":       keybase1.ProofType_COINBASE,
	"hackernews":     keybase1.ProofType_HACKERNEWS,
	"https":          keybase1.ProofType_GENERIC_WEB_SITE,
	"http":           keybase1.ProofType_GENERIC_WEB_SITE,
	"dns":            keybase1.ProofType_DNS,
	"rooter":         keybase1.ProofType_ROOTER,
	"generic_social": keybase1.ProofType_GENERIC_SOCIAL,
}

// TODO Remove with CORE-8969
var RemoteServiceOrder = []keybase1.ProofType{
	keybase1.ProofType_KEYBASE,
	keybase1.ProofType_TWITTER,
	keybase1.ProofType_FACEBOOK,
	keybase1.ProofType_GITHUB,
	keybase1.ProofType_REDDIT,
	keybase1.ProofType_COINBASE,
	keybase1.ProofType_HACKERNEWS,
	keybase1.ProofType_GENERIC_WEB_SITE,
	keybase1.ProofType_GENERIC_SOCIAL,
	keybase1.ProofType_ROOTER,
}

const CanonicalHost = "keybase.io"

const (
	HTTPDefaultTimeout        = 60 * time.Second
	HTTPDefaultScraperTimeout = 10 * time.Second
	HTTPPollMaximum           = 5 * time.Second
	HTTPFastTimeout           = 5 * time.Second
)

// The following constants apply to APIArg parameters for
// critical idempotent API calls
const (
	HTTPRetryInitialTimeout = 1 * time.Second
	HTTPRetryMutliplier     = 1.5
	HTTPRetryCount          = 6
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
	Kex2PhraseEntropy  = 88
	Kex2PhraseEntropy2 = 99 // we've upped the entropy to 99 bits after the 2018 NCC Audit
	Kex2ScryptCost     = 1 << 17
	Kex2ScryptLiteCost = 1 << 10
	Kex2ScryptR        = 8
	Kex2ScryptP        = 1
	Kex2ScryptKeylen   = 32
)

// PaperKeyWordCountMin of 13 is based on the current state:
// entropy: 143 (PaperKeySecretEntropy [117] + PaperKeyIDBits [22] + PaperKeyVersionBits [4])
// len(secwords): 2048
const (
	PaperKeyScryptCost    = 32768
	PaperKeyScryptR       = 8
	PaperKeyScryptP       = 1
	PaperKeyScryptKeylen  = 128
	PaperKeySecretEntropy = 117
	PaperKeyIDBits        = 22
	PaperKeyVersionBits   = 4
	PaperKeyVersion       = 0
	PaperKeyWordCountMin  = 13 // this should never change to a value greater than 13
)

const UserSummaryLimit = 500 // max number of user summaries in one request

const MinPassphraseLength = 8

const TrackingRateLimitSeconds = 50

type KexRole int

const (
	KexRoleProvisioner KexRole = iota
	KexRoleProvisionee
)

const (
	IdentifySourceKBFS = "kbfs"
	TestInvitationCode = "202020202020202020202020"
)

const (
	SecretPromptCancelDuration = 5 * time.Minute
)

const (
	ServiceLogFileName = "keybase.service.log"
	KBFSLogFileName    = kbconst.KBFSLogFileName
	GitLogFileName     = "keybase.git.log"
	UpdaterLogFileName = "keybase.updater.log"
	DesktopLogFileName = "Keybase.app.log"
	// StartLogFileName is where services can log to (on startup) before they handle their own logging
	StartLogFileName = "keybase.start.log"
)

const (
	PGPAssertionKey = "pgp"
)

const (
	NotificationDismissPGPPrefix = "pgp_secret_store"
	NotificationDismissPGPValue  = "dismissed"
)

const (
	EncryptionReasonChatLocalStorage       EncryptionReason = "Keybase-Chat-Local-Storage-1"
	EncryptionReasonChatMessage            EncryptionReason = "Keybase-Chat-Message-1"
	EncryptionReasonTeamsLocalStorage      EncryptionReason = "Keybase-Teams-Local-Storage-1"
	EncryptionReasonTeamsFTLLocalStorage   EncryptionReason = "Keybase-Teams-FTL-Local-Storage-1"
	EncryptionReasonErasableKVLocalStorage EncryptionReason = "Keybase-Erasable-KV-Local-Storage-1"
)

type DeriveReason string

const (
	DeriveReasonPUKSigning    DeriveReason = "Derived-User-NaCl-EdDSA-1"
	DeriveReasonPUKEncryption DeriveReason = "Derived-User-NaCl-DH-1"
	// Context used for chaining generations of PerUserKeys.
	DeriveReasonPUKPrev              DeriveReason = "Derived-User-NaCl-SecretBox-1"
	DeriveReasonPUKStellarBundle     DeriveReason = "Derived-User-NaCl-SecretBox-StellarBundle-1"
	DeriveReasonPUKStellarNoteSelf   DeriveReason = "Derived-User-NaCl-SecretBox-StellarSelfNote-1"
	DeriveReasonPUKStellarAcctBundle DeriveReason = "Derived-User-NaCl-SecretBox-StellarAcctBundle-1"

	DeriveReasonDeviceEKEncryption  DeriveReason = "Derived-Ephemeral-Device-NaCl-DH-1"
	DeriveReasonUserEKEncryption    DeriveReason = "Derived-Ephemeral-User-NaCl-DH-1"
	DeriveReasonTeamEKEncryption    DeriveReason = "Derived-Ephemeral-Team-NaCl-DH-1"
	DeriveReasonTeamEKExplodingChat DeriveReason = "Derived-Ephemeral-Team-NaCl-SecretBox-ExplodingChat-1"

	DeriveReasonChatPairwiseMAC DeriveReason = "Derived-Chat-Pairwise-HMAC-SHA256-1"
)

// Not a DeriveReason because it is not used in the same way.
const DeriveReasonPUKStellarNoteShared string = "Keybase-Derived-Stellar-Note-PUK-Sbox-NaCl-DH-1"

// FirstPRodMerkleSeqnoWithSkips is the first merkle root on production that
// has skip pointers indicating log(n) previous merkle roots.
var FirstProdMerkleSeqnoWithSkips = keybase1.Seqno(835903)

// We didn't have valid signatures before 796, so don't try to load them.
var FirstProdMerkleSeqnoWithSigs = keybase1.Seqno(796)

// Before this merkle seqno, we had the other, more bushy shape. From this point
// on, we have the modern shape. It's possible to tweak our clients to handle both
// shapes, but it's not really worth it at this time.
var FirstProdMerkleTreeWithModernShape = keybase1.Seqno(531408)

type AppType string

const (
	MobileAppType  AppType = "mobile"
	DesktopAppType AppType = "desktop"
	NoAppType      AppType = ""
)

func StringToAppType(s string) AppType {
	switch s {
	case string(MobileAppType):
		return MobileAppType
	case string(DesktopAppType):
		return DesktopAppType
	default:
		return NoAppType
	}
}

// UID of t_alice
const TAliceUID = keybase1.UID("295a7eea607af32040647123732bc819")

const SharedTeamKeyBoxVersion1 = 1

const (
	TeamDHDerivationString               = "Keybase-Derived-Team-NaCl-DH-1"
	TeamEdDSADerivationString            = "Keybase-Derived-Team-NaCl-EdDSA-1"
	TeamKBFSDerivationString             = "Keybase-Derived-Team-NaCl-KBFS-1"
	TeamChatDerivationString             = "Keybase-Derived-Team-NaCl-Chat-1"
	TeamSaltpackDerivationString         = "Keybase-Derived-Team-NaCl-Saltpack-1"
	TeamPrevKeySecretBoxDerivationString = "Keybase-Derived-Team-NaCl-SecretBox-1"
	TeamGitMetadataDerivationString      = "Keybase-Derived-Team-NaCl-GitMetadata-1"
	TeamSeitanTokenDerivationString      = "Keybase-Derived-Team-NaCl-SeitanInviteToken-1"
	TeamStellarRelayDerivationString     = "Keybase-Derived-Team-NaCl-StellarRelay-1"
)

func CurrentSaltpackVersion() saltpack.Version {
	return saltpack.Version2()
}

const (
	InviteIDTag = 0x27
)

const CurrentGitMetadataEncryptionVersion = 1

// The secret_store_file and erasable_kv_store use a random noise file of this
// size when encrypting secrets for disk.
const noiseFileLen = 1024 * 1024 * 2

// NOTE if you change these values you should change them in
// go/chatbase/storage/ephemeral.go as well.
const MaxEphemeralContentLifetime = time.Hour * 24 * 7
const MinEphemeralContentLifetime = time.Second * 30

// NOTE: If you change this value you should change it in lib/constants.iced
// and go/ekreaperd/reaper.go as well.
// Devices are considered stale and not included in new keys after this interval
const MaxEphemeralKeyStaleness = time.Hour * 24 * 30 * 3 // three months
// Everyday we want to generate a new key if possible
const EphemeralKeyGenInterval = time.Hour * 24 // one day
// Our keys must last at least this long.
const MinEphemeralKeyLifetime = MaxEphemeralContentLifetime + EphemeralKeyGenInterval

const MaxTeamMembersForPairwiseMAC = 100

const MaxStellarPaymentNoteLength = 500
const MaxStellarPaymentBoxedNoteLength = 1000
