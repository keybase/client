// Package xdr is generated from:
//
//  xdr/Stellar-types.x
//  xdr/Stellar-ledger-entries.x
//  xdr/Stellar-transaction.x
//  xdr/Stellar-ledger.x
//  xdr/Stellar-overlay.x
//  xdr/Stellar-SCP.x
//
// DO NOT EDIT or your changes may be overwritten
package xdr

import (
	"fmt"
	"io"

	"github.com/nullstyle/go-xdr/xdr3"
)

// Unmarshal reads an xdr element from `r` into `v`.
func Unmarshal(r io.Reader, v interface{}) (int, error) {
	// delegate to xdr package's Unmarshal
	return xdr.Unmarshal(r, v)
}

// Marshal writes an xdr element `v` into `w`.
func Marshal(w io.Writer, v interface{}) (int, error) {
	// delegate to xdr package's Marshal
	return xdr.Marshal(w, v)
}

// Hash is an XDR Typedef defines as:
//
//   typedef opaque Hash[32];
//
type Hash [32]byte

// XDRMaxSize implements the Sized interface for Hash
func (e Hash) XDRMaxSize() int {
	return 32
}

// Uint256 is an XDR Typedef defines as:
//
//   typedef opaque uint256[32];
//
type Uint256 [32]byte

// XDRMaxSize implements the Sized interface for Uint256
func (e Uint256) XDRMaxSize() int {
	return 32
}

// Uint32 is an XDR Typedef defines as:
//
//   typedef unsigned int uint32;
//
type Uint32 uint32

// Int32 is an XDR Typedef defines as:
//
//   typedef int int32;
//
type Int32 int32

// Uint64 is an XDR Typedef defines as:
//
//   typedef unsigned hyper uint64;
//
type Uint64 uint64

// Int64 is an XDR Typedef defines as:
//
//   typedef hyper int64;
//
type Int64 int64

// CryptoKeyType is an XDR Enum defines as:
//
//   enum CryptoKeyType
//    {
//        KEY_TYPE_ED25519 = 0,
//        KEY_TYPE_HASH_TX = 1,
//        KEY_TYPE_HASH_X = 2
//    };
//
type CryptoKeyType int32

const (
	CryptoKeyTypeKeyTypeEd25519 CryptoKeyType = 0
	CryptoKeyTypeKeyTypeHashTx  CryptoKeyType = 1
	CryptoKeyTypeKeyTypeHashX   CryptoKeyType = 2
)

var cryptoKeyTypeMap = map[int32]string{
	0: "CryptoKeyTypeKeyTypeEd25519",
	1: "CryptoKeyTypeKeyTypeHashTx",
	2: "CryptoKeyTypeKeyTypeHashX",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for CryptoKeyType
func (e CryptoKeyType) ValidEnum(v int32) bool {
	_, ok := cryptoKeyTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e CryptoKeyType) String() string {
	name, _ := cryptoKeyTypeMap[int32(e)]
	return name
}

// PublicKeyType is an XDR Enum defines as:
//
//   enum PublicKeyType
//    {
//        PUBLIC_KEY_TYPE_ED25519 = KEY_TYPE_ED25519
//    };
//
type PublicKeyType int32

const (
	PublicKeyTypePublicKeyTypeEd25519 PublicKeyType = 0
)

var publicKeyTypeMap = map[int32]string{
	0: "PublicKeyTypePublicKeyTypeEd25519",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for PublicKeyType
func (e PublicKeyType) ValidEnum(v int32) bool {
	_, ok := publicKeyTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e PublicKeyType) String() string {
	name, _ := publicKeyTypeMap[int32(e)]
	return name
}

// SignerKeyType is an XDR Enum defines as:
//
//   enum SignerKeyType
//    {
//        SIGNER_KEY_TYPE_ED25519 = KEY_TYPE_ED25519,
//        SIGNER_KEY_TYPE_HASH_TX = KEY_TYPE_HASH_TX,
//        SIGNER_KEY_TYPE_HASH_X = KEY_TYPE_HASH_X
//    };
//
type SignerKeyType int32

const (
	SignerKeyTypeSignerKeyTypeEd25519 SignerKeyType = 0
	SignerKeyTypeSignerKeyTypeHashTx  SignerKeyType = 1
	SignerKeyTypeSignerKeyTypeHashX   SignerKeyType = 2
)

var signerKeyTypeMap = map[int32]string{
	0: "SignerKeyTypeSignerKeyTypeEd25519",
	1: "SignerKeyTypeSignerKeyTypeHashTx",
	2: "SignerKeyTypeSignerKeyTypeHashX",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for SignerKeyType
func (e SignerKeyType) ValidEnum(v int32) bool {
	_, ok := signerKeyTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e SignerKeyType) String() string {
	name, _ := signerKeyTypeMap[int32(e)]
	return name
}

// PublicKey is an XDR Union defines as:
//
//   union PublicKey switch (PublicKeyType type)
//    {
//    case PUBLIC_KEY_TYPE_ED25519:
//        uint256 ed25519;
//    };
//
type PublicKey struct {
	Type    PublicKeyType
	Ed25519 *Uint256
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u PublicKey) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of PublicKey
func (u PublicKey) ArmForSwitch(sw int32) (string, bool) {
	switch PublicKeyType(sw) {
	case PublicKeyTypePublicKeyTypeEd25519:
		return "Ed25519", true
	}
	return "-", false
}

// NewPublicKey creates a new  PublicKey.
func NewPublicKey(aType PublicKeyType, value interface{}) (result PublicKey, err error) {
	result.Type = aType
	switch PublicKeyType(aType) {
	case PublicKeyTypePublicKeyTypeEd25519:
		tv, ok := value.(Uint256)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint256")
			return
		}
		result.Ed25519 = &tv
	}
	return
}

// MustEd25519 retrieves the Ed25519 value from the union,
// panicing if the value is not set.
func (u PublicKey) MustEd25519() Uint256 {
	val, ok := u.GetEd25519()

	if !ok {
		panic("arm Ed25519 is not set")
	}

	return val
}

// GetEd25519 retrieves the Ed25519 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u PublicKey) GetEd25519() (result Uint256, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Ed25519" {
		result = *u.Ed25519
		ok = true
	}

	return
}

// SignerKey is an XDR Union defines as:
//
//   union SignerKey switch (SignerKeyType type)
//    {
//    case SIGNER_KEY_TYPE_ED25519:
//        uint256 ed25519;
//    case SIGNER_KEY_TYPE_HASH_TX:
//        /* Hash of Transaction structure */
//        uint256 hashTx;
//    case SIGNER_KEY_TYPE_HASH_X:
//        /* Hash of random 256 bit preimage X */
//        uint256 hashX;
//    };
//
type SignerKey struct {
	Type    SignerKeyType
	Ed25519 *Uint256
	HashTx  *Uint256
	HashX   *Uint256
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u SignerKey) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of SignerKey
func (u SignerKey) ArmForSwitch(sw int32) (string, bool) {
	switch SignerKeyType(sw) {
	case SignerKeyTypeSignerKeyTypeEd25519:
		return "Ed25519", true
	case SignerKeyTypeSignerKeyTypeHashTx:
		return "HashTx", true
	case SignerKeyTypeSignerKeyTypeHashX:
		return "HashX", true
	}
	return "-", false
}

// NewSignerKey creates a new  SignerKey.
func NewSignerKey(aType SignerKeyType, value interface{}) (result SignerKey, err error) {
	result.Type = aType
	switch SignerKeyType(aType) {
	case SignerKeyTypeSignerKeyTypeEd25519:
		tv, ok := value.(Uint256)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint256")
			return
		}
		result.Ed25519 = &tv
	case SignerKeyTypeSignerKeyTypeHashTx:
		tv, ok := value.(Uint256)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint256")
			return
		}
		result.HashTx = &tv
	case SignerKeyTypeSignerKeyTypeHashX:
		tv, ok := value.(Uint256)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint256")
			return
		}
		result.HashX = &tv
	}
	return
}

// MustEd25519 retrieves the Ed25519 value from the union,
// panicing if the value is not set.
func (u SignerKey) MustEd25519() Uint256 {
	val, ok := u.GetEd25519()

	if !ok {
		panic("arm Ed25519 is not set")
	}

	return val
}

// GetEd25519 retrieves the Ed25519 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u SignerKey) GetEd25519() (result Uint256, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Ed25519" {
		result = *u.Ed25519
		ok = true
	}

	return
}

// MustHashTx retrieves the HashTx value from the union,
// panicing if the value is not set.
func (u SignerKey) MustHashTx() Uint256 {
	val, ok := u.GetHashTx()

	if !ok {
		panic("arm HashTx is not set")
	}

	return val
}

// GetHashTx retrieves the HashTx value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u SignerKey) GetHashTx() (result Uint256, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "HashTx" {
		result = *u.HashTx
		ok = true
	}

	return
}

// MustHashX retrieves the HashX value from the union,
// panicing if the value is not set.
func (u SignerKey) MustHashX() Uint256 {
	val, ok := u.GetHashX()

	if !ok {
		panic("arm HashX is not set")
	}

	return val
}

// GetHashX retrieves the HashX value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u SignerKey) GetHashX() (result Uint256, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "HashX" {
		result = *u.HashX
		ok = true
	}

	return
}

// Signature is an XDR Typedef defines as:
//
//   typedef opaque Signature<64>;
//
type Signature []byte

// XDRMaxSize implements the Sized interface for Signature
func (e Signature) XDRMaxSize() int {
	return 64
}

// SignatureHint is an XDR Typedef defines as:
//
//   typedef opaque SignatureHint[4];
//
type SignatureHint [4]byte

// XDRMaxSize implements the Sized interface for SignatureHint
func (e SignatureHint) XDRMaxSize() int {
	return 4
}

// NodeId is an XDR Typedef defines as:
//
//   typedef PublicKey NodeID;
//
type NodeId PublicKey

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u NodeId) SwitchFieldName() string {
	return PublicKey(u).SwitchFieldName()
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of PublicKey
func (u NodeId) ArmForSwitch(sw int32) (string, bool) {
	return PublicKey(u).ArmForSwitch(sw)
}

// NewNodeId creates a new  NodeId.
func NewNodeId(aType PublicKeyType, value interface{}) (result NodeId, err error) {
	u, err := NewPublicKey(aType, value)
	result = NodeId(u)
	return
}

// MustEd25519 retrieves the Ed25519 value from the union,
// panicing if the value is not set.
func (u NodeId) MustEd25519() Uint256 {
	return PublicKey(u).MustEd25519()
}

// GetEd25519 retrieves the Ed25519 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u NodeId) GetEd25519() (result Uint256, ok bool) {
	return PublicKey(u).GetEd25519()
}

// Curve25519Secret is an XDR Struct defines as:
//
//   struct Curve25519Secret
//    {
//            opaque key[32];
//    };
//
type Curve25519Secret struct {
	Key [32]byte `xdrmaxsize:"32"`
}

// Curve25519Public is an XDR Struct defines as:
//
//   struct Curve25519Public
//    {
//            opaque key[32];
//    };
//
type Curve25519Public struct {
	Key [32]byte `xdrmaxsize:"32"`
}

// HmacSha256Key is an XDR Struct defines as:
//
//   struct HmacSha256Key
//    {
//            opaque key[32];
//    };
//
type HmacSha256Key struct {
	Key [32]byte `xdrmaxsize:"32"`
}

// HmacSha256Mac is an XDR Struct defines as:
//
//   struct HmacSha256Mac
//    {
//            opaque mac[32];
//    };
//
type HmacSha256Mac struct {
	Mac [32]byte `xdrmaxsize:"32"`
}

// AccountId is an XDR Typedef defines as:
//
//   typedef PublicKey AccountID;
//
type AccountId PublicKey

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u AccountId) SwitchFieldName() string {
	return PublicKey(u).SwitchFieldName()
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of PublicKey
func (u AccountId) ArmForSwitch(sw int32) (string, bool) {
	return PublicKey(u).ArmForSwitch(sw)
}

// NewAccountId creates a new  AccountId.
func NewAccountId(aType PublicKeyType, value interface{}) (result AccountId, err error) {
	u, err := NewPublicKey(aType, value)
	result = AccountId(u)
	return
}

// MustEd25519 retrieves the Ed25519 value from the union,
// panicing if the value is not set.
func (u AccountId) MustEd25519() Uint256 {
	return PublicKey(u).MustEd25519()
}

// GetEd25519 retrieves the Ed25519 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u AccountId) GetEd25519() (result Uint256, ok bool) {
	return PublicKey(u).GetEd25519()
}

// Thresholds is an XDR Typedef defines as:
//
//   typedef opaque Thresholds[4];
//
type Thresholds [4]byte

// XDRMaxSize implements the Sized interface for Thresholds
func (e Thresholds) XDRMaxSize() int {
	return 4
}

// String32 is an XDR Typedef defines as:
//
//   typedef string string32<32>;
//
type String32 string

// XDRMaxSize implements the Sized interface for String32
func (e String32) XDRMaxSize() int {
	return 32
}

// String64 is an XDR Typedef defines as:
//
//   typedef string string64<64>;
//
type String64 string

// XDRMaxSize implements the Sized interface for String64
func (e String64) XDRMaxSize() int {
	return 64
}

// SequenceNumber is an XDR Typedef defines as:
//
//   typedef uint64 SequenceNumber;
//
type SequenceNumber Uint64

// DataValue is an XDR Typedef defines as:
//
//   typedef opaque DataValue<64>;
//
type DataValue []byte

// XDRMaxSize implements the Sized interface for DataValue
func (e DataValue) XDRMaxSize() int {
	return 64
}

// AssetType is an XDR Enum defines as:
//
//   enum AssetType
//    {
//        ASSET_TYPE_NATIVE = 0,
//        ASSET_TYPE_CREDIT_ALPHANUM4 = 1,
//        ASSET_TYPE_CREDIT_ALPHANUM12 = 2
//    };
//
type AssetType int32

const (
	AssetTypeAssetTypeNative           AssetType = 0
	AssetTypeAssetTypeCreditAlphanum4  AssetType = 1
	AssetTypeAssetTypeCreditAlphanum12 AssetType = 2
)

var assetTypeMap = map[int32]string{
	0: "AssetTypeAssetTypeNative",
	1: "AssetTypeAssetTypeCreditAlphanum4",
	2: "AssetTypeAssetTypeCreditAlphanum12",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for AssetType
func (e AssetType) ValidEnum(v int32) bool {
	_, ok := assetTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e AssetType) String() string {
	name, _ := assetTypeMap[int32(e)]
	return name
}

// AssetAlphaNum4 is an XDR NestedStruct defines as:
//
//   struct
//        {
//            opaque assetCode[4]; // 1 to 4 characters
//            AccountID issuer;
//        }
//
type AssetAlphaNum4 struct {
	AssetCode [4]byte `xdrmaxsize:"4"`
	Issuer    AccountId
}

// AssetAlphaNum12 is an XDR NestedStruct defines as:
//
//   struct
//        {
//            opaque assetCode[12]; // 5 to 12 characters
//            AccountID issuer;
//        }
//
type AssetAlphaNum12 struct {
	AssetCode [12]byte `xdrmaxsize:"12"`
	Issuer    AccountId
}

// Asset is an XDR Union defines as:
//
//   union Asset switch (AssetType type)
//    {
//    case ASSET_TYPE_NATIVE: // Not credit
//        void;
//
//    case ASSET_TYPE_CREDIT_ALPHANUM4:
//        struct
//        {
//            opaque assetCode[4]; // 1 to 4 characters
//            AccountID issuer;
//        } alphaNum4;
//
//    case ASSET_TYPE_CREDIT_ALPHANUM12:
//        struct
//        {
//            opaque assetCode[12]; // 5 to 12 characters
//            AccountID issuer;
//        } alphaNum12;
//
//        // add other asset types here in the future
//    };
//
type Asset struct {
	Type       AssetType
	AlphaNum4  *AssetAlphaNum4
	AlphaNum12 *AssetAlphaNum12
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u Asset) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of Asset
func (u Asset) ArmForSwitch(sw int32) (string, bool) {
	switch AssetType(sw) {
	case AssetTypeAssetTypeNative:
		return "", true
	case AssetTypeAssetTypeCreditAlphanum4:
		return "AlphaNum4", true
	case AssetTypeAssetTypeCreditAlphanum12:
		return "AlphaNum12", true
	}
	return "-", false
}

// NewAsset creates a new  Asset.
func NewAsset(aType AssetType, value interface{}) (result Asset, err error) {
	result.Type = aType
	switch AssetType(aType) {
	case AssetTypeAssetTypeNative:
		// void
	case AssetTypeAssetTypeCreditAlphanum4:
		tv, ok := value.(AssetAlphaNum4)
		if !ok {
			err = fmt.Errorf("invalid value, must be AssetAlphaNum4")
			return
		}
		result.AlphaNum4 = &tv
	case AssetTypeAssetTypeCreditAlphanum12:
		tv, ok := value.(AssetAlphaNum12)
		if !ok {
			err = fmt.Errorf("invalid value, must be AssetAlphaNum12")
			return
		}
		result.AlphaNum12 = &tv
	}
	return
}

// MustAlphaNum4 retrieves the AlphaNum4 value from the union,
// panicing if the value is not set.
func (u Asset) MustAlphaNum4() AssetAlphaNum4 {
	val, ok := u.GetAlphaNum4()

	if !ok {
		panic("arm AlphaNum4 is not set")
	}

	return val
}

// GetAlphaNum4 retrieves the AlphaNum4 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u Asset) GetAlphaNum4() (result AssetAlphaNum4, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "AlphaNum4" {
		result = *u.AlphaNum4
		ok = true
	}

	return
}

// MustAlphaNum12 retrieves the AlphaNum12 value from the union,
// panicing if the value is not set.
func (u Asset) MustAlphaNum12() AssetAlphaNum12 {
	val, ok := u.GetAlphaNum12()

	if !ok {
		panic("arm AlphaNum12 is not set")
	}

	return val
}

// GetAlphaNum12 retrieves the AlphaNum12 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u Asset) GetAlphaNum12() (result AssetAlphaNum12, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "AlphaNum12" {
		result = *u.AlphaNum12
		ok = true
	}

	return
}

// Price is an XDR Struct defines as:
//
//   struct Price
//    {
//        int32 n; // numerator
//        int32 d; // denominator
//    };
//
type Price struct {
	N Int32
	D Int32
}

// ThresholdIndexes is an XDR Enum defines as:
//
//   enum ThresholdIndexes
//    {
//        THRESHOLD_MASTER_WEIGHT = 0,
//        THRESHOLD_LOW = 1,
//        THRESHOLD_MED = 2,
//        THRESHOLD_HIGH = 3
//    };
//
type ThresholdIndexes int32

const (
	ThresholdIndexesThresholdMasterWeight ThresholdIndexes = 0
	ThresholdIndexesThresholdLow          ThresholdIndexes = 1
	ThresholdIndexesThresholdMed          ThresholdIndexes = 2
	ThresholdIndexesThresholdHigh         ThresholdIndexes = 3
)

var thresholdIndexesMap = map[int32]string{
	0: "ThresholdIndexesThresholdMasterWeight",
	1: "ThresholdIndexesThresholdLow",
	2: "ThresholdIndexesThresholdMed",
	3: "ThresholdIndexesThresholdHigh",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for ThresholdIndexes
func (e ThresholdIndexes) ValidEnum(v int32) bool {
	_, ok := thresholdIndexesMap[v]
	return ok
}

// String returns the name of `e`
func (e ThresholdIndexes) String() string {
	name, _ := thresholdIndexesMap[int32(e)]
	return name
}

// LedgerEntryType is an XDR Enum defines as:
//
//   enum LedgerEntryType
//    {
//        ACCOUNT = 0,
//        TRUSTLINE = 1,
//        OFFER = 2,
//        DATA = 3
//    };
//
type LedgerEntryType int32

const (
	LedgerEntryTypeAccount   LedgerEntryType = 0
	LedgerEntryTypeTrustline LedgerEntryType = 1
	LedgerEntryTypeOffer     LedgerEntryType = 2
	LedgerEntryTypeData      LedgerEntryType = 3
)

var ledgerEntryTypeMap = map[int32]string{
	0: "LedgerEntryTypeAccount",
	1: "LedgerEntryTypeTrustline",
	2: "LedgerEntryTypeOffer",
	3: "LedgerEntryTypeData",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for LedgerEntryType
func (e LedgerEntryType) ValidEnum(v int32) bool {
	_, ok := ledgerEntryTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e LedgerEntryType) String() string {
	name, _ := ledgerEntryTypeMap[int32(e)]
	return name
}

// Signer is an XDR Struct defines as:
//
//   struct Signer
//    {
//        SignerKey key;
//        uint32 weight; // really only need 1byte
//    };
//
type Signer struct {
	Key    SignerKey
	Weight Uint32
}

// AccountFlags is an XDR Enum defines as:
//
//   enum AccountFlags
//    { // masks for each flag
//
//        // Flags set on issuer accounts
//        // TrustLines are created with authorized set to "false" requiring
//        // the issuer to set it for each TrustLine
//        AUTH_REQUIRED_FLAG = 0x1,
//        // If set, the authorized flag in TrustLines can be cleared
//        // otherwise, authorization cannot be revoked
//        AUTH_REVOCABLE_FLAG = 0x2,
//        // Once set, causes all AUTH_* flags to be read-only
//        AUTH_IMMUTABLE_FLAG = 0x4
//    };
//
type AccountFlags int32

const (
	AccountFlagsAuthRequiredFlag  AccountFlags = 1
	AccountFlagsAuthRevocableFlag AccountFlags = 2
	AccountFlagsAuthImmutableFlag AccountFlags = 4
)

var accountFlagsMap = map[int32]string{
	1: "AccountFlagsAuthRequiredFlag",
	2: "AccountFlagsAuthRevocableFlag",
	4: "AccountFlagsAuthImmutableFlag",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for AccountFlags
func (e AccountFlags) ValidEnum(v int32) bool {
	_, ok := accountFlagsMap[v]
	return ok
}

// String returns the name of `e`
func (e AccountFlags) String() string {
	name, _ := accountFlagsMap[int32(e)]
	return name
}

// AccountEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type AccountEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u AccountEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of AccountEntryExt
func (u AccountEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewAccountEntryExt creates a new  AccountEntryExt.
func NewAccountEntryExt(v int32, value interface{}) (result AccountEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// AccountEntry is an XDR Struct defines as:
//
//   struct AccountEntry
//    {
//        AccountID accountID;      // master public key for this account
//        int64 balance;            // in stroops
//        SequenceNumber seqNum;    // last sequence number used for this account
//        uint32 numSubEntries;     // number of sub-entries this account has
//                                  // drives the reserve
//        AccountID* inflationDest; // Account to vote for during inflation
//        uint32 flags;             // see AccountFlags
//
//        string32 homeDomain; // can be used for reverse federation and memo lookup
//
//        // fields used for signatures
//        // thresholds stores unsigned bytes: [weight of master|low|medium|high]
//        Thresholds thresholds;
//
//        Signer signers<20>; // possible signers for this account
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type AccountEntry struct {
	AccountId     AccountId
	Balance       Int64
	SeqNum        SequenceNumber
	NumSubEntries Uint32
	InflationDest *AccountId
	Flags         Uint32
	HomeDomain    String32
	Thresholds    Thresholds
	Signers       []Signer `xdrmaxsize:"20"`
	Ext           AccountEntryExt
}

// TrustLineFlags is an XDR Enum defines as:
//
//   enum TrustLineFlags
//    {
//        // issuer has authorized account to perform transactions with its credit
//        AUTHORIZED_FLAG = 1
//    };
//
type TrustLineFlags int32

const (
	TrustLineFlagsAuthorizedFlag TrustLineFlags = 1
)

var trustLineFlagsMap = map[int32]string{
	1: "TrustLineFlagsAuthorizedFlag",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for TrustLineFlags
func (e TrustLineFlags) ValidEnum(v int32) bool {
	_, ok := trustLineFlagsMap[v]
	return ok
}

// String returns the name of `e`
func (e TrustLineFlags) String() string {
	name, _ := trustLineFlagsMap[int32(e)]
	return name
}

// TrustLineEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type TrustLineEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TrustLineEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TrustLineEntryExt
func (u TrustLineEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewTrustLineEntryExt creates a new  TrustLineEntryExt.
func NewTrustLineEntryExt(v int32, value interface{}) (result TrustLineEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// TrustLineEntry is an XDR Struct defines as:
//
//   struct TrustLineEntry
//    {
//        AccountID accountID; // account this trustline belongs to
//        Asset asset;         // type of asset (with issuer)
//        int64 balance;       // how much of this asset the user has.
//                             // Asset defines the unit for this;
//
//        int64 limit;  // balance cannot be above this
//        uint32 flags; // see TrustLineFlags
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type TrustLineEntry struct {
	AccountId AccountId
	Asset     Asset
	Balance   Int64
	Limit     Int64
	Flags     Uint32
	Ext       TrustLineEntryExt
}

// OfferEntryFlags is an XDR Enum defines as:
//
//   enum OfferEntryFlags
//    {
//        // issuer has authorized account to perform transactions with its credit
//        PASSIVE_FLAG = 1
//    };
//
type OfferEntryFlags int32

const (
	OfferEntryFlagsPassiveFlag OfferEntryFlags = 1
)

var offerEntryFlagsMap = map[int32]string{
	1: "OfferEntryFlagsPassiveFlag",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for OfferEntryFlags
func (e OfferEntryFlags) ValidEnum(v int32) bool {
	_, ok := offerEntryFlagsMap[v]
	return ok
}

// String returns the name of `e`
func (e OfferEntryFlags) String() string {
	name, _ := offerEntryFlagsMap[int32(e)]
	return name
}

// OfferEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type OfferEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u OfferEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of OfferEntryExt
func (u OfferEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewOfferEntryExt creates a new  OfferEntryExt.
func NewOfferEntryExt(v int32, value interface{}) (result OfferEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// OfferEntry is an XDR Struct defines as:
//
//   struct OfferEntry
//    {
//        AccountID sellerID;
//        uint64 offerID;
//        Asset selling; // A
//        Asset buying;  // B
//        int64 amount;  // amount of A
//
//        /* price for this offer:
//            price of A in terms of B
//            price=AmountB/AmountA=priceNumerator/priceDenominator
//            price is after fees
//        */
//        Price price;
//        uint32 flags; // see OfferEntryFlags
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type OfferEntry struct {
	SellerId AccountId
	OfferId  Uint64
	Selling  Asset
	Buying   Asset
	Amount   Int64
	Price    Price
	Flags    Uint32
	Ext      OfferEntryExt
}

// DataEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type DataEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u DataEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of DataEntryExt
func (u DataEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewDataEntryExt creates a new  DataEntryExt.
func NewDataEntryExt(v int32, value interface{}) (result DataEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// DataEntry is an XDR Struct defines as:
//
//   struct DataEntry
//    {
//        AccountID accountID; // account this data belongs to
//        string64 dataName;
//        DataValue dataValue;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type DataEntry struct {
	AccountId AccountId
	DataName  String64
	DataValue DataValue
	Ext       DataEntryExt
}

// LedgerEntryData is an XDR NestedUnion defines as:
//
//   union switch (LedgerEntryType type)
//        {
//        case ACCOUNT:
//            AccountEntry account;
//        case TRUSTLINE:
//            TrustLineEntry trustLine;
//        case OFFER:
//            OfferEntry offer;
//        case DATA:
//            DataEntry data;
//        }
//
type LedgerEntryData struct {
	Type      LedgerEntryType
	Account   *AccountEntry
	TrustLine *TrustLineEntry
	Offer     *OfferEntry
	Data      *DataEntry
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u LedgerEntryData) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of LedgerEntryData
func (u LedgerEntryData) ArmForSwitch(sw int32) (string, bool) {
	switch LedgerEntryType(sw) {
	case LedgerEntryTypeAccount:
		return "Account", true
	case LedgerEntryTypeTrustline:
		return "TrustLine", true
	case LedgerEntryTypeOffer:
		return "Offer", true
	case LedgerEntryTypeData:
		return "Data", true
	}
	return "-", false
}

// NewLedgerEntryData creates a new  LedgerEntryData.
func NewLedgerEntryData(aType LedgerEntryType, value interface{}) (result LedgerEntryData, err error) {
	result.Type = aType
	switch LedgerEntryType(aType) {
	case LedgerEntryTypeAccount:
		tv, ok := value.(AccountEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be AccountEntry")
			return
		}
		result.Account = &tv
	case LedgerEntryTypeTrustline:
		tv, ok := value.(TrustLineEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be TrustLineEntry")
			return
		}
		result.TrustLine = &tv
	case LedgerEntryTypeOffer:
		tv, ok := value.(OfferEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be OfferEntry")
			return
		}
		result.Offer = &tv
	case LedgerEntryTypeData:
		tv, ok := value.(DataEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be DataEntry")
			return
		}
		result.Data = &tv
	}
	return
}

// MustAccount retrieves the Account value from the union,
// panicing if the value is not set.
func (u LedgerEntryData) MustAccount() AccountEntry {
	val, ok := u.GetAccount()

	if !ok {
		panic("arm Account is not set")
	}

	return val
}

// GetAccount retrieves the Account value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryData) GetAccount() (result AccountEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Account" {
		result = *u.Account
		ok = true
	}

	return
}

// MustTrustLine retrieves the TrustLine value from the union,
// panicing if the value is not set.
func (u LedgerEntryData) MustTrustLine() TrustLineEntry {
	val, ok := u.GetTrustLine()

	if !ok {
		panic("arm TrustLine is not set")
	}

	return val
}

// GetTrustLine retrieves the TrustLine value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryData) GetTrustLine() (result TrustLineEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "TrustLine" {
		result = *u.TrustLine
		ok = true
	}

	return
}

// MustOffer retrieves the Offer value from the union,
// panicing if the value is not set.
func (u LedgerEntryData) MustOffer() OfferEntry {
	val, ok := u.GetOffer()

	if !ok {
		panic("arm Offer is not set")
	}

	return val
}

// GetOffer retrieves the Offer value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryData) GetOffer() (result OfferEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Offer" {
		result = *u.Offer
		ok = true
	}

	return
}

// MustData retrieves the Data value from the union,
// panicing if the value is not set.
func (u LedgerEntryData) MustData() DataEntry {
	val, ok := u.GetData()

	if !ok {
		panic("arm Data is not set")
	}

	return val
}

// GetData retrieves the Data value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryData) GetData() (result DataEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Data" {
		result = *u.Data
		ok = true
	}

	return
}

// LedgerEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type LedgerEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u LedgerEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of LedgerEntryExt
func (u LedgerEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewLedgerEntryExt creates a new  LedgerEntryExt.
func NewLedgerEntryExt(v int32, value interface{}) (result LedgerEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// LedgerEntry is an XDR Struct defines as:
//
//   struct LedgerEntry
//    {
//        uint32 lastModifiedLedgerSeq; // ledger the LedgerEntry was last changed
//
//        union switch (LedgerEntryType type)
//        {
//        case ACCOUNT:
//            AccountEntry account;
//        case TRUSTLINE:
//            TrustLineEntry trustLine;
//        case OFFER:
//            OfferEntry offer;
//        case DATA:
//            DataEntry data;
//        }
//        data;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type LedgerEntry struct {
	LastModifiedLedgerSeq Uint32
	Data                  LedgerEntryData
	Ext                   LedgerEntryExt
}

// EnvelopeType is an XDR Enum defines as:
//
//   enum EnvelopeType
//    {
//        ENVELOPE_TYPE_SCP = 1,
//        ENVELOPE_TYPE_TX = 2,
//        ENVELOPE_TYPE_AUTH = 3
//    };
//
type EnvelopeType int32

const (
	EnvelopeTypeEnvelopeTypeScp  EnvelopeType = 1
	EnvelopeTypeEnvelopeTypeTx   EnvelopeType = 2
	EnvelopeTypeEnvelopeTypeAuth EnvelopeType = 3
)

var envelopeTypeMap = map[int32]string{
	1: "EnvelopeTypeEnvelopeTypeScp",
	2: "EnvelopeTypeEnvelopeTypeTx",
	3: "EnvelopeTypeEnvelopeTypeAuth",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for EnvelopeType
func (e EnvelopeType) ValidEnum(v int32) bool {
	_, ok := envelopeTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e EnvelopeType) String() string {
	name, _ := envelopeTypeMap[int32(e)]
	return name
}

// DecoratedSignature is an XDR Struct defines as:
//
//   struct DecoratedSignature
//    {
//        SignatureHint hint;  // last 4 bytes of the public key, used as a hint
//        Signature signature; // actual signature
//    };
//
type DecoratedSignature struct {
	Hint      SignatureHint
	Signature Signature
}

// OperationType is an XDR Enum defines as:
//
//   enum OperationType
//    {
//        CREATE_ACCOUNT = 0,
//        PAYMENT = 1,
//        PATH_PAYMENT = 2,
//        MANAGE_OFFER = 3,
//        CREATE_PASSIVE_OFFER = 4,
//        SET_OPTIONS = 5,
//        CHANGE_TRUST = 6,
//        ALLOW_TRUST = 7,
//        ACCOUNT_MERGE = 8,
//        INFLATION = 9,
//        MANAGE_DATA = 10
//    };
//
type OperationType int32

const (
	OperationTypeCreateAccount      OperationType = 0
	OperationTypePayment            OperationType = 1
	OperationTypePathPayment        OperationType = 2
	OperationTypeManageOffer        OperationType = 3
	OperationTypeCreatePassiveOffer OperationType = 4
	OperationTypeSetOptions         OperationType = 5
	OperationTypeChangeTrust        OperationType = 6
	OperationTypeAllowTrust         OperationType = 7
	OperationTypeAccountMerge       OperationType = 8
	OperationTypeInflation          OperationType = 9
	OperationTypeManageData         OperationType = 10
)

var operationTypeMap = map[int32]string{
	0:  "OperationTypeCreateAccount",
	1:  "OperationTypePayment",
	2:  "OperationTypePathPayment",
	3:  "OperationTypeManageOffer",
	4:  "OperationTypeCreatePassiveOffer",
	5:  "OperationTypeSetOptions",
	6:  "OperationTypeChangeTrust",
	7:  "OperationTypeAllowTrust",
	8:  "OperationTypeAccountMerge",
	9:  "OperationTypeInflation",
	10: "OperationTypeManageData",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for OperationType
func (e OperationType) ValidEnum(v int32) bool {
	_, ok := operationTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e OperationType) String() string {
	name, _ := operationTypeMap[int32(e)]
	return name
}

// CreateAccountOp is an XDR Struct defines as:
//
//   struct CreateAccountOp
//    {
//        AccountID destination; // account to create
//        int64 startingBalance; // amount they end up with
//    };
//
type CreateAccountOp struct {
	Destination     AccountId
	StartingBalance Int64
}

// PaymentOp is an XDR Struct defines as:
//
//   struct PaymentOp
//    {
//        AccountID destination; // recipient of the payment
//        Asset asset;           // what they end up with
//        int64 amount;          // amount they end up with
//    };
//
type PaymentOp struct {
	Destination AccountId
	Asset       Asset
	Amount      Int64
}

// PathPaymentOp is an XDR Struct defines as:
//
//   struct PathPaymentOp
//    {
//        Asset sendAsset; // asset we pay with
//        int64 sendMax;   // the maximum amount of sendAsset to
//                         // send (excluding fees).
//                         // The operation will fail if can't be met
//
//        AccountID destination; // recipient of the payment
//        Asset destAsset;       // what they end up with
//        int64 destAmount;      // amount they end up with
//
//        Asset path<5>; // additional hops it must go through to get there
//    };
//
type PathPaymentOp struct {
	SendAsset   Asset
	SendMax     Int64
	Destination AccountId
	DestAsset   Asset
	DestAmount  Int64
	Path        []Asset `xdrmaxsize:"5"`
}

// ManageOfferOp is an XDR Struct defines as:
//
//   struct ManageOfferOp
//    {
//        Asset selling;
//        Asset buying;
//        int64 amount; // amount being sold. if set to 0, delete the offer
//        Price price;  // price of thing being sold in terms of what you are buying
//
//        // 0=create a new offer, otherwise edit an existing offer
//        uint64 offerID;
//    };
//
type ManageOfferOp struct {
	Selling Asset
	Buying  Asset
	Amount  Int64
	Price   Price
	OfferId Uint64
}

// CreatePassiveOfferOp is an XDR Struct defines as:
//
//   struct CreatePassiveOfferOp
//    {
//        Asset selling; // A
//        Asset buying;  // B
//        int64 amount;  // amount taker gets. if set to 0, delete the offer
//        Price price;   // cost of A in terms of B
//    };
//
type CreatePassiveOfferOp struct {
	Selling Asset
	Buying  Asset
	Amount  Int64
	Price   Price
}

// SetOptionsOp is an XDR Struct defines as:
//
//   struct SetOptionsOp
//    {
//        AccountID* inflationDest; // sets the inflation destination
//
//        uint32* clearFlags; // which flags to clear
//        uint32* setFlags;   // which flags to set
//
//        // account threshold manipulation
//        uint32* masterWeight; // weight of the master account
//        uint32* lowThreshold;
//        uint32* medThreshold;
//        uint32* highThreshold;
//
//        string32* homeDomain; // sets the home domain
//
//        // Add, update or remove a signer for the account
//        // signer is deleted if the weight is 0
//        Signer* signer;
//    };
//
type SetOptionsOp struct {
	InflationDest *AccountId
	ClearFlags    *Uint32
	SetFlags      *Uint32
	MasterWeight  *Uint32
	LowThreshold  *Uint32
	MedThreshold  *Uint32
	HighThreshold *Uint32
	HomeDomain    *String32
	Signer        *Signer
}

// ChangeTrustOp is an XDR Struct defines as:
//
//   struct ChangeTrustOp
//    {
//        Asset line;
//
//        // if limit is set to 0, deletes the trust line
//        int64 limit;
//    };
//
type ChangeTrustOp struct {
	Line  Asset
	Limit Int64
}

// AllowTrustOpAsset is an XDR NestedUnion defines as:
//
//   union switch (AssetType type)
//        {
//        // ASSET_TYPE_NATIVE is not allowed
//        case ASSET_TYPE_CREDIT_ALPHANUM4:
//            opaque assetCode4[4];
//
//        case ASSET_TYPE_CREDIT_ALPHANUM12:
//            opaque assetCode12[12];
//
//            // add other asset types here in the future
//        }
//
type AllowTrustOpAsset struct {
	Type        AssetType
	AssetCode4  *[4]byte  `xdrmaxsize:"4"`
	AssetCode12 *[12]byte `xdrmaxsize:"12"`
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u AllowTrustOpAsset) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of AllowTrustOpAsset
func (u AllowTrustOpAsset) ArmForSwitch(sw int32) (string, bool) {
	switch AssetType(sw) {
	case AssetTypeAssetTypeCreditAlphanum4:
		return "AssetCode4", true
	case AssetTypeAssetTypeCreditAlphanum12:
		return "AssetCode12", true
	}
	return "-", false
}

// NewAllowTrustOpAsset creates a new  AllowTrustOpAsset.
func NewAllowTrustOpAsset(aType AssetType, value interface{}) (result AllowTrustOpAsset, err error) {
	result.Type = aType
	switch AssetType(aType) {
	case AssetTypeAssetTypeCreditAlphanum4:
		tv, ok := value.([4]byte)
		if !ok {
			err = fmt.Errorf("invalid value, must be [4]byte")
			return
		}
		result.AssetCode4 = &tv
	case AssetTypeAssetTypeCreditAlphanum12:
		tv, ok := value.([12]byte)
		if !ok {
			err = fmt.Errorf("invalid value, must be [12]byte")
			return
		}
		result.AssetCode12 = &tv
	}
	return
}

// MustAssetCode4 retrieves the AssetCode4 value from the union,
// panicing if the value is not set.
func (u AllowTrustOpAsset) MustAssetCode4() [4]byte {
	val, ok := u.GetAssetCode4()

	if !ok {
		panic("arm AssetCode4 is not set")
	}

	return val
}

// GetAssetCode4 retrieves the AssetCode4 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u AllowTrustOpAsset) GetAssetCode4() (result [4]byte, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "AssetCode4" {
		result = *u.AssetCode4
		ok = true
	}

	return
}

// MustAssetCode12 retrieves the AssetCode12 value from the union,
// panicing if the value is not set.
func (u AllowTrustOpAsset) MustAssetCode12() [12]byte {
	val, ok := u.GetAssetCode12()

	if !ok {
		panic("arm AssetCode12 is not set")
	}

	return val
}

// GetAssetCode12 retrieves the AssetCode12 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u AllowTrustOpAsset) GetAssetCode12() (result [12]byte, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "AssetCode12" {
		result = *u.AssetCode12
		ok = true
	}

	return
}

// AllowTrustOp is an XDR Struct defines as:
//
//   struct AllowTrustOp
//    {
//        AccountID trustor;
//        union switch (AssetType type)
//        {
//        // ASSET_TYPE_NATIVE is not allowed
//        case ASSET_TYPE_CREDIT_ALPHANUM4:
//            opaque assetCode4[4];
//
//        case ASSET_TYPE_CREDIT_ALPHANUM12:
//            opaque assetCode12[12];
//
//            // add other asset types here in the future
//        }
//        asset;
//
//        bool authorize;
//    };
//
type AllowTrustOp struct {
	Trustor   AccountId
	Asset     AllowTrustOpAsset
	Authorize bool
}

// ManageDataOp is an XDR Struct defines as:
//
//   struct ManageDataOp
//    {
//        string64 dataName;
//        DataValue* dataValue;   // set to null to clear
//    };
//
type ManageDataOp struct {
	DataName  String64
	DataValue *DataValue
}

// OperationBody is an XDR NestedUnion defines as:
//
//   union switch (OperationType type)
//        {
//        case CREATE_ACCOUNT:
//            CreateAccountOp createAccountOp;
//        case PAYMENT:
//            PaymentOp paymentOp;
//        case PATH_PAYMENT:
//            PathPaymentOp pathPaymentOp;
//        case MANAGE_OFFER:
//            ManageOfferOp manageOfferOp;
//        case CREATE_PASSIVE_OFFER:
//            CreatePassiveOfferOp createPassiveOfferOp;
//        case SET_OPTIONS:
//            SetOptionsOp setOptionsOp;
//        case CHANGE_TRUST:
//            ChangeTrustOp changeTrustOp;
//        case ALLOW_TRUST:
//            AllowTrustOp allowTrustOp;
//        case ACCOUNT_MERGE:
//            AccountID destination;
//        case INFLATION:
//            void;
//        case MANAGE_DATA:
//            ManageDataOp manageDataOp;
//        }
//
type OperationBody struct {
	Type                 OperationType
	CreateAccountOp      *CreateAccountOp
	PaymentOp            *PaymentOp
	PathPaymentOp        *PathPaymentOp
	ManageOfferOp        *ManageOfferOp
	CreatePassiveOfferOp *CreatePassiveOfferOp
	SetOptionsOp         *SetOptionsOp
	ChangeTrustOp        *ChangeTrustOp
	AllowTrustOp         *AllowTrustOp
	Destination          *AccountId
	ManageDataOp         *ManageDataOp
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u OperationBody) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of OperationBody
func (u OperationBody) ArmForSwitch(sw int32) (string, bool) {
	switch OperationType(sw) {
	case OperationTypeCreateAccount:
		return "CreateAccountOp", true
	case OperationTypePayment:
		return "PaymentOp", true
	case OperationTypePathPayment:
		return "PathPaymentOp", true
	case OperationTypeManageOffer:
		return "ManageOfferOp", true
	case OperationTypeCreatePassiveOffer:
		return "CreatePassiveOfferOp", true
	case OperationTypeSetOptions:
		return "SetOptionsOp", true
	case OperationTypeChangeTrust:
		return "ChangeTrustOp", true
	case OperationTypeAllowTrust:
		return "AllowTrustOp", true
	case OperationTypeAccountMerge:
		return "Destination", true
	case OperationTypeInflation:
		return "", true
	case OperationTypeManageData:
		return "ManageDataOp", true
	}
	return "-", false
}

// NewOperationBody creates a new  OperationBody.
func NewOperationBody(aType OperationType, value interface{}) (result OperationBody, err error) {
	result.Type = aType
	switch OperationType(aType) {
	case OperationTypeCreateAccount:
		tv, ok := value.(CreateAccountOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be CreateAccountOp")
			return
		}
		result.CreateAccountOp = &tv
	case OperationTypePayment:
		tv, ok := value.(PaymentOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be PaymentOp")
			return
		}
		result.PaymentOp = &tv
	case OperationTypePathPayment:
		tv, ok := value.(PathPaymentOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be PathPaymentOp")
			return
		}
		result.PathPaymentOp = &tv
	case OperationTypeManageOffer:
		tv, ok := value.(ManageOfferOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be ManageOfferOp")
			return
		}
		result.ManageOfferOp = &tv
	case OperationTypeCreatePassiveOffer:
		tv, ok := value.(CreatePassiveOfferOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be CreatePassiveOfferOp")
			return
		}
		result.CreatePassiveOfferOp = &tv
	case OperationTypeSetOptions:
		tv, ok := value.(SetOptionsOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be SetOptionsOp")
			return
		}
		result.SetOptionsOp = &tv
	case OperationTypeChangeTrust:
		tv, ok := value.(ChangeTrustOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be ChangeTrustOp")
			return
		}
		result.ChangeTrustOp = &tv
	case OperationTypeAllowTrust:
		tv, ok := value.(AllowTrustOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be AllowTrustOp")
			return
		}
		result.AllowTrustOp = &tv
	case OperationTypeAccountMerge:
		tv, ok := value.(AccountId)
		if !ok {
			err = fmt.Errorf("invalid value, must be AccountId")
			return
		}
		result.Destination = &tv
	case OperationTypeInflation:
		// void
	case OperationTypeManageData:
		tv, ok := value.(ManageDataOp)
		if !ok {
			err = fmt.Errorf("invalid value, must be ManageDataOp")
			return
		}
		result.ManageDataOp = &tv
	}
	return
}

// MustCreateAccountOp retrieves the CreateAccountOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustCreateAccountOp() CreateAccountOp {
	val, ok := u.GetCreateAccountOp()

	if !ok {
		panic("arm CreateAccountOp is not set")
	}

	return val
}

// GetCreateAccountOp retrieves the CreateAccountOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetCreateAccountOp() (result CreateAccountOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "CreateAccountOp" {
		result = *u.CreateAccountOp
		ok = true
	}

	return
}

// MustPaymentOp retrieves the PaymentOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustPaymentOp() PaymentOp {
	val, ok := u.GetPaymentOp()

	if !ok {
		panic("arm PaymentOp is not set")
	}

	return val
}

// GetPaymentOp retrieves the PaymentOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetPaymentOp() (result PaymentOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "PaymentOp" {
		result = *u.PaymentOp
		ok = true
	}

	return
}

// MustPathPaymentOp retrieves the PathPaymentOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustPathPaymentOp() PathPaymentOp {
	val, ok := u.GetPathPaymentOp()

	if !ok {
		panic("arm PathPaymentOp is not set")
	}

	return val
}

// GetPathPaymentOp retrieves the PathPaymentOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetPathPaymentOp() (result PathPaymentOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "PathPaymentOp" {
		result = *u.PathPaymentOp
		ok = true
	}

	return
}

// MustManageOfferOp retrieves the ManageOfferOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustManageOfferOp() ManageOfferOp {
	val, ok := u.GetManageOfferOp()

	if !ok {
		panic("arm ManageOfferOp is not set")
	}

	return val
}

// GetManageOfferOp retrieves the ManageOfferOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetManageOfferOp() (result ManageOfferOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "ManageOfferOp" {
		result = *u.ManageOfferOp
		ok = true
	}

	return
}

// MustCreatePassiveOfferOp retrieves the CreatePassiveOfferOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustCreatePassiveOfferOp() CreatePassiveOfferOp {
	val, ok := u.GetCreatePassiveOfferOp()

	if !ok {
		panic("arm CreatePassiveOfferOp is not set")
	}

	return val
}

// GetCreatePassiveOfferOp retrieves the CreatePassiveOfferOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetCreatePassiveOfferOp() (result CreatePassiveOfferOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "CreatePassiveOfferOp" {
		result = *u.CreatePassiveOfferOp
		ok = true
	}

	return
}

// MustSetOptionsOp retrieves the SetOptionsOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustSetOptionsOp() SetOptionsOp {
	val, ok := u.GetSetOptionsOp()

	if !ok {
		panic("arm SetOptionsOp is not set")
	}

	return val
}

// GetSetOptionsOp retrieves the SetOptionsOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetSetOptionsOp() (result SetOptionsOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "SetOptionsOp" {
		result = *u.SetOptionsOp
		ok = true
	}

	return
}

// MustChangeTrustOp retrieves the ChangeTrustOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustChangeTrustOp() ChangeTrustOp {
	val, ok := u.GetChangeTrustOp()

	if !ok {
		panic("arm ChangeTrustOp is not set")
	}

	return val
}

// GetChangeTrustOp retrieves the ChangeTrustOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetChangeTrustOp() (result ChangeTrustOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "ChangeTrustOp" {
		result = *u.ChangeTrustOp
		ok = true
	}

	return
}

// MustAllowTrustOp retrieves the AllowTrustOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustAllowTrustOp() AllowTrustOp {
	val, ok := u.GetAllowTrustOp()

	if !ok {
		panic("arm AllowTrustOp is not set")
	}

	return val
}

// GetAllowTrustOp retrieves the AllowTrustOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetAllowTrustOp() (result AllowTrustOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "AllowTrustOp" {
		result = *u.AllowTrustOp
		ok = true
	}

	return
}

// MustDestination retrieves the Destination value from the union,
// panicing if the value is not set.
func (u OperationBody) MustDestination() AccountId {
	val, ok := u.GetDestination()

	if !ok {
		panic("arm Destination is not set")
	}

	return val
}

// GetDestination retrieves the Destination value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetDestination() (result AccountId, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Destination" {
		result = *u.Destination
		ok = true
	}

	return
}

// MustManageDataOp retrieves the ManageDataOp value from the union,
// panicing if the value is not set.
func (u OperationBody) MustManageDataOp() ManageDataOp {
	val, ok := u.GetManageDataOp()

	if !ok {
		panic("arm ManageDataOp is not set")
	}

	return val
}

// GetManageDataOp retrieves the ManageDataOp value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationBody) GetManageDataOp() (result ManageDataOp, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "ManageDataOp" {
		result = *u.ManageDataOp
		ok = true
	}

	return
}

// Operation is an XDR Struct defines as:
//
//   struct Operation
//    {
//        // sourceAccount is the account used to run the operation
//        // if not set, the runtime defaults to "sourceAccount" specified at
//        // the transaction level
//        AccountID* sourceAccount;
//
//        union switch (OperationType type)
//        {
//        case CREATE_ACCOUNT:
//            CreateAccountOp createAccountOp;
//        case PAYMENT:
//            PaymentOp paymentOp;
//        case PATH_PAYMENT:
//            PathPaymentOp pathPaymentOp;
//        case MANAGE_OFFER:
//            ManageOfferOp manageOfferOp;
//        case CREATE_PASSIVE_OFFER:
//            CreatePassiveOfferOp createPassiveOfferOp;
//        case SET_OPTIONS:
//            SetOptionsOp setOptionsOp;
//        case CHANGE_TRUST:
//            ChangeTrustOp changeTrustOp;
//        case ALLOW_TRUST:
//            AllowTrustOp allowTrustOp;
//        case ACCOUNT_MERGE:
//            AccountID destination;
//        case INFLATION:
//            void;
//        case MANAGE_DATA:
//            ManageDataOp manageDataOp;
//        }
//        body;
//    };
//
type Operation struct {
	SourceAccount *AccountId
	Body          OperationBody
}

// MemoType is an XDR Enum defines as:
//
//   enum MemoType
//    {
//        MEMO_NONE = 0,
//        MEMO_TEXT = 1,
//        MEMO_ID = 2,
//        MEMO_HASH = 3,
//        MEMO_RETURN = 4
//    };
//
type MemoType int32

const (
	MemoTypeMemoNone   MemoType = 0
	MemoTypeMemoText   MemoType = 1
	MemoTypeMemoId     MemoType = 2
	MemoTypeMemoHash   MemoType = 3
	MemoTypeMemoReturn MemoType = 4
)

var memoTypeMap = map[int32]string{
	0: "MemoTypeMemoNone",
	1: "MemoTypeMemoText",
	2: "MemoTypeMemoId",
	3: "MemoTypeMemoHash",
	4: "MemoTypeMemoReturn",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for MemoType
func (e MemoType) ValidEnum(v int32) bool {
	_, ok := memoTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e MemoType) String() string {
	name, _ := memoTypeMap[int32(e)]
	return name
}

// Memo is an XDR Union defines as:
//
//   union Memo switch (MemoType type)
//    {
//    case MEMO_NONE:
//        void;
//    case MEMO_TEXT:
//        string text<28>;
//    case MEMO_ID:
//        uint64 id;
//    case MEMO_HASH:
//        Hash hash; // the hash of what to pull from the content server
//    case MEMO_RETURN:
//        Hash retHash; // the hash of the tx you are rejecting
//    };
//
type Memo struct {
	Type    MemoType
	Text    *string `xdrmaxsize:"28"`
	Id      *Uint64
	Hash    *Hash
	RetHash *Hash
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u Memo) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of Memo
func (u Memo) ArmForSwitch(sw int32) (string, bool) {
	switch MemoType(sw) {
	case MemoTypeMemoNone:
		return "", true
	case MemoTypeMemoText:
		return "Text", true
	case MemoTypeMemoId:
		return "Id", true
	case MemoTypeMemoHash:
		return "Hash", true
	case MemoTypeMemoReturn:
		return "RetHash", true
	}
	return "-", false
}

// NewMemo creates a new  Memo.
func NewMemo(aType MemoType, value interface{}) (result Memo, err error) {
	result.Type = aType
	switch MemoType(aType) {
	case MemoTypeMemoNone:
		// void
	case MemoTypeMemoText:
		tv, ok := value.(string)
		if !ok {
			err = fmt.Errorf("invalid value, must be string")
			return
		}
		result.Text = &tv
	case MemoTypeMemoId:
		tv, ok := value.(Uint64)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint64")
			return
		}
		result.Id = &tv
	case MemoTypeMemoHash:
		tv, ok := value.(Hash)
		if !ok {
			err = fmt.Errorf("invalid value, must be Hash")
			return
		}
		result.Hash = &tv
	case MemoTypeMemoReturn:
		tv, ok := value.(Hash)
		if !ok {
			err = fmt.Errorf("invalid value, must be Hash")
			return
		}
		result.RetHash = &tv
	}
	return
}

// MustText retrieves the Text value from the union,
// panicing if the value is not set.
func (u Memo) MustText() string {
	val, ok := u.GetText()

	if !ok {
		panic("arm Text is not set")
	}

	return val
}

// GetText retrieves the Text value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u Memo) GetText() (result string, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Text" {
		result = *u.Text
		ok = true
	}

	return
}

// MustId retrieves the Id value from the union,
// panicing if the value is not set.
func (u Memo) MustId() Uint64 {
	val, ok := u.GetId()

	if !ok {
		panic("arm Id is not set")
	}

	return val
}

// GetId retrieves the Id value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u Memo) GetId() (result Uint64, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Id" {
		result = *u.Id
		ok = true
	}

	return
}

// MustHash retrieves the Hash value from the union,
// panicing if the value is not set.
func (u Memo) MustHash() Hash {
	val, ok := u.GetHash()

	if !ok {
		panic("arm Hash is not set")
	}

	return val
}

// GetHash retrieves the Hash value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u Memo) GetHash() (result Hash, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Hash" {
		result = *u.Hash
		ok = true
	}

	return
}

// MustRetHash retrieves the RetHash value from the union,
// panicing if the value is not set.
func (u Memo) MustRetHash() Hash {
	val, ok := u.GetRetHash()

	if !ok {
		panic("arm RetHash is not set")
	}

	return val
}

// GetRetHash retrieves the RetHash value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u Memo) GetRetHash() (result Hash, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "RetHash" {
		result = *u.RetHash
		ok = true
	}

	return
}

// TimeBounds is an XDR Struct defines as:
//
//   struct TimeBounds
//    {
//        uint64 minTime;
//        uint64 maxTime; // 0 here means no maxTime
//    };
//
type TimeBounds struct {
	MinTime Uint64
	MaxTime Uint64
}

// TransactionExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type TransactionExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TransactionExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TransactionExt
func (u TransactionExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewTransactionExt creates a new  TransactionExt.
func NewTransactionExt(v int32, value interface{}) (result TransactionExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// Transaction is an XDR Struct defines as:
//
//   struct Transaction
//    {
//        // account used to run the transaction
//        AccountID sourceAccount;
//
//        // the fee the sourceAccount will pay
//        uint32 fee;
//
//        // sequence number to consume in the account
//        SequenceNumber seqNum;
//
//        // validity range (inclusive) for the last ledger close time
//        TimeBounds* timeBounds;
//
//        Memo memo;
//
//        Operation operations<100>;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type Transaction struct {
	SourceAccount AccountId
	Fee           Uint32
	SeqNum        SequenceNumber
	TimeBounds    *TimeBounds
	Memo          Memo
	Operations    []Operation `xdrmaxsize:"100"`
	Ext           TransactionExt
}

// TransactionSignaturePayloadTaggedTransaction is an XDR NestedUnion defines as:
//
//   union switch (EnvelopeType type)
//        {
//        case ENVELOPE_TYPE_TX:
//              Transaction tx;
//        /* All other values of type are invalid */
//        }
//
type TransactionSignaturePayloadTaggedTransaction struct {
	Type EnvelopeType
	Tx   *Transaction
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TransactionSignaturePayloadTaggedTransaction) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TransactionSignaturePayloadTaggedTransaction
func (u TransactionSignaturePayloadTaggedTransaction) ArmForSwitch(sw int32) (string, bool) {
	switch EnvelopeType(sw) {
	case EnvelopeTypeEnvelopeTypeTx:
		return "Tx", true
	}
	return "-", false
}

// NewTransactionSignaturePayloadTaggedTransaction creates a new  TransactionSignaturePayloadTaggedTransaction.
func NewTransactionSignaturePayloadTaggedTransaction(aType EnvelopeType, value interface{}) (result TransactionSignaturePayloadTaggedTransaction, err error) {
	result.Type = aType
	switch EnvelopeType(aType) {
	case EnvelopeTypeEnvelopeTypeTx:
		tv, ok := value.(Transaction)
		if !ok {
			err = fmt.Errorf("invalid value, must be Transaction")
			return
		}
		result.Tx = &tv
	}
	return
}

// MustTx retrieves the Tx value from the union,
// panicing if the value is not set.
func (u TransactionSignaturePayloadTaggedTransaction) MustTx() Transaction {
	val, ok := u.GetTx()

	if !ok {
		panic("arm Tx is not set")
	}

	return val
}

// GetTx retrieves the Tx value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u TransactionSignaturePayloadTaggedTransaction) GetTx() (result Transaction, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Tx" {
		result = *u.Tx
		ok = true
	}

	return
}

// TransactionSignaturePayload is an XDR Struct defines as:
//
//   struct TransactionSignaturePayload {
//        Hash networkId;
//        union switch (EnvelopeType type)
//        {
//        case ENVELOPE_TYPE_TX:
//              Transaction tx;
//        /* All other values of type are invalid */
//        } taggedTransaction;
//    };
//
type TransactionSignaturePayload struct {
	NetworkId         Hash
	TaggedTransaction TransactionSignaturePayloadTaggedTransaction
}

// TransactionEnvelope is an XDR Struct defines as:
//
//   struct TransactionEnvelope
//    {
//        Transaction tx;
//        /* Each decorated signature is a signature over the SHA256 hash of
//         * a TransactionSignaturePayload */
//        DecoratedSignature
//        signatures<20>;
//    };
//
type TransactionEnvelope struct {
	Tx         Transaction
	Signatures []DecoratedSignature `xdrmaxsize:"20"`
}

// ClaimOfferAtom is an XDR Struct defines as:
//
//   struct ClaimOfferAtom
//    {
//        // emitted to identify the offer
//        AccountID sellerID; // Account that owns the offer
//        uint64 offerID;
//
//        // amount and asset taken from the owner
//        Asset assetSold;
//        int64 amountSold;
//
//        // amount and asset sent to the owner
//        Asset assetBought;
//        int64 amountBought;
//    };
//
type ClaimOfferAtom struct {
	SellerId     AccountId
	OfferId      Uint64
	AssetSold    Asset
	AmountSold   Int64
	AssetBought  Asset
	AmountBought Int64
}

// CreateAccountResultCode is an XDR Enum defines as:
//
//   enum CreateAccountResultCode
//    {
//        // codes considered as "success" for the operation
//        CREATE_ACCOUNT_SUCCESS = 0, // account was created
//
//        // codes considered as "failure" for the operation
//        CREATE_ACCOUNT_MALFORMED = -1,   // invalid destination
//        CREATE_ACCOUNT_UNDERFUNDED = -2, // not enough funds in source account
//        CREATE_ACCOUNT_LOW_RESERVE =
//            -3, // would create an account below the min reserve
//        CREATE_ACCOUNT_ALREADY_EXIST = -4 // account already exists
//    };
//
type CreateAccountResultCode int32

const (
	CreateAccountResultCodeCreateAccountSuccess      CreateAccountResultCode = 0
	CreateAccountResultCodeCreateAccountMalformed    CreateAccountResultCode = -1
	CreateAccountResultCodeCreateAccountUnderfunded  CreateAccountResultCode = -2
	CreateAccountResultCodeCreateAccountLowReserve   CreateAccountResultCode = -3
	CreateAccountResultCodeCreateAccountAlreadyExist CreateAccountResultCode = -4
)

var createAccountResultCodeMap = map[int32]string{
	0:  "CreateAccountResultCodeCreateAccountSuccess",
	-1: "CreateAccountResultCodeCreateAccountMalformed",
	-2: "CreateAccountResultCodeCreateAccountUnderfunded",
	-3: "CreateAccountResultCodeCreateAccountLowReserve",
	-4: "CreateAccountResultCodeCreateAccountAlreadyExist",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for CreateAccountResultCode
func (e CreateAccountResultCode) ValidEnum(v int32) bool {
	_, ok := createAccountResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e CreateAccountResultCode) String() string {
	name, _ := createAccountResultCodeMap[int32(e)]
	return name
}

// CreateAccountResult is an XDR Union defines as:
//
//   union CreateAccountResult switch (CreateAccountResultCode code)
//    {
//    case CREATE_ACCOUNT_SUCCESS:
//        void;
//    default:
//        void;
//    };
//
type CreateAccountResult struct {
	Code CreateAccountResultCode
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u CreateAccountResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of CreateAccountResult
func (u CreateAccountResult) ArmForSwitch(sw int32) (string, bool) {
	switch CreateAccountResultCode(sw) {
	case CreateAccountResultCodeCreateAccountSuccess:
		return "", true
	default:
		return "", true
	}
}

// NewCreateAccountResult creates a new  CreateAccountResult.
func NewCreateAccountResult(code CreateAccountResultCode, value interface{}) (result CreateAccountResult, err error) {
	result.Code = code
	switch CreateAccountResultCode(code) {
	case CreateAccountResultCodeCreateAccountSuccess:
		// void
	default:
		// void
	}
	return
}

// PaymentResultCode is an XDR Enum defines as:
//
//   enum PaymentResultCode
//    {
//        // codes considered as "success" for the operation
//        PAYMENT_SUCCESS = 0, // payment successfuly completed
//
//        // codes considered as "failure" for the operation
//        PAYMENT_MALFORMED = -1,          // bad input
//        PAYMENT_UNDERFUNDED = -2,        // not enough funds in source account
//        PAYMENT_SRC_NO_TRUST = -3,       // no trust line on source account
//        PAYMENT_SRC_NOT_AUTHORIZED = -4, // source not authorized to transfer
//        PAYMENT_NO_DESTINATION = -5,     // destination account does not exist
//        PAYMENT_NO_TRUST = -6,       // destination missing a trust line for asset
//        PAYMENT_NOT_AUTHORIZED = -7, // destination not authorized to hold asset
//        PAYMENT_LINE_FULL = -8,      // destination would go above their limit
//        PAYMENT_NO_ISSUER = -9       // missing issuer on asset
//    };
//
type PaymentResultCode int32

const (
	PaymentResultCodePaymentSuccess          PaymentResultCode = 0
	PaymentResultCodePaymentMalformed        PaymentResultCode = -1
	PaymentResultCodePaymentUnderfunded      PaymentResultCode = -2
	PaymentResultCodePaymentSrcNoTrust       PaymentResultCode = -3
	PaymentResultCodePaymentSrcNotAuthorized PaymentResultCode = -4
	PaymentResultCodePaymentNoDestination    PaymentResultCode = -5
	PaymentResultCodePaymentNoTrust          PaymentResultCode = -6
	PaymentResultCodePaymentNotAuthorized    PaymentResultCode = -7
	PaymentResultCodePaymentLineFull         PaymentResultCode = -8
	PaymentResultCodePaymentNoIssuer         PaymentResultCode = -9
)

var paymentResultCodeMap = map[int32]string{
	0:  "PaymentResultCodePaymentSuccess",
	-1: "PaymentResultCodePaymentMalformed",
	-2: "PaymentResultCodePaymentUnderfunded",
	-3: "PaymentResultCodePaymentSrcNoTrust",
	-4: "PaymentResultCodePaymentSrcNotAuthorized",
	-5: "PaymentResultCodePaymentNoDestination",
	-6: "PaymentResultCodePaymentNoTrust",
	-7: "PaymentResultCodePaymentNotAuthorized",
	-8: "PaymentResultCodePaymentLineFull",
	-9: "PaymentResultCodePaymentNoIssuer",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for PaymentResultCode
func (e PaymentResultCode) ValidEnum(v int32) bool {
	_, ok := paymentResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e PaymentResultCode) String() string {
	name, _ := paymentResultCodeMap[int32(e)]
	return name
}

// PaymentResult is an XDR Union defines as:
//
//   union PaymentResult switch (PaymentResultCode code)
//    {
//    case PAYMENT_SUCCESS:
//        void;
//    default:
//        void;
//    };
//
type PaymentResult struct {
	Code PaymentResultCode
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u PaymentResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of PaymentResult
func (u PaymentResult) ArmForSwitch(sw int32) (string, bool) {
	switch PaymentResultCode(sw) {
	case PaymentResultCodePaymentSuccess:
		return "", true
	default:
		return "", true
	}
}

// NewPaymentResult creates a new  PaymentResult.
func NewPaymentResult(code PaymentResultCode, value interface{}) (result PaymentResult, err error) {
	result.Code = code
	switch PaymentResultCode(code) {
	case PaymentResultCodePaymentSuccess:
		// void
	default:
		// void
	}
	return
}

// PathPaymentResultCode is an XDR Enum defines as:
//
//   enum PathPaymentResultCode
//    {
//        // codes considered as "success" for the operation
//        PATH_PAYMENT_SUCCESS = 0, // success
//
//        // codes considered as "failure" for the operation
//        PATH_PAYMENT_MALFORMED = -1,          // bad input
//        PATH_PAYMENT_UNDERFUNDED = -2,        // not enough funds in source account
//        PATH_PAYMENT_SRC_NO_TRUST = -3,       // no trust line on source account
//        PATH_PAYMENT_SRC_NOT_AUTHORIZED = -4, // source not authorized to transfer
//        PATH_PAYMENT_NO_DESTINATION = -5,     // destination account does not exist
//        PATH_PAYMENT_NO_TRUST = -6,           // dest missing a trust line for asset
//        PATH_PAYMENT_NOT_AUTHORIZED = -7,     // dest not authorized to hold asset
//        PATH_PAYMENT_LINE_FULL = -8,          // dest would go above their limit
//        PATH_PAYMENT_NO_ISSUER = -9,          // missing issuer on one asset
//        PATH_PAYMENT_TOO_FEW_OFFERS = -10,    // not enough offers to satisfy path
//        PATH_PAYMENT_OFFER_CROSS_SELF = -11,  // would cross one of its own offers
//        PATH_PAYMENT_OVER_SENDMAX = -12       // could not satisfy sendmax
//    };
//
type PathPaymentResultCode int32

const (
	PathPaymentResultCodePathPaymentSuccess          PathPaymentResultCode = 0
	PathPaymentResultCodePathPaymentMalformed        PathPaymentResultCode = -1
	PathPaymentResultCodePathPaymentUnderfunded      PathPaymentResultCode = -2
	PathPaymentResultCodePathPaymentSrcNoTrust       PathPaymentResultCode = -3
	PathPaymentResultCodePathPaymentSrcNotAuthorized PathPaymentResultCode = -4
	PathPaymentResultCodePathPaymentNoDestination    PathPaymentResultCode = -5
	PathPaymentResultCodePathPaymentNoTrust          PathPaymentResultCode = -6
	PathPaymentResultCodePathPaymentNotAuthorized    PathPaymentResultCode = -7
	PathPaymentResultCodePathPaymentLineFull         PathPaymentResultCode = -8
	PathPaymentResultCodePathPaymentNoIssuer         PathPaymentResultCode = -9
	PathPaymentResultCodePathPaymentTooFewOffers     PathPaymentResultCode = -10
	PathPaymentResultCodePathPaymentOfferCrossSelf   PathPaymentResultCode = -11
	PathPaymentResultCodePathPaymentOverSendmax      PathPaymentResultCode = -12
)

var pathPaymentResultCodeMap = map[int32]string{
	0:   "PathPaymentResultCodePathPaymentSuccess",
	-1:  "PathPaymentResultCodePathPaymentMalformed",
	-2:  "PathPaymentResultCodePathPaymentUnderfunded",
	-3:  "PathPaymentResultCodePathPaymentSrcNoTrust",
	-4:  "PathPaymentResultCodePathPaymentSrcNotAuthorized",
	-5:  "PathPaymentResultCodePathPaymentNoDestination",
	-6:  "PathPaymentResultCodePathPaymentNoTrust",
	-7:  "PathPaymentResultCodePathPaymentNotAuthorized",
	-8:  "PathPaymentResultCodePathPaymentLineFull",
	-9:  "PathPaymentResultCodePathPaymentNoIssuer",
	-10: "PathPaymentResultCodePathPaymentTooFewOffers",
	-11: "PathPaymentResultCodePathPaymentOfferCrossSelf",
	-12: "PathPaymentResultCodePathPaymentOverSendmax",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for PathPaymentResultCode
func (e PathPaymentResultCode) ValidEnum(v int32) bool {
	_, ok := pathPaymentResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e PathPaymentResultCode) String() string {
	name, _ := pathPaymentResultCodeMap[int32(e)]
	return name
}

// SimplePaymentResult is an XDR Struct defines as:
//
//   struct SimplePaymentResult
//    {
//        AccountID destination;
//        Asset asset;
//        int64 amount;
//    };
//
type SimplePaymentResult struct {
	Destination AccountId
	Asset       Asset
	Amount      Int64
}

// PathPaymentResultSuccess is an XDR NestedStruct defines as:
//
//   struct
//        {
//            ClaimOfferAtom offers<>;
//            SimplePaymentResult last;
//        }
//
type PathPaymentResultSuccess struct {
	Offers []ClaimOfferAtom
	Last   SimplePaymentResult
}

// PathPaymentResult is an XDR Union defines as:
//
//   union PathPaymentResult switch (PathPaymentResultCode code)
//    {
//    case PATH_PAYMENT_SUCCESS:
//        struct
//        {
//            ClaimOfferAtom offers<>;
//            SimplePaymentResult last;
//        } success;
//    case PATH_PAYMENT_NO_ISSUER:
//        Asset noIssuer; // the asset that caused the error
//    default:
//        void;
//    };
//
type PathPaymentResult struct {
	Code     PathPaymentResultCode
	Success  *PathPaymentResultSuccess
	NoIssuer *Asset
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u PathPaymentResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of PathPaymentResult
func (u PathPaymentResult) ArmForSwitch(sw int32) (string, bool) {
	switch PathPaymentResultCode(sw) {
	case PathPaymentResultCodePathPaymentSuccess:
		return "Success", true
	case PathPaymentResultCodePathPaymentNoIssuer:
		return "NoIssuer", true
	default:
		return "", true
	}
}

// NewPathPaymentResult creates a new  PathPaymentResult.
func NewPathPaymentResult(code PathPaymentResultCode, value interface{}) (result PathPaymentResult, err error) {
	result.Code = code
	switch PathPaymentResultCode(code) {
	case PathPaymentResultCodePathPaymentSuccess:
		tv, ok := value.(PathPaymentResultSuccess)
		if !ok {
			err = fmt.Errorf("invalid value, must be PathPaymentResultSuccess")
			return
		}
		result.Success = &tv
	case PathPaymentResultCodePathPaymentNoIssuer:
		tv, ok := value.(Asset)
		if !ok {
			err = fmt.Errorf("invalid value, must be Asset")
			return
		}
		result.NoIssuer = &tv
	default:
		// void
	}
	return
}

// MustSuccess retrieves the Success value from the union,
// panicing if the value is not set.
func (u PathPaymentResult) MustSuccess() PathPaymentResultSuccess {
	val, ok := u.GetSuccess()

	if !ok {
		panic("arm Success is not set")
	}

	return val
}

// GetSuccess retrieves the Success value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u PathPaymentResult) GetSuccess() (result PathPaymentResultSuccess, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Code))

	if armName == "Success" {
		result = *u.Success
		ok = true
	}

	return
}

// MustNoIssuer retrieves the NoIssuer value from the union,
// panicing if the value is not set.
func (u PathPaymentResult) MustNoIssuer() Asset {
	val, ok := u.GetNoIssuer()

	if !ok {
		panic("arm NoIssuer is not set")
	}

	return val
}

// GetNoIssuer retrieves the NoIssuer value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u PathPaymentResult) GetNoIssuer() (result Asset, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Code))

	if armName == "NoIssuer" {
		result = *u.NoIssuer
		ok = true
	}

	return
}

// ManageOfferResultCode is an XDR Enum defines as:
//
//   enum ManageOfferResultCode
//    {
//        // codes considered as "success" for the operation
//        MANAGE_OFFER_SUCCESS = 0,
//
//        // codes considered as "failure" for the operation
//        MANAGE_OFFER_MALFORMED = -1,     // generated offer would be invalid
//        MANAGE_OFFER_SELL_NO_TRUST = -2, // no trust line for what we're selling
//        MANAGE_OFFER_BUY_NO_TRUST = -3,  // no trust line for what we're buying
//        MANAGE_OFFER_SELL_NOT_AUTHORIZED = -4, // not authorized to sell
//        MANAGE_OFFER_BUY_NOT_AUTHORIZED = -5,  // not authorized to buy
//        MANAGE_OFFER_LINE_FULL = -6,      // can't receive more of what it's buying
//        MANAGE_OFFER_UNDERFUNDED = -7,    // doesn't hold what it's trying to sell
//        MANAGE_OFFER_CROSS_SELF = -8,     // would cross an offer from the same user
//        MANAGE_OFFER_SELL_NO_ISSUER = -9, // no issuer for what we're selling
//        MANAGE_OFFER_BUY_NO_ISSUER = -10, // no issuer for what we're buying
//
//        // update errors
//        MANAGE_OFFER_NOT_FOUND = -11, // offerID does not match an existing offer
//
//        MANAGE_OFFER_LOW_RESERVE = -12 // not enough funds to create a new Offer
//    };
//
type ManageOfferResultCode int32

const (
	ManageOfferResultCodeManageOfferSuccess           ManageOfferResultCode = 0
	ManageOfferResultCodeManageOfferMalformed         ManageOfferResultCode = -1
	ManageOfferResultCodeManageOfferSellNoTrust       ManageOfferResultCode = -2
	ManageOfferResultCodeManageOfferBuyNoTrust        ManageOfferResultCode = -3
	ManageOfferResultCodeManageOfferSellNotAuthorized ManageOfferResultCode = -4
	ManageOfferResultCodeManageOfferBuyNotAuthorized  ManageOfferResultCode = -5
	ManageOfferResultCodeManageOfferLineFull          ManageOfferResultCode = -6
	ManageOfferResultCodeManageOfferUnderfunded       ManageOfferResultCode = -7
	ManageOfferResultCodeManageOfferCrossSelf         ManageOfferResultCode = -8
	ManageOfferResultCodeManageOfferSellNoIssuer      ManageOfferResultCode = -9
	ManageOfferResultCodeManageOfferBuyNoIssuer       ManageOfferResultCode = -10
	ManageOfferResultCodeManageOfferNotFound          ManageOfferResultCode = -11
	ManageOfferResultCodeManageOfferLowReserve        ManageOfferResultCode = -12
)

var manageOfferResultCodeMap = map[int32]string{
	0:   "ManageOfferResultCodeManageOfferSuccess",
	-1:  "ManageOfferResultCodeManageOfferMalformed",
	-2:  "ManageOfferResultCodeManageOfferSellNoTrust",
	-3:  "ManageOfferResultCodeManageOfferBuyNoTrust",
	-4:  "ManageOfferResultCodeManageOfferSellNotAuthorized",
	-5:  "ManageOfferResultCodeManageOfferBuyNotAuthorized",
	-6:  "ManageOfferResultCodeManageOfferLineFull",
	-7:  "ManageOfferResultCodeManageOfferUnderfunded",
	-8:  "ManageOfferResultCodeManageOfferCrossSelf",
	-9:  "ManageOfferResultCodeManageOfferSellNoIssuer",
	-10: "ManageOfferResultCodeManageOfferBuyNoIssuer",
	-11: "ManageOfferResultCodeManageOfferNotFound",
	-12: "ManageOfferResultCodeManageOfferLowReserve",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for ManageOfferResultCode
func (e ManageOfferResultCode) ValidEnum(v int32) bool {
	_, ok := manageOfferResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e ManageOfferResultCode) String() string {
	name, _ := manageOfferResultCodeMap[int32(e)]
	return name
}

// ManageOfferEffect is an XDR Enum defines as:
//
//   enum ManageOfferEffect
//    {
//        MANAGE_OFFER_CREATED = 0,
//        MANAGE_OFFER_UPDATED = 1,
//        MANAGE_OFFER_DELETED = 2
//    };
//
type ManageOfferEffect int32

const (
	ManageOfferEffectManageOfferCreated ManageOfferEffect = 0
	ManageOfferEffectManageOfferUpdated ManageOfferEffect = 1
	ManageOfferEffectManageOfferDeleted ManageOfferEffect = 2
)

var manageOfferEffectMap = map[int32]string{
	0: "ManageOfferEffectManageOfferCreated",
	1: "ManageOfferEffectManageOfferUpdated",
	2: "ManageOfferEffectManageOfferDeleted",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for ManageOfferEffect
func (e ManageOfferEffect) ValidEnum(v int32) bool {
	_, ok := manageOfferEffectMap[v]
	return ok
}

// String returns the name of `e`
func (e ManageOfferEffect) String() string {
	name, _ := manageOfferEffectMap[int32(e)]
	return name
}

// ManageOfferSuccessResultOffer is an XDR NestedUnion defines as:
//
//   union switch (ManageOfferEffect effect)
//        {
//        case MANAGE_OFFER_CREATED:
//        case MANAGE_OFFER_UPDATED:
//            OfferEntry offer;
//        default:
//            void;
//        }
//
type ManageOfferSuccessResultOffer struct {
	Effect ManageOfferEffect
	Offer  *OfferEntry
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u ManageOfferSuccessResultOffer) SwitchFieldName() string {
	return "Effect"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of ManageOfferSuccessResultOffer
func (u ManageOfferSuccessResultOffer) ArmForSwitch(sw int32) (string, bool) {
	switch ManageOfferEffect(sw) {
	case ManageOfferEffectManageOfferCreated:
		return "Offer", true
	case ManageOfferEffectManageOfferUpdated:
		return "Offer", true
	default:
		return "", true
	}
}

// NewManageOfferSuccessResultOffer creates a new  ManageOfferSuccessResultOffer.
func NewManageOfferSuccessResultOffer(effect ManageOfferEffect, value interface{}) (result ManageOfferSuccessResultOffer, err error) {
	result.Effect = effect
	switch ManageOfferEffect(effect) {
	case ManageOfferEffectManageOfferCreated:
		tv, ok := value.(OfferEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be OfferEntry")
			return
		}
		result.Offer = &tv
	case ManageOfferEffectManageOfferUpdated:
		tv, ok := value.(OfferEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be OfferEntry")
			return
		}
		result.Offer = &tv
	default:
		// void
	}
	return
}

// MustOffer retrieves the Offer value from the union,
// panicing if the value is not set.
func (u ManageOfferSuccessResultOffer) MustOffer() OfferEntry {
	val, ok := u.GetOffer()

	if !ok {
		panic("arm Offer is not set")
	}

	return val
}

// GetOffer retrieves the Offer value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u ManageOfferSuccessResultOffer) GetOffer() (result OfferEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Effect))

	if armName == "Offer" {
		result = *u.Offer
		ok = true
	}

	return
}

// ManageOfferSuccessResult is an XDR Struct defines as:
//
//   struct ManageOfferSuccessResult
//    {
//        // offers that got claimed while creating this offer
//        ClaimOfferAtom offersClaimed<>;
//
//        union switch (ManageOfferEffect effect)
//        {
//        case MANAGE_OFFER_CREATED:
//        case MANAGE_OFFER_UPDATED:
//            OfferEntry offer;
//        default:
//            void;
//        }
//        offer;
//    };
//
type ManageOfferSuccessResult struct {
	OffersClaimed []ClaimOfferAtom
	Offer         ManageOfferSuccessResultOffer
}

// ManageOfferResult is an XDR Union defines as:
//
//   union ManageOfferResult switch (ManageOfferResultCode code)
//    {
//    case MANAGE_OFFER_SUCCESS:
//        ManageOfferSuccessResult success;
//    default:
//        void;
//    };
//
type ManageOfferResult struct {
	Code    ManageOfferResultCode
	Success *ManageOfferSuccessResult
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u ManageOfferResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of ManageOfferResult
func (u ManageOfferResult) ArmForSwitch(sw int32) (string, bool) {
	switch ManageOfferResultCode(sw) {
	case ManageOfferResultCodeManageOfferSuccess:
		return "Success", true
	default:
		return "", true
	}
}

// NewManageOfferResult creates a new  ManageOfferResult.
func NewManageOfferResult(code ManageOfferResultCode, value interface{}) (result ManageOfferResult, err error) {
	result.Code = code
	switch ManageOfferResultCode(code) {
	case ManageOfferResultCodeManageOfferSuccess:
		tv, ok := value.(ManageOfferSuccessResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be ManageOfferSuccessResult")
			return
		}
		result.Success = &tv
	default:
		// void
	}
	return
}

// MustSuccess retrieves the Success value from the union,
// panicing if the value is not set.
func (u ManageOfferResult) MustSuccess() ManageOfferSuccessResult {
	val, ok := u.GetSuccess()

	if !ok {
		panic("arm Success is not set")
	}

	return val
}

// GetSuccess retrieves the Success value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u ManageOfferResult) GetSuccess() (result ManageOfferSuccessResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Code))

	if armName == "Success" {
		result = *u.Success
		ok = true
	}

	return
}

// SetOptionsResultCode is an XDR Enum defines as:
//
//   enum SetOptionsResultCode
//    {
//        // codes considered as "success" for the operation
//        SET_OPTIONS_SUCCESS = 0,
//        // codes considered as "failure" for the operation
//        SET_OPTIONS_LOW_RESERVE = -1,      // not enough funds to add a signer
//        SET_OPTIONS_TOO_MANY_SIGNERS = -2, // max number of signers already reached
//        SET_OPTIONS_BAD_FLAGS = -3,        // invalid combination of clear/set flags
//        SET_OPTIONS_INVALID_INFLATION = -4,      // inflation account does not exist
//        SET_OPTIONS_CANT_CHANGE = -5,            // can no longer change this option
//        SET_OPTIONS_UNKNOWN_FLAG = -6,           // can't set an unknown flag
//        SET_OPTIONS_THRESHOLD_OUT_OF_RANGE = -7, // bad value for weight/threshold
//        SET_OPTIONS_BAD_SIGNER = -8,             // signer cannot be masterkey
//        SET_OPTIONS_INVALID_HOME_DOMAIN = -9     // malformed home domain
//    };
//
type SetOptionsResultCode int32

const (
	SetOptionsResultCodeSetOptionsSuccess             SetOptionsResultCode = 0
	SetOptionsResultCodeSetOptionsLowReserve          SetOptionsResultCode = -1
	SetOptionsResultCodeSetOptionsTooManySigners      SetOptionsResultCode = -2
	SetOptionsResultCodeSetOptionsBadFlags            SetOptionsResultCode = -3
	SetOptionsResultCodeSetOptionsInvalidInflation    SetOptionsResultCode = -4
	SetOptionsResultCodeSetOptionsCantChange          SetOptionsResultCode = -5
	SetOptionsResultCodeSetOptionsUnknownFlag         SetOptionsResultCode = -6
	SetOptionsResultCodeSetOptionsThresholdOutOfRange SetOptionsResultCode = -7
	SetOptionsResultCodeSetOptionsBadSigner           SetOptionsResultCode = -8
	SetOptionsResultCodeSetOptionsInvalidHomeDomain   SetOptionsResultCode = -9
)

var setOptionsResultCodeMap = map[int32]string{
	0:  "SetOptionsResultCodeSetOptionsSuccess",
	-1: "SetOptionsResultCodeSetOptionsLowReserve",
	-2: "SetOptionsResultCodeSetOptionsTooManySigners",
	-3: "SetOptionsResultCodeSetOptionsBadFlags",
	-4: "SetOptionsResultCodeSetOptionsInvalidInflation",
	-5: "SetOptionsResultCodeSetOptionsCantChange",
	-6: "SetOptionsResultCodeSetOptionsUnknownFlag",
	-7: "SetOptionsResultCodeSetOptionsThresholdOutOfRange",
	-8: "SetOptionsResultCodeSetOptionsBadSigner",
	-9: "SetOptionsResultCodeSetOptionsInvalidHomeDomain",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for SetOptionsResultCode
func (e SetOptionsResultCode) ValidEnum(v int32) bool {
	_, ok := setOptionsResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e SetOptionsResultCode) String() string {
	name, _ := setOptionsResultCodeMap[int32(e)]
	return name
}

// SetOptionsResult is an XDR Union defines as:
//
//   union SetOptionsResult switch (SetOptionsResultCode code)
//    {
//    case SET_OPTIONS_SUCCESS:
//        void;
//    default:
//        void;
//    };
//
type SetOptionsResult struct {
	Code SetOptionsResultCode
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u SetOptionsResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of SetOptionsResult
func (u SetOptionsResult) ArmForSwitch(sw int32) (string, bool) {
	switch SetOptionsResultCode(sw) {
	case SetOptionsResultCodeSetOptionsSuccess:
		return "", true
	default:
		return "", true
	}
}

// NewSetOptionsResult creates a new  SetOptionsResult.
func NewSetOptionsResult(code SetOptionsResultCode, value interface{}) (result SetOptionsResult, err error) {
	result.Code = code
	switch SetOptionsResultCode(code) {
	case SetOptionsResultCodeSetOptionsSuccess:
		// void
	default:
		// void
	}
	return
}

// ChangeTrustResultCode is an XDR Enum defines as:
//
//   enum ChangeTrustResultCode
//    {
//        // codes considered as "success" for the operation
//        CHANGE_TRUST_SUCCESS = 0,
//        // codes considered as "failure" for the operation
//        CHANGE_TRUST_MALFORMED = -1,     // bad input
//        CHANGE_TRUST_NO_ISSUER = -2,     // could not find issuer
//        CHANGE_TRUST_INVALID_LIMIT = -3, // cannot drop limit below balance
//                                         // cannot create with a limit of 0
//        CHANGE_TRUST_LOW_RESERVE = -4, // not enough funds to create a new trust line,
//        CHANGE_TRUST_SELF_NOT_ALLOWED = -5 // trusting self is not allowed
//    };
//
type ChangeTrustResultCode int32

const (
	ChangeTrustResultCodeChangeTrustSuccess        ChangeTrustResultCode = 0
	ChangeTrustResultCodeChangeTrustMalformed      ChangeTrustResultCode = -1
	ChangeTrustResultCodeChangeTrustNoIssuer       ChangeTrustResultCode = -2
	ChangeTrustResultCodeChangeTrustInvalidLimit   ChangeTrustResultCode = -3
	ChangeTrustResultCodeChangeTrustLowReserve     ChangeTrustResultCode = -4
	ChangeTrustResultCodeChangeTrustSelfNotAllowed ChangeTrustResultCode = -5
)

var changeTrustResultCodeMap = map[int32]string{
	0:  "ChangeTrustResultCodeChangeTrustSuccess",
	-1: "ChangeTrustResultCodeChangeTrustMalformed",
	-2: "ChangeTrustResultCodeChangeTrustNoIssuer",
	-3: "ChangeTrustResultCodeChangeTrustInvalidLimit",
	-4: "ChangeTrustResultCodeChangeTrustLowReserve",
	-5: "ChangeTrustResultCodeChangeTrustSelfNotAllowed",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for ChangeTrustResultCode
func (e ChangeTrustResultCode) ValidEnum(v int32) bool {
	_, ok := changeTrustResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e ChangeTrustResultCode) String() string {
	name, _ := changeTrustResultCodeMap[int32(e)]
	return name
}

// ChangeTrustResult is an XDR Union defines as:
//
//   union ChangeTrustResult switch (ChangeTrustResultCode code)
//    {
//    case CHANGE_TRUST_SUCCESS:
//        void;
//    default:
//        void;
//    };
//
type ChangeTrustResult struct {
	Code ChangeTrustResultCode
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u ChangeTrustResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of ChangeTrustResult
func (u ChangeTrustResult) ArmForSwitch(sw int32) (string, bool) {
	switch ChangeTrustResultCode(sw) {
	case ChangeTrustResultCodeChangeTrustSuccess:
		return "", true
	default:
		return "", true
	}
}

// NewChangeTrustResult creates a new  ChangeTrustResult.
func NewChangeTrustResult(code ChangeTrustResultCode, value interface{}) (result ChangeTrustResult, err error) {
	result.Code = code
	switch ChangeTrustResultCode(code) {
	case ChangeTrustResultCodeChangeTrustSuccess:
		// void
	default:
		// void
	}
	return
}

// AllowTrustResultCode is an XDR Enum defines as:
//
//   enum AllowTrustResultCode
//    {
//        // codes considered as "success" for the operation
//        ALLOW_TRUST_SUCCESS = 0,
//        // codes considered as "failure" for the operation
//        ALLOW_TRUST_MALFORMED = -1,     // asset is not ASSET_TYPE_ALPHANUM
//        ALLOW_TRUST_NO_TRUST_LINE = -2, // trustor does not have a trustline
//                                        // source account does not require trust
//        ALLOW_TRUST_TRUST_NOT_REQUIRED = -3,
//        ALLOW_TRUST_CANT_REVOKE = -4, // source account can't revoke trust,
//        ALLOW_TRUST_SELF_NOT_ALLOWED = -5 // trusting self is not allowed
//    };
//
type AllowTrustResultCode int32

const (
	AllowTrustResultCodeAllowTrustSuccess          AllowTrustResultCode = 0
	AllowTrustResultCodeAllowTrustMalformed        AllowTrustResultCode = -1
	AllowTrustResultCodeAllowTrustNoTrustLine      AllowTrustResultCode = -2
	AllowTrustResultCodeAllowTrustTrustNotRequired AllowTrustResultCode = -3
	AllowTrustResultCodeAllowTrustCantRevoke       AllowTrustResultCode = -4
	AllowTrustResultCodeAllowTrustSelfNotAllowed   AllowTrustResultCode = -5
)

var allowTrustResultCodeMap = map[int32]string{
	0:  "AllowTrustResultCodeAllowTrustSuccess",
	-1: "AllowTrustResultCodeAllowTrustMalformed",
	-2: "AllowTrustResultCodeAllowTrustNoTrustLine",
	-3: "AllowTrustResultCodeAllowTrustTrustNotRequired",
	-4: "AllowTrustResultCodeAllowTrustCantRevoke",
	-5: "AllowTrustResultCodeAllowTrustSelfNotAllowed",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for AllowTrustResultCode
func (e AllowTrustResultCode) ValidEnum(v int32) bool {
	_, ok := allowTrustResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e AllowTrustResultCode) String() string {
	name, _ := allowTrustResultCodeMap[int32(e)]
	return name
}

// AllowTrustResult is an XDR Union defines as:
//
//   union AllowTrustResult switch (AllowTrustResultCode code)
//    {
//    case ALLOW_TRUST_SUCCESS:
//        void;
//    default:
//        void;
//    };
//
type AllowTrustResult struct {
	Code AllowTrustResultCode
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u AllowTrustResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of AllowTrustResult
func (u AllowTrustResult) ArmForSwitch(sw int32) (string, bool) {
	switch AllowTrustResultCode(sw) {
	case AllowTrustResultCodeAllowTrustSuccess:
		return "", true
	default:
		return "", true
	}
}

// NewAllowTrustResult creates a new  AllowTrustResult.
func NewAllowTrustResult(code AllowTrustResultCode, value interface{}) (result AllowTrustResult, err error) {
	result.Code = code
	switch AllowTrustResultCode(code) {
	case AllowTrustResultCodeAllowTrustSuccess:
		// void
	default:
		// void
	}
	return
}

// AccountMergeResultCode is an XDR Enum defines as:
//
//   enum AccountMergeResultCode
//    {
//        // codes considered as "success" for the operation
//        ACCOUNT_MERGE_SUCCESS = 0,
//        // codes considered as "failure" for the operation
//        ACCOUNT_MERGE_MALFORMED = -1,      // can't merge onto itself
//        ACCOUNT_MERGE_NO_ACCOUNT = -2,     // destination does not exist
//        ACCOUNT_MERGE_IMMUTABLE_SET = -3,  // source account has AUTH_IMMUTABLE set
//        ACCOUNT_MERGE_HAS_SUB_ENTRIES = -4 // account has trust lines/offers
//    };
//
type AccountMergeResultCode int32

const (
	AccountMergeResultCodeAccountMergeSuccess       AccountMergeResultCode = 0
	AccountMergeResultCodeAccountMergeMalformed     AccountMergeResultCode = -1
	AccountMergeResultCodeAccountMergeNoAccount     AccountMergeResultCode = -2
	AccountMergeResultCodeAccountMergeImmutableSet  AccountMergeResultCode = -3
	AccountMergeResultCodeAccountMergeHasSubEntries AccountMergeResultCode = -4
)

var accountMergeResultCodeMap = map[int32]string{
	0:  "AccountMergeResultCodeAccountMergeSuccess",
	-1: "AccountMergeResultCodeAccountMergeMalformed",
	-2: "AccountMergeResultCodeAccountMergeNoAccount",
	-3: "AccountMergeResultCodeAccountMergeImmutableSet",
	-4: "AccountMergeResultCodeAccountMergeHasSubEntries",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for AccountMergeResultCode
func (e AccountMergeResultCode) ValidEnum(v int32) bool {
	_, ok := accountMergeResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e AccountMergeResultCode) String() string {
	name, _ := accountMergeResultCodeMap[int32(e)]
	return name
}

// AccountMergeResult is an XDR Union defines as:
//
//   union AccountMergeResult switch (AccountMergeResultCode code)
//    {
//    case ACCOUNT_MERGE_SUCCESS:
//        int64 sourceAccountBalance; // how much got transfered from source account
//    default:
//        void;
//    };
//
type AccountMergeResult struct {
	Code                 AccountMergeResultCode
	SourceAccountBalance *Int64
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u AccountMergeResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of AccountMergeResult
func (u AccountMergeResult) ArmForSwitch(sw int32) (string, bool) {
	switch AccountMergeResultCode(sw) {
	case AccountMergeResultCodeAccountMergeSuccess:
		return "SourceAccountBalance", true
	default:
		return "", true
	}
}

// NewAccountMergeResult creates a new  AccountMergeResult.
func NewAccountMergeResult(code AccountMergeResultCode, value interface{}) (result AccountMergeResult, err error) {
	result.Code = code
	switch AccountMergeResultCode(code) {
	case AccountMergeResultCodeAccountMergeSuccess:
		tv, ok := value.(Int64)
		if !ok {
			err = fmt.Errorf("invalid value, must be Int64")
			return
		}
		result.SourceAccountBalance = &tv
	default:
		// void
	}
	return
}

// MustSourceAccountBalance retrieves the SourceAccountBalance value from the union,
// panicing if the value is not set.
func (u AccountMergeResult) MustSourceAccountBalance() Int64 {
	val, ok := u.GetSourceAccountBalance()

	if !ok {
		panic("arm SourceAccountBalance is not set")
	}

	return val
}

// GetSourceAccountBalance retrieves the SourceAccountBalance value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u AccountMergeResult) GetSourceAccountBalance() (result Int64, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Code))

	if armName == "SourceAccountBalance" {
		result = *u.SourceAccountBalance
		ok = true
	}

	return
}

// InflationResultCode is an XDR Enum defines as:
//
//   enum InflationResultCode
//    {
//        // codes considered as "success" for the operation
//        INFLATION_SUCCESS = 0,
//        // codes considered as "failure" for the operation
//        INFLATION_NOT_TIME = -1
//    };
//
type InflationResultCode int32

const (
	InflationResultCodeInflationSuccess InflationResultCode = 0
	InflationResultCodeInflationNotTime InflationResultCode = -1
)

var inflationResultCodeMap = map[int32]string{
	0:  "InflationResultCodeInflationSuccess",
	-1: "InflationResultCodeInflationNotTime",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for InflationResultCode
func (e InflationResultCode) ValidEnum(v int32) bool {
	_, ok := inflationResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e InflationResultCode) String() string {
	name, _ := inflationResultCodeMap[int32(e)]
	return name
}

// InflationPayout is an XDR Struct defines as:
//
//   struct InflationPayout // or use PaymentResultAtom to limit types?
//    {
//        AccountID destination;
//        int64 amount;
//    };
//
type InflationPayout struct {
	Destination AccountId
	Amount      Int64
}

// InflationResult is an XDR Union defines as:
//
//   union InflationResult switch (InflationResultCode code)
//    {
//    case INFLATION_SUCCESS:
//        InflationPayout payouts<>;
//    default:
//        void;
//    };
//
type InflationResult struct {
	Code    InflationResultCode
	Payouts *[]InflationPayout
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u InflationResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of InflationResult
func (u InflationResult) ArmForSwitch(sw int32) (string, bool) {
	switch InflationResultCode(sw) {
	case InflationResultCodeInflationSuccess:
		return "Payouts", true
	default:
		return "", true
	}
}

// NewInflationResult creates a new  InflationResult.
func NewInflationResult(code InflationResultCode, value interface{}) (result InflationResult, err error) {
	result.Code = code
	switch InflationResultCode(code) {
	case InflationResultCodeInflationSuccess:
		tv, ok := value.([]InflationPayout)
		if !ok {
			err = fmt.Errorf("invalid value, must be []InflationPayout")
			return
		}
		result.Payouts = &tv
	default:
		// void
	}
	return
}

// MustPayouts retrieves the Payouts value from the union,
// panicing if the value is not set.
func (u InflationResult) MustPayouts() []InflationPayout {
	val, ok := u.GetPayouts()

	if !ok {
		panic("arm Payouts is not set")
	}

	return val
}

// GetPayouts retrieves the Payouts value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u InflationResult) GetPayouts() (result []InflationPayout, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Code))

	if armName == "Payouts" {
		result = *u.Payouts
		ok = true
	}

	return
}

// ManageDataResultCode is an XDR Enum defines as:
//
//   enum ManageDataResultCode
//    {
//        // codes considered as "success" for the operation
//        MANAGE_DATA_SUCCESS = 0,
//        // codes considered as "failure" for the operation
//        MANAGE_DATA_NOT_SUPPORTED_YET = -1, // The network hasn't moved to this protocol change yet
//        MANAGE_DATA_NAME_NOT_FOUND = -2,    // Trying to remove a Data Entry that isn't there
//        MANAGE_DATA_LOW_RESERVE = -3,       // not enough funds to create a new Data Entry
//        MANAGE_DATA_INVALID_NAME = -4       // Name not a valid string
//    };
//
type ManageDataResultCode int32

const (
	ManageDataResultCodeManageDataSuccess         ManageDataResultCode = 0
	ManageDataResultCodeManageDataNotSupportedYet ManageDataResultCode = -1
	ManageDataResultCodeManageDataNameNotFound    ManageDataResultCode = -2
	ManageDataResultCodeManageDataLowReserve      ManageDataResultCode = -3
	ManageDataResultCodeManageDataInvalidName     ManageDataResultCode = -4
)

var manageDataResultCodeMap = map[int32]string{
	0:  "ManageDataResultCodeManageDataSuccess",
	-1: "ManageDataResultCodeManageDataNotSupportedYet",
	-2: "ManageDataResultCodeManageDataNameNotFound",
	-3: "ManageDataResultCodeManageDataLowReserve",
	-4: "ManageDataResultCodeManageDataInvalidName",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for ManageDataResultCode
func (e ManageDataResultCode) ValidEnum(v int32) bool {
	_, ok := manageDataResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e ManageDataResultCode) String() string {
	name, _ := manageDataResultCodeMap[int32(e)]
	return name
}

// ManageDataResult is an XDR Union defines as:
//
//   union ManageDataResult switch (ManageDataResultCode code)
//    {
//    case MANAGE_DATA_SUCCESS:
//        void;
//    default:
//        void;
//    };
//
type ManageDataResult struct {
	Code ManageDataResultCode
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u ManageDataResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of ManageDataResult
func (u ManageDataResult) ArmForSwitch(sw int32) (string, bool) {
	switch ManageDataResultCode(sw) {
	case ManageDataResultCodeManageDataSuccess:
		return "", true
	default:
		return "", true
	}
}

// NewManageDataResult creates a new  ManageDataResult.
func NewManageDataResult(code ManageDataResultCode, value interface{}) (result ManageDataResult, err error) {
	result.Code = code
	switch ManageDataResultCode(code) {
	case ManageDataResultCodeManageDataSuccess:
		// void
	default:
		// void
	}
	return
}

// OperationResultCode is an XDR Enum defines as:
//
//   enum OperationResultCode
//    {
//        opINNER = 0, // inner object result is valid
//
//        opBAD_AUTH = -1,  // too few valid signatures / wrong network
//        opNO_ACCOUNT = -2 // source account was not found
//    };
//
type OperationResultCode int32

const (
	OperationResultCodeOpInner     OperationResultCode = 0
	OperationResultCodeOpBadAuth   OperationResultCode = -1
	OperationResultCodeOpNoAccount OperationResultCode = -2
)

var operationResultCodeMap = map[int32]string{
	0:  "OperationResultCodeOpInner",
	-1: "OperationResultCodeOpBadAuth",
	-2: "OperationResultCodeOpNoAccount",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for OperationResultCode
func (e OperationResultCode) ValidEnum(v int32) bool {
	_, ok := operationResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e OperationResultCode) String() string {
	name, _ := operationResultCodeMap[int32(e)]
	return name
}

// OperationResultTr is an XDR NestedUnion defines as:
//
//   union switch (OperationType type)
//        {
//        case CREATE_ACCOUNT:
//            CreateAccountResult createAccountResult;
//        case PAYMENT:
//            PaymentResult paymentResult;
//        case PATH_PAYMENT:
//            PathPaymentResult pathPaymentResult;
//        case MANAGE_OFFER:
//            ManageOfferResult manageOfferResult;
//        case CREATE_PASSIVE_OFFER:
//            ManageOfferResult createPassiveOfferResult;
//        case SET_OPTIONS:
//            SetOptionsResult setOptionsResult;
//        case CHANGE_TRUST:
//            ChangeTrustResult changeTrustResult;
//        case ALLOW_TRUST:
//            AllowTrustResult allowTrustResult;
//        case ACCOUNT_MERGE:
//            AccountMergeResult accountMergeResult;
//        case INFLATION:
//            InflationResult inflationResult;
//        case MANAGE_DATA:
//            ManageDataResult manageDataResult;
//        }
//
type OperationResultTr struct {
	Type                     OperationType
	CreateAccountResult      *CreateAccountResult
	PaymentResult            *PaymentResult
	PathPaymentResult        *PathPaymentResult
	ManageOfferResult        *ManageOfferResult
	CreatePassiveOfferResult *ManageOfferResult
	SetOptionsResult         *SetOptionsResult
	ChangeTrustResult        *ChangeTrustResult
	AllowTrustResult         *AllowTrustResult
	AccountMergeResult       *AccountMergeResult
	InflationResult          *InflationResult
	ManageDataResult         *ManageDataResult
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u OperationResultTr) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of OperationResultTr
func (u OperationResultTr) ArmForSwitch(sw int32) (string, bool) {
	switch OperationType(sw) {
	case OperationTypeCreateAccount:
		return "CreateAccountResult", true
	case OperationTypePayment:
		return "PaymentResult", true
	case OperationTypePathPayment:
		return "PathPaymentResult", true
	case OperationTypeManageOffer:
		return "ManageOfferResult", true
	case OperationTypeCreatePassiveOffer:
		return "CreatePassiveOfferResult", true
	case OperationTypeSetOptions:
		return "SetOptionsResult", true
	case OperationTypeChangeTrust:
		return "ChangeTrustResult", true
	case OperationTypeAllowTrust:
		return "AllowTrustResult", true
	case OperationTypeAccountMerge:
		return "AccountMergeResult", true
	case OperationTypeInflation:
		return "InflationResult", true
	case OperationTypeManageData:
		return "ManageDataResult", true
	}
	return "-", false
}

// NewOperationResultTr creates a new  OperationResultTr.
func NewOperationResultTr(aType OperationType, value interface{}) (result OperationResultTr, err error) {
	result.Type = aType
	switch OperationType(aType) {
	case OperationTypeCreateAccount:
		tv, ok := value.(CreateAccountResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be CreateAccountResult")
			return
		}
		result.CreateAccountResult = &tv
	case OperationTypePayment:
		tv, ok := value.(PaymentResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be PaymentResult")
			return
		}
		result.PaymentResult = &tv
	case OperationTypePathPayment:
		tv, ok := value.(PathPaymentResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be PathPaymentResult")
			return
		}
		result.PathPaymentResult = &tv
	case OperationTypeManageOffer:
		tv, ok := value.(ManageOfferResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be ManageOfferResult")
			return
		}
		result.ManageOfferResult = &tv
	case OperationTypeCreatePassiveOffer:
		tv, ok := value.(ManageOfferResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be ManageOfferResult")
			return
		}
		result.CreatePassiveOfferResult = &tv
	case OperationTypeSetOptions:
		tv, ok := value.(SetOptionsResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be SetOptionsResult")
			return
		}
		result.SetOptionsResult = &tv
	case OperationTypeChangeTrust:
		tv, ok := value.(ChangeTrustResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be ChangeTrustResult")
			return
		}
		result.ChangeTrustResult = &tv
	case OperationTypeAllowTrust:
		tv, ok := value.(AllowTrustResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be AllowTrustResult")
			return
		}
		result.AllowTrustResult = &tv
	case OperationTypeAccountMerge:
		tv, ok := value.(AccountMergeResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be AccountMergeResult")
			return
		}
		result.AccountMergeResult = &tv
	case OperationTypeInflation:
		tv, ok := value.(InflationResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be InflationResult")
			return
		}
		result.InflationResult = &tv
	case OperationTypeManageData:
		tv, ok := value.(ManageDataResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be ManageDataResult")
			return
		}
		result.ManageDataResult = &tv
	}
	return
}

// MustCreateAccountResult retrieves the CreateAccountResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustCreateAccountResult() CreateAccountResult {
	val, ok := u.GetCreateAccountResult()

	if !ok {
		panic("arm CreateAccountResult is not set")
	}

	return val
}

// GetCreateAccountResult retrieves the CreateAccountResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetCreateAccountResult() (result CreateAccountResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "CreateAccountResult" {
		result = *u.CreateAccountResult
		ok = true
	}

	return
}

// MustPaymentResult retrieves the PaymentResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustPaymentResult() PaymentResult {
	val, ok := u.GetPaymentResult()

	if !ok {
		panic("arm PaymentResult is not set")
	}

	return val
}

// GetPaymentResult retrieves the PaymentResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetPaymentResult() (result PaymentResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "PaymentResult" {
		result = *u.PaymentResult
		ok = true
	}

	return
}

// MustPathPaymentResult retrieves the PathPaymentResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustPathPaymentResult() PathPaymentResult {
	val, ok := u.GetPathPaymentResult()

	if !ok {
		panic("arm PathPaymentResult is not set")
	}

	return val
}

// GetPathPaymentResult retrieves the PathPaymentResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetPathPaymentResult() (result PathPaymentResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "PathPaymentResult" {
		result = *u.PathPaymentResult
		ok = true
	}

	return
}

// MustManageOfferResult retrieves the ManageOfferResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustManageOfferResult() ManageOfferResult {
	val, ok := u.GetManageOfferResult()

	if !ok {
		panic("arm ManageOfferResult is not set")
	}

	return val
}

// GetManageOfferResult retrieves the ManageOfferResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetManageOfferResult() (result ManageOfferResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "ManageOfferResult" {
		result = *u.ManageOfferResult
		ok = true
	}

	return
}

// MustCreatePassiveOfferResult retrieves the CreatePassiveOfferResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustCreatePassiveOfferResult() ManageOfferResult {
	val, ok := u.GetCreatePassiveOfferResult()

	if !ok {
		panic("arm CreatePassiveOfferResult is not set")
	}

	return val
}

// GetCreatePassiveOfferResult retrieves the CreatePassiveOfferResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetCreatePassiveOfferResult() (result ManageOfferResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "CreatePassiveOfferResult" {
		result = *u.CreatePassiveOfferResult
		ok = true
	}

	return
}

// MustSetOptionsResult retrieves the SetOptionsResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustSetOptionsResult() SetOptionsResult {
	val, ok := u.GetSetOptionsResult()

	if !ok {
		panic("arm SetOptionsResult is not set")
	}

	return val
}

// GetSetOptionsResult retrieves the SetOptionsResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetSetOptionsResult() (result SetOptionsResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "SetOptionsResult" {
		result = *u.SetOptionsResult
		ok = true
	}

	return
}

// MustChangeTrustResult retrieves the ChangeTrustResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustChangeTrustResult() ChangeTrustResult {
	val, ok := u.GetChangeTrustResult()

	if !ok {
		panic("arm ChangeTrustResult is not set")
	}

	return val
}

// GetChangeTrustResult retrieves the ChangeTrustResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetChangeTrustResult() (result ChangeTrustResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "ChangeTrustResult" {
		result = *u.ChangeTrustResult
		ok = true
	}

	return
}

// MustAllowTrustResult retrieves the AllowTrustResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustAllowTrustResult() AllowTrustResult {
	val, ok := u.GetAllowTrustResult()

	if !ok {
		panic("arm AllowTrustResult is not set")
	}

	return val
}

// GetAllowTrustResult retrieves the AllowTrustResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetAllowTrustResult() (result AllowTrustResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "AllowTrustResult" {
		result = *u.AllowTrustResult
		ok = true
	}

	return
}

// MustAccountMergeResult retrieves the AccountMergeResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustAccountMergeResult() AccountMergeResult {
	val, ok := u.GetAccountMergeResult()

	if !ok {
		panic("arm AccountMergeResult is not set")
	}

	return val
}

// GetAccountMergeResult retrieves the AccountMergeResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetAccountMergeResult() (result AccountMergeResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "AccountMergeResult" {
		result = *u.AccountMergeResult
		ok = true
	}

	return
}

// MustInflationResult retrieves the InflationResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustInflationResult() InflationResult {
	val, ok := u.GetInflationResult()

	if !ok {
		panic("arm InflationResult is not set")
	}

	return val
}

// GetInflationResult retrieves the InflationResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetInflationResult() (result InflationResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "InflationResult" {
		result = *u.InflationResult
		ok = true
	}

	return
}

// MustManageDataResult retrieves the ManageDataResult value from the union,
// panicing if the value is not set.
func (u OperationResultTr) MustManageDataResult() ManageDataResult {
	val, ok := u.GetManageDataResult()

	if !ok {
		panic("arm ManageDataResult is not set")
	}

	return val
}

// GetManageDataResult retrieves the ManageDataResult value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResultTr) GetManageDataResult() (result ManageDataResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "ManageDataResult" {
		result = *u.ManageDataResult
		ok = true
	}

	return
}

// OperationResult is an XDR Union defines as:
//
//   union OperationResult switch (OperationResultCode code)
//    {
//    case opINNER:
//        union switch (OperationType type)
//        {
//        case CREATE_ACCOUNT:
//            CreateAccountResult createAccountResult;
//        case PAYMENT:
//            PaymentResult paymentResult;
//        case PATH_PAYMENT:
//            PathPaymentResult pathPaymentResult;
//        case MANAGE_OFFER:
//            ManageOfferResult manageOfferResult;
//        case CREATE_PASSIVE_OFFER:
//            ManageOfferResult createPassiveOfferResult;
//        case SET_OPTIONS:
//            SetOptionsResult setOptionsResult;
//        case CHANGE_TRUST:
//            ChangeTrustResult changeTrustResult;
//        case ALLOW_TRUST:
//            AllowTrustResult allowTrustResult;
//        case ACCOUNT_MERGE:
//            AccountMergeResult accountMergeResult;
//        case INFLATION:
//            InflationResult inflationResult;
//        case MANAGE_DATA:
//            ManageDataResult manageDataResult;
//        }
//        tr;
//    default:
//        void;
//    };
//
type OperationResult struct {
	Code OperationResultCode
	Tr   *OperationResultTr
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u OperationResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of OperationResult
func (u OperationResult) ArmForSwitch(sw int32) (string, bool) {
	switch OperationResultCode(sw) {
	case OperationResultCodeOpInner:
		return "Tr", true
	default:
		return "", true
	}
}

// NewOperationResult creates a new  OperationResult.
func NewOperationResult(code OperationResultCode, value interface{}) (result OperationResult, err error) {
	result.Code = code
	switch OperationResultCode(code) {
	case OperationResultCodeOpInner:
		tv, ok := value.(OperationResultTr)
		if !ok {
			err = fmt.Errorf("invalid value, must be OperationResultTr")
			return
		}
		result.Tr = &tv
	default:
		// void
	}
	return
}

// MustTr retrieves the Tr value from the union,
// panicing if the value is not set.
func (u OperationResult) MustTr() OperationResultTr {
	val, ok := u.GetTr()

	if !ok {
		panic("arm Tr is not set")
	}

	return val
}

// GetTr retrieves the Tr value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u OperationResult) GetTr() (result OperationResultTr, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Code))

	if armName == "Tr" {
		result = *u.Tr
		ok = true
	}

	return
}

// TransactionResultCode is an XDR Enum defines as:
//
//   enum TransactionResultCode
//    {
//        txSUCCESS = 0, // all operations succeeded
//
//        txFAILED = -1, // one of the operations failed (none were applied)
//
//        txTOO_EARLY = -2,         // ledger closeTime before minTime
//        txTOO_LATE = -3,          // ledger closeTime after maxTime
//        txMISSING_OPERATION = -4, // no operation was specified
//        txBAD_SEQ = -5,           // sequence number does not match source account
//
//        txBAD_AUTH = -6,             // too few valid signatures / wrong network
//        txINSUFFICIENT_BALANCE = -7, // fee would bring account below reserve
//        txNO_ACCOUNT = -8,           // source account not found
//        txINSUFFICIENT_FEE = -9,     // fee is too small
//        txBAD_AUTH_EXTRA = -10,      // unused signatures attached to transaction
//        txINTERNAL_ERROR = -11       // an unknown error occured
//    };
//
type TransactionResultCode int32

const (
	TransactionResultCodeTxSuccess             TransactionResultCode = 0
	TransactionResultCodeTxFailed              TransactionResultCode = -1
	TransactionResultCodeTxTooEarly            TransactionResultCode = -2
	TransactionResultCodeTxTooLate             TransactionResultCode = -3
	TransactionResultCodeTxMissingOperation    TransactionResultCode = -4
	TransactionResultCodeTxBadSeq              TransactionResultCode = -5
	TransactionResultCodeTxBadAuth             TransactionResultCode = -6
	TransactionResultCodeTxInsufficientBalance TransactionResultCode = -7
	TransactionResultCodeTxNoAccount           TransactionResultCode = -8
	TransactionResultCodeTxInsufficientFee     TransactionResultCode = -9
	TransactionResultCodeTxBadAuthExtra        TransactionResultCode = -10
	TransactionResultCodeTxInternalError       TransactionResultCode = -11
)

var transactionResultCodeMap = map[int32]string{
	0:   "TransactionResultCodeTxSuccess",
	-1:  "TransactionResultCodeTxFailed",
	-2:  "TransactionResultCodeTxTooEarly",
	-3:  "TransactionResultCodeTxTooLate",
	-4:  "TransactionResultCodeTxMissingOperation",
	-5:  "TransactionResultCodeTxBadSeq",
	-6:  "TransactionResultCodeTxBadAuth",
	-7:  "TransactionResultCodeTxInsufficientBalance",
	-8:  "TransactionResultCodeTxNoAccount",
	-9:  "TransactionResultCodeTxInsufficientFee",
	-10: "TransactionResultCodeTxBadAuthExtra",
	-11: "TransactionResultCodeTxInternalError",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for TransactionResultCode
func (e TransactionResultCode) ValidEnum(v int32) bool {
	_, ok := transactionResultCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e TransactionResultCode) String() string {
	name, _ := transactionResultCodeMap[int32(e)]
	return name
}

// TransactionResultResult is an XDR NestedUnion defines as:
//
//   union switch (TransactionResultCode code)
//        {
//        case txSUCCESS:
//        case txFAILED:
//            OperationResult results<>;
//        default:
//            void;
//        }
//
type TransactionResultResult struct {
	Code    TransactionResultCode
	Results *[]OperationResult
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TransactionResultResult) SwitchFieldName() string {
	return "Code"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TransactionResultResult
func (u TransactionResultResult) ArmForSwitch(sw int32) (string, bool) {
	switch TransactionResultCode(sw) {
	case TransactionResultCodeTxSuccess:
		return "Results", true
	case TransactionResultCodeTxFailed:
		return "Results", true
	default:
		return "", true
	}
}

// NewTransactionResultResult creates a new  TransactionResultResult.
func NewTransactionResultResult(code TransactionResultCode, value interface{}) (result TransactionResultResult, err error) {
	result.Code = code
	switch TransactionResultCode(code) {
	case TransactionResultCodeTxSuccess:
		tv, ok := value.([]OperationResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be []OperationResult")
			return
		}
		result.Results = &tv
	case TransactionResultCodeTxFailed:
		tv, ok := value.([]OperationResult)
		if !ok {
			err = fmt.Errorf("invalid value, must be []OperationResult")
			return
		}
		result.Results = &tv
	default:
		// void
	}
	return
}

// MustResults retrieves the Results value from the union,
// panicing if the value is not set.
func (u TransactionResultResult) MustResults() []OperationResult {
	val, ok := u.GetResults()

	if !ok {
		panic("arm Results is not set")
	}

	return val
}

// GetResults retrieves the Results value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u TransactionResultResult) GetResults() (result []OperationResult, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Code))

	if armName == "Results" {
		result = *u.Results
		ok = true
	}

	return
}

// TransactionResultExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type TransactionResultExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TransactionResultExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TransactionResultExt
func (u TransactionResultExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewTransactionResultExt creates a new  TransactionResultExt.
func NewTransactionResultExt(v int32, value interface{}) (result TransactionResultExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// TransactionResult is an XDR Struct defines as:
//
//   struct TransactionResult
//    {
//        int64 feeCharged; // actual fee charged for the transaction
//
//        union switch (TransactionResultCode code)
//        {
//        case txSUCCESS:
//        case txFAILED:
//            OperationResult results<>;
//        default:
//            void;
//        }
//        result;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type TransactionResult struct {
	FeeCharged Int64
	Result     TransactionResultResult
	Ext        TransactionResultExt
}

// UpgradeType is an XDR Typedef defines as:
//
//   typedef opaque UpgradeType<128>;
//
type UpgradeType []byte

// XDRMaxSize implements the Sized interface for UpgradeType
func (e UpgradeType) XDRMaxSize() int {
	return 128
}

// StellarValueExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type StellarValueExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u StellarValueExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of StellarValueExt
func (u StellarValueExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewStellarValueExt creates a new  StellarValueExt.
func NewStellarValueExt(v int32, value interface{}) (result StellarValueExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// StellarValue is an XDR Struct defines as:
//
//   struct StellarValue
//    {
//        Hash txSetHash;   // transaction set to apply to previous ledger
//        uint64 closeTime; // network close time
//
//        // upgrades to apply to the previous ledger (usually empty)
//        // this is a vector of encoded 'LedgerUpgrade' so that nodes can drop
//        // unknown steps during consensus if needed.
//        // see notes below on 'LedgerUpgrade' for more detail
//        // max size is dictated by number of upgrade types (+ room for future)
//        UpgradeType upgrades<6>;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type StellarValue struct {
	TxSetHash Hash
	CloseTime Uint64
	Upgrades  []UpgradeType `xdrmaxsize:"6"`
	Ext       StellarValueExt
}

// LedgerHeaderExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type LedgerHeaderExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u LedgerHeaderExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of LedgerHeaderExt
func (u LedgerHeaderExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewLedgerHeaderExt creates a new  LedgerHeaderExt.
func NewLedgerHeaderExt(v int32, value interface{}) (result LedgerHeaderExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// LedgerHeader is an XDR Struct defines as:
//
//   struct LedgerHeader
//    {
//        uint32 ledgerVersion;    // the protocol version of the ledger
//        Hash previousLedgerHash; // hash of the previous ledger header
//        StellarValue scpValue;   // what consensus agreed to
//        Hash txSetResultHash;    // the TransactionResultSet that led to this ledger
//        Hash bucketListHash;     // hash of the ledger state
//
//        uint32 ledgerSeq; // sequence number of this ledger
//
//        int64 totalCoins; // total number of stroops in existence.
//                          // 10,000,000 stroops in 1 XLM
//
//        int64 feePool;       // fees burned since last inflation run
//        uint32 inflationSeq; // inflation sequence number
//
//        uint64 idPool; // last used global ID, used for generating objects
//
//        uint32 baseFee;     // base fee per operation in stroops
//        uint32 baseReserve; // account base reserve in stroops
//
//        uint32 maxTxSetSize; // maximum size a transaction set can be
//
//        Hash skipList[4]; // hashes of ledgers in the past. allows you to jump back
//                          // in time without walking the chain back ledger by ledger
//                          // each slot contains the oldest ledger that is mod of
//                          // either 50  5000  50000 or 500000 depending on index
//                          // skipList[0] mod(50), skipList[1] mod(5000), etc
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type LedgerHeader struct {
	LedgerVersion      Uint32
	PreviousLedgerHash Hash
	ScpValue           StellarValue
	TxSetResultHash    Hash
	BucketListHash     Hash
	LedgerSeq          Uint32
	TotalCoins         Int64
	FeePool            Int64
	InflationSeq       Uint32
	IdPool             Uint64
	BaseFee            Uint32
	BaseReserve        Uint32
	MaxTxSetSize       Uint32
	SkipList           [4]Hash
	Ext                LedgerHeaderExt
}

// LedgerUpgradeType is an XDR Enum defines as:
//
//   enum LedgerUpgradeType
//    {
//        LEDGER_UPGRADE_VERSION = 1,
//        LEDGER_UPGRADE_BASE_FEE = 2,
//        LEDGER_UPGRADE_MAX_TX_SET_SIZE = 3
//    };
//
type LedgerUpgradeType int32

const (
	LedgerUpgradeTypeLedgerUpgradeVersion      LedgerUpgradeType = 1
	LedgerUpgradeTypeLedgerUpgradeBaseFee      LedgerUpgradeType = 2
	LedgerUpgradeTypeLedgerUpgradeMaxTxSetSize LedgerUpgradeType = 3
)

var ledgerUpgradeTypeMap = map[int32]string{
	1: "LedgerUpgradeTypeLedgerUpgradeVersion",
	2: "LedgerUpgradeTypeLedgerUpgradeBaseFee",
	3: "LedgerUpgradeTypeLedgerUpgradeMaxTxSetSize",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for LedgerUpgradeType
func (e LedgerUpgradeType) ValidEnum(v int32) bool {
	_, ok := ledgerUpgradeTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e LedgerUpgradeType) String() string {
	name, _ := ledgerUpgradeTypeMap[int32(e)]
	return name
}

// LedgerUpgrade is an XDR Union defines as:
//
//   union LedgerUpgrade switch (LedgerUpgradeType type)
//    {
//    case LEDGER_UPGRADE_VERSION:
//        uint32 newLedgerVersion; // update ledgerVersion
//    case LEDGER_UPGRADE_BASE_FEE:
//        uint32 newBaseFee; // update baseFee
//    case LEDGER_UPGRADE_MAX_TX_SET_SIZE:
//        uint32 newMaxTxSetSize; // update maxTxSetSize
//    };
//
type LedgerUpgrade struct {
	Type             LedgerUpgradeType
	NewLedgerVersion *Uint32
	NewBaseFee       *Uint32
	NewMaxTxSetSize  *Uint32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u LedgerUpgrade) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of LedgerUpgrade
func (u LedgerUpgrade) ArmForSwitch(sw int32) (string, bool) {
	switch LedgerUpgradeType(sw) {
	case LedgerUpgradeTypeLedgerUpgradeVersion:
		return "NewLedgerVersion", true
	case LedgerUpgradeTypeLedgerUpgradeBaseFee:
		return "NewBaseFee", true
	case LedgerUpgradeTypeLedgerUpgradeMaxTxSetSize:
		return "NewMaxTxSetSize", true
	}
	return "-", false
}

// NewLedgerUpgrade creates a new  LedgerUpgrade.
func NewLedgerUpgrade(aType LedgerUpgradeType, value interface{}) (result LedgerUpgrade, err error) {
	result.Type = aType
	switch LedgerUpgradeType(aType) {
	case LedgerUpgradeTypeLedgerUpgradeVersion:
		tv, ok := value.(Uint32)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint32")
			return
		}
		result.NewLedgerVersion = &tv
	case LedgerUpgradeTypeLedgerUpgradeBaseFee:
		tv, ok := value.(Uint32)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint32")
			return
		}
		result.NewBaseFee = &tv
	case LedgerUpgradeTypeLedgerUpgradeMaxTxSetSize:
		tv, ok := value.(Uint32)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint32")
			return
		}
		result.NewMaxTxSetSize = &tv
	}
	return
}

// MustNewLedgerVersion retrieves the NewLedgerVersion value from the union,
// panicing if the value is not set.
func (u LedgerUpgrade) MustNewLedgerVersion() Uint32 {
	val, ok := u.GetNewLedgerVersion()

	if !ok {
		panic("arm NewLedgerVersion is not set")
	}

	return val
}

// GetNewLedgerVersion retrieves the NewLedgerVersion value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerUpgrade) GetNewLedgerVersion() (result Uint32, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "NewLedgerVersion" {
		result = *u.NewLedgerVersion
		ok = true
	}

	return
}

// MustNewBaseFee retrieves the NewBaseFee value from the union,
// panicing if the value is not set.
func (u LedgerUpgrade) MustNewBaseFee() Uint32 {
	val, ok := u.GetNewBaseFee()

	if !ok {
		panic("arm NewBaseFee is not set")
	}

	return val
}

// GetNewBaseFee retrieves the NewBaseFee value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerUpgrade) GetNewBaseFee() (result Uint32, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "NewBaseFee" {
		result = *u.NewBaseFee
		ok = true
	}

	return
}

// MustNewMaxTxSetSize retrieves the NewMaxTxSetSize value from the union,
// panicing if the value is not set.
func (u LedgerUpgrade) MustNewMaxTxSetSize() Uint32 {
	val, ok := u.GetNewMaxTxSetSize()

	if !ok {
		panic("arm NewMaxTxSetSize is not set")
	}

	return val
}

// GetNewMaxTxSetSize retrieves the NewMaxTxSetSize value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerUpgrade) GetNewMaxTxSetSize() (result Uint32, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "NewMaxTxSetSize" {
		result = *u.NewMaxTxSetSize
		ok = true
	}

	return
}

// LedgerKeyAccount is an XDR NestedStruct defines as:
//
//   struct
//        {
//            AccountID accountID;
//        }
//
type LedgerKeyAccount struct {
	AccountId AccountId
}

// LedgerKeyTrustLine is an XDR NestedStruct defines as:
//
//   struct
//        {
//            AccountID accountID;
//            Asset asset;
//        }
//
type LedgerKeyTrustLine struct {
	AccountId AccountId
	Asset     Asset
}

// LedgerKeyOffer is an XDR NestedStruct defines as:
//
//   struct
//        {
//            AccountID sellerID;
//            uint64 offerID;
//        }
//
type LedgerKeyOffer struct {
	SellerId AccountId
	OfferId  Uint64
}

// LedgerKeyData is an XDR NestedStruct defines as:
//
//   struct
//        {
//            AccountID accountID;
//            string64 dataName;
//        }
//
type LedgerKeyData struct {
	AccountId AccountId
	DataName  String64
}

// LedgerKey is an XDR Union defines as:
//
//   union LedgerKey switch (LedgerEntryType type)
//    {
//    case ACCOUNT:
//        struct
//        {
//            AccountID accountID;
//        } account;
//
//    case TRUSTLINE:
//        struct
//        {
//            AccountID accountID;
//            Asset asset;
//        } trustLine;
//
//    case OFFER:
//        struct
//        {
//            AccountID sellerID;
//            uint64 offerID;
//        } offer;
//
//    case DATA:
//        struct
//        {
//            AccountID accountID;
//            string64 dataName;
//        } data;
//    };
//
type LedgerKey struct {
	Type      LedgerEntryType
	Account   *LedgerKeyAccount
	TrustLine *LedgerKeyTrustLine
	Offer     *LedgerKeyOffer
	Data      *LedgerKeyData
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u LedgerKey) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of LedgerKey
func (u LedgerKey) ArmForSwitch(sw int32) (string, bool) {
	switch LedgerEntryType(sw) {
	case LedgerEntryTypeAccount:
		return "Account", true
	case LedgerEntryTypeTrustline:
		return "TrustLine", true
	case LedgerEntryTypeOffer:
		return "Offer", true
	case LedgerEntryTypeData:
		return "Data", true
	}
	return "-", false
}

// NewLedgerKey creates a new  LedgerKey.
func NewLedgerKey(aType LedgerEntryType, value interface{}) (result LedgerKey, err error) {
	result.Type = aType
	switch LedgerEntryType(aType) {
	case LedgerEntryTypeAccount:
		tv, ok := value.(LedgerKeyAccount)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerKeyAccount")
			return
		}
		result.Account = &tv
	case LedgerEntryTypeTrustline:
		tv, ok := value.(LedgerKeyTrustLine)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerKeyTrustLine")
			return
		}
		result.TrustLine = &tv
	case LedgerEntryTypeOffer:
		tv, ok := value.(LedgerKeyOffer)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerKeyOffer")
			return
		}
		result.Offer = &tv
	case LedgerEntryTypeData:
		tv, ok := value.(LedgerKeyData)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerKeyData")
			return
		}
		result.Data = &tv
	}
	return
}

// MustAccount retrieves the Account value from the union,
// panicing if the value is not set.
func (u LedgerKey) MustAccount() LedgerKeyAccount {
	val, ok := u.GetAccount()

	if !ok {
		panic("arm Account is not set")
	}

	return val
}

// GetAccount retrieves the Account value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerKey) GetAccount() (result LedgerKeyAccount, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Account" {
		result = *u.Account
		ok = true
	}

	return
}

// MustTrustLine retrieves the TrustLine value from the union,
// panicing if the value is not set.
func (u LedgerKey) MustTrustLine() LedgerKeyTrustLine {
	val, ok := u.GetTrustLine()

	if !ok {
		panic("arm TrustLine is not set")
	}

	return val
}

// GetTrustLine retrieves the TrustLine value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerKey) GetTrustLine() (result LedgerKeyTrustLine, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "TrustLine" {
		result = *u.TrustLine
		ok = true
	}

	return
}

// MustOffer retrieves the Offer value from the union,
// panicing if the value is not set.
func (u LedgerKey) MustOffer() LedgerKeyOffer {
	val, ok := u.GetOffer()

	if !ok {
		panic("arm Offer is not set")
	}

	return val
}

// GetOffer retrieves the Offer value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerKey) GetOffer() (result LedgerKeyOffer, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Offer" {
		result = *u.Offer
		ok = true
	}

	return
}

// MustData retrieves the Data value from the union,
// panicing if the value is not set.
func (u LedgerKey) MustData() LedgerKeyData {
	val, ok := u.GetData()

	if !ok {
		panic("arm Data is not set")
	}

	return val
}

// GetData retrieves the Data value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerKey) GetData() (result LedgerKeyData, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Data" {
		result = *u.Data
		ok = true
	}

	return
}

// BucketEntryType is an XDR Enum defines as:
//
//   enum BucketEntryType
//    {
//        LIVEENTRY = 0,
//        DEADENTRY = 1
//    };
//
type BucketEntryType int32

const (
	BucketEntryTypeLiveentry BucketEntryType = 0
	BucketEntryTypeDeadentry BucketEntryType = 1
)

var bucketEntryTypeMap = map[int32]string{
	0: "BucketEntryTypeLiveentry",
	1: "BucketEntryTypeDeadentry",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for BucketEntryType
func (e BucketEntryType) ValidEnum(v int32) bool {
	_, ok := bucketEntryTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e BucketEntryType) String() string {
	name, _ := bucketEntryTypeMap[int32(e)]
	return name
}

// BucketEntry is an XDR Union defines as:
//
//   union BucketEntry switch (BucketEntryType type)
//    {
//    case LIVEENTRY:
//        LedgerEntry liveEntry;
//
//    case DEADENTRY:
//        LedgerKey deadEntry;
//    };
//
type BucketEntry struct {
	Type      BucketEntryType
	LiveEntry *LedgerEntry
	DeadEntry *LedgerKey
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u BucketEntry) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of BucketEntry
func (u BucketEntry) ArmForSwitch(sw int32) (string, bool) {
	switch BucketEntryType(sw) {
	case BucketEntryTypeLiveentry:
		return "LiveEntry", true
	case BucketEntryTypeDeadentry:
		return "DeadEntry", true
	}
	return "-", false
}

// NewBucketEntry creates a new  BucketEntry.
func NewBucketEntry(aType BucketEntryType, value interface{}) (result BucketEntry, err error) {
	result.Type = aType
	switch BucketEntryType(aType) {
	case BucketEntryTypeLiveentry:
		tv, ok := value.(LedgerEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerEntry")
			return
		}
		result.LiveEntry = &tv
	case BucketEntryTypeDeadentry:
		tv, ok := value.(LedgerKey)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerKey")
			return
		}
		result.DeadEntry = &tv
	}
	return
}

// MustLiveEntry retrieves the LiveEntry value from the union,
// panicing if the value is not set.
func (u BucketEntry) MustLiveEntry() LedgerEntry {
	val, ok := u.GetLiveEntry()

	if !ok {
		panic("arm LiveEntry is not set")
	}

	return val
}

// GetLiveEntry retrieves the LiveEntry value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u BucketEntry) GetLiveEntry() (result LedgerEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "LiveEntry" {
		result = *u.LiveEntry
		ok = true
	}

	return
}

// MustDeadEntry retrieves the DeadEntry value from the union,
// panicing if the value is not set.
func (u BucketEntry) MustDeadEntry() LedgerKey {
	val, ok := u.GetDeadEntry()

	if !ok {
		panic("arm DeadEntry is not set")
	}

	return val
}

// GetDeadEntry retrieves the DeadEntry value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u BucketEntry) GetDeadEntry() (result LedgerKey, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "DeadEntry" {
		result = *u.DeadEntry
		ok = true
	}

	return
}

// TransactionSet is an XDR Struct defines as:
//
//   struct TransactionSet
//    {
//        Hash previousLedgerHash;
//        TransactionEnvelope txs<>;
//    };
//
type TransactionSet struct {
	PreviousLedgerHash Hash
	Txs                []TransactionEnvelope
}

// TransactionResultPair is an XDR Struct defines as:
//
//   struct TransactionResultPair
//    {
//        Hash transactionHash;
//        TransactionResult result; // result for the transaction
//    };
//
type TransactionResultPair struct {
	TransactionHash Hash
	Result          TransactionResult
}

// TransactionResultSet is an XDR Struct defines as:
//
//   struct TransactionResultSet
//    {
//        TransactionResultPair results<>;
//    };
//
type TransactionResultSet struct {
	Results []TransactionResultPair
}

// TransactionHistoryEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type TransactionHistoryEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TransactionHistoryEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TransactionHistoryEntryExt
func (u TransactionHistoryEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewTransactionHistoryEntryExt creates a new  TransactionHistoryEntryExt.
func NewTransactionHistoryEntryExt(v int32, value interface{}) (result TransactionHistoryEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// TransactionHistoryEntry is an XDR Struct defines as:
//
//   struct TransactionHistoryEntry
//    {
//        uint32 ledgerSeq;
//        TransactionSet txSet;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type TransactionHistoryEntry struct {
	LedgerSeq Uint32
	TxSet     TransactionSet
	Ext       TransactionHistoryEntryExt
}

// TransactionHistoryResultEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type TransactionHistoryResultEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TransactionHistoryResultEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TransactionHistoryResultEntryExt
func (u TransactionHistoryResultEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewTransactionHistoryResultEntryExt creates a new  TransactionHistoryResultEntryExt.
func NewTransactionHistoryResultEntryExt(v int32, value interface{}) (result TransactionHistoryResultEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// TransactionHistoryResultEntry is an XDR Struct defines as:
//
//   struct TransactionHistoryResultEntry
//    {
//        uint32 ledgerSeq;
//        TransactionResultSet txResultSet;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type TransactionHistoryResultEntry struct {
	LedgerSeq   Uint32
	TxResultSet TransactionResultSet
	Ext         TransactionHistoryResultEntryExt
}

// LedgerHeaderHistoryEntryExt is an XDR NestedUnion defines as:
//
//   union switch (int v)
//        {
//        case 0:
//            void;
//        }
//
type LedgerHeaderHistoryEntryExt struct {
	V int32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u LedgerHeaderHistoryEntryExt) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of LedgerHeaderHistoryEntryExt
func (u LedgerHeaderHistoryEntryExt) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "", true
	}
	return "-", false
}

// NewLedgerHeaderHistoryEntryExt creates a new  LedgerHeaderHistoryEntryExt.
func NewLedgerHeaderHistoryEntryExt(v int32, value interface{}) (result LedgerHeaderHistoryEntryExt, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		// void
	}
	return
}

// LedgerHeaderHistoryEntry is an XDR Struct defines as:
//
//   struct LedgerHeaderHistoryEntry
//    {
//        Hash hash;
//        LedgerHeader header;
//
//        // reserved for future use
//        union switch (int v)
//        {
//        case 0:
//            void;
//        }
//        ext;
//    };
//
type LedgerHeaderHistoryEntry struct {
	Hash   Hash
	Header LedgerHeader
	Ext    LedgerHeaderHistoryEntryExt
}

// LedgerScpMessages is an XDR Struct defines as:
//
//   struct LedgerSCPMessages
//    {
//        uint32 ledgerSeq;
//        SCPEnvelope messages<>;
//    };
//
type LedgerScpMessages struct {
	LedgerSeq Uint32
	Messages  []ScpEnvelope
}

// ScpHistoryEntryV0 is an XDR Struct defines as:
//
//   struct SCPHistoryEntryV0
//    {
//        SCPQuorumSet quorumSets<>; // additional quorum sets used by ledgerMessages
//        LedgerSCPMessages ledgerMessages;
//    };
//
type ScpHistoryEntryV0 struct {
	QuorumSets     []ScpQuorumSet
	LedgerMessages LedgerScpMessages
}

// ScpHistoryEntry is an XDR Union defines as:
//
//   union SCPHistoryEntry switch (int v)
//    {
//    case 0:
//        SCPHistoryEntryV0 v0;
//    };
//
type ScpHistoryEntry struct {
	V  int32
	V0 *ScpHistoryEntryV0
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u ScpHistoryEntry) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of ScpHistoryEntry
func (u ScpHistoryEntry) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "V0", true
	}
	return "-", false
}

// NewScpHistoryEntry creates a new  ScpHistoryEntry.
func NewScpHistoryEntry(v int32, value interface{}) (result ScpHistoryEntry, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		tv, ok := value.(ScpHistoryEntryV0)
		if !ok {
			err = fmt.Errorf("invalid value, must be ScpHistoryEntryV0")
			return
		}
		result.V0 = &tv
	}
	return
}

// MustV0 retrieves the V0 value from the union,
// panicing if the value is not set.
func (u ScpHistoryEntry) MustV0() ScpHistoryEntryV0 {
	val, ok := u.GetV0()

	if !ok {
		panic("arm V0 is not set")
	}

	return val
}

// GetV0 retrieves the V0 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u ScpHistoryEntry) GetV0() (result ScpHistoryEntryV0, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.V))

	if armName == "V0" {
		result = *u.V0
		ok = true
	}

	return
}

// LedgerEntryChangeType is an XDR Enum defines as:
//
//   enum LedgerEntryChangeType
//    {
//        LEDGER_ENTRY_CREATED = 0, // entry was added to the ledger
//        LEDGER_ENTRY_UPDATED = 1, // entry was modified in the ledger
//        LEDGER_ENTRY_REMOVED = 2, // entry was removed from the ledger
//        LEDGER_ENTRY_STATE = 3    // value of the entry
//    };
//
type LedgerEntryChangeType int32

const (
	LedgerEntryChangeTypeLedgerEntryCreated LedgerEntryChangeType = 0
	LedgerEntryChangeTypeLedgerEntryUpdated LedgerEntryChangeType = 1
	LedgerEntryChangeTypeLedgerEntryRemoved LedgerEntryChangeType = 2
	LedgerEntryChangeTypeLedgerEntryState   LedgerEntryChangeType = 3
)

var ledgerEntryChangeTypeMap = map[int32]string{
	0: "LedgerEntryChangeTypeLedgerEntryCreated",
	1: "LedgerEntryChangeTypeLedgerEntryUpdated",
	2: "LedgerEntryChangeTypeLedgerEntryRemoved",
	3: "LedgerEntryChangeTypeLedgerEntryState",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for LedgerEntryChangeType
func (e LedgerEntryChangeType) ValidEnum(v int32) bool {
	_, ok := ledgerEntryChangeTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e LedgerEntryChangeType) String() string {
	name, _ := ledgerEntryChangeTypeMap[int32(e)]
	return name
}

// LedgerEntryChange is an XDR Union defines as:
//
//   union LedgerEntryChange switch (LedgerEntryChangeType type)
//    {
//    case LEDGER_ENTRY_CREATED:
//        LedgerEntry created;
//    case LEDGER_ENTRY_UPDATED:
//        LedgerEntry updated;
//    case LEDGER_ENTRY_REMOVED:
//        LedgerKey removed;
//    case LEDGER_ENTRY_STATE:
//        LedgerEntry state;
//    };
//
type LedgerEntryChange struct {
	Type    LedgerEntryChangeType
	Created *LedgerEntry
	Updated *LedgerEntry
	Removed *LedgerKey
	State   *LedgerEntry
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u LedgerEntryChange) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of LedgerEntryChange
func (u LedgerEntryChange) ArmForSwitch(sw int32) (string, bool) {
	switch LedgerEntryChangeType(sw) {
	case LedgerEntryChangeTypeLedgerEntryCreated:
		return "Created", true
	case LedgerEntryChangeTypeLedgerEntryUpdated:
		return "Updated", true
	case LedgerEntryChangeTypeLedgerEntryRemoved:
		return "Removed", true
	case LedgerEntryChangeTypeLedgerEntryState:
		return "State", true
	}
	return "-", false
}

// NewLedgerEntryChange creates a new  LedgerEntryChange.
func NewLedgerEntryChange(aType LedgerEntryChangeType, value interface{}) (result LedgerEntryChange, err error) {
	result.Type = aType
	switch LedgerEntryChangeType(aType) {
	case LedgerEntryChangeTypeLedgerEntryCreated:
		tv, ok := value.(LedgerEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerEntry")
			return
		}
		result.Created = &tv
	case LedgerEntryChangeTypeLedgerEntryUpdated:
		tv, ok := value.(LedgerEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerEntry")
			return
		}
		result.Updated = &tv
	case LedgerEntryChangeTypeLedgerEntryRemoved:
		tv, ok := value.(LedgerKey)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerKey")
			return
		}
		result.Removed = &tv
	case LedgerEntryChangeTypeLedgerEntryState:
		tv, ok := value.(LedgerEntry)
		if !ok {
			err = fmt.Errorf("invalid value, must be LedgerEntry")
			return
		}
		result.State = &tv
	}
	return
}

// MustCreated retrieves the Created value from the union,
// panicing if the value is not set.
func (u LedgerEntryChange) MustCreated() LedgerEntry {
	val, ok := u.GetCreated()

	if !ok {
		panic("arm Created is not set")
	}

	return val
}

// GetCreated retrieves the Created value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryChange) GetCreated() (result LedgerEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Created" {
		result = *u.Created
		ok = true
	}

	return
}

// MustUpdated retrieves the Updated value from the union,
// panicing if the value is not set.
func (u LedgerEntryChange) MustUpdated() LedgerEntry {
	val, ok := u.GetUpdated()

	if !ok {
		panic("arm Updated is not set")
	}

	return val
}

// GetUpdated retrieves the Updated value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryChange) GetUpdated() (result LedgerEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Updated" {
		result = *u.Updated
		ok = true
	}

	return
}

// MustRemoved retrieves the Removed value from the union,
// panicing if the value is not set.
func (u LedgerEntryChange) MustRemoved() LedgerKey {
	val, ok := u.GetRemoved()

	if !ok {
		panic("arm Removed is not set")
	}

	return val
}

// GetRemoved retrieves the Removed value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryChange) GetRemoved() (result LedgerKey, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Removed" {
		result = *u.Removed
		ok = true
	}

	return
}

// MustState retrieves the State value from the union,
// panicing if the value is not set.
func (u LedgerEntryChange) MustState() LedgerEntry {
	val, ok := u.GetState()

	if !ok {
		panic("arm State is not set")
	}

	return val
}

// GetState retrieves the State value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u LedgerEntryChange) GetState() (result LedgerEntry, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "State" {
		result = *u.State
		ok = true
	}

	return
}

// LedgerEntryChanges is an XDR Typedef defines as:
//
//   typedef LedgerEntryChange LedgerEntryChanges<>;
//
type LedgerEntryChanges []LedgerEntryChange

// OperationMeta is an XDR Struct defines as:
//
//   struct OperationMeta
//    {
//        LedgerEntryChanges changes;
//    };
//
type OperationMeta struct {
	Changes LedgerEntryChanges
}

// TransactionMeta is an XDR Union defines as:
//
//   union TransactionMeta switch (int v)
//    {
//    case 0:
//        OperationMeta operations<>;
//    };
//
type TransactionMeta struct {
	V          int32
	Operations *[]OperationMeta
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u TransactionMeta) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of TransactionMeta
func (u TransactionMeta) ArmForSwitch(sw int32) (string, bool) {
	switch int32(sw) {
	case 0:
		return "Operations", true
	}
	return "-", false
}

// NewTransactionMeta creates a new  TransactionMeta.
func NewTransactionMeta(v int32, value interface{}) (result TransactionMeta, err error) {
	result.V = v
	switch int32(v) {
	case 0:
		tv, ok := value.([]OperationMeta)
		if !ok {
			err = fmt.Errorf("invalid value, must be []OperationMeta")
			return
		}
		result.Operations = &tv
	}
	return
}

// MustOperations retrieves the Operations value from the union,
// panicing if the value is not set.
func (u TransactionMeta) MustOperations() []OperationMeta {
	val, ok := u.GetOperations()

	if !ok {
		panic("arm Operations is not set")
	}

	return val
}

// GetOperations retrieves the Operations value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u TransactionMeta) GetOperations() (result []OperationMeta, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.V))

	if armName == "Operations" {
		result = *u.Operations
		ok = true
	}

	return
}

// ErrorCode is an XDR Enum defines as:
//
//   enum ErrorCode
//    {
//        ERR_MISC = 0, // Unspecific error
//        ERR_DATA = 1, // Malformed data
//        ERR_CONF = 2, // Misconfiguration error
//        ERR_AUTH = 3, // Authentication failure
//        ERR_LOAD = 4  // System overloaded
//    };
//
type ErrorCode int32

const (
	ErrorCodeErrMisc ErrorCode = 0
	ErrorCodeErrData ErrorCode = 1
	ErrorCodeErrConf ErrorCode = 2
	ErrorCodeErrAuth ErrorCode = 3
	ErrorCodeErrLoad ErrorCode = 4
)

var errorCodeMap = map[int32]string{
	0: "ErrorCodeErrMisc",
	1: "ErrorCodeErrData",
	2: "ErrorCodeErrConf",
	3: "ErrorCodeErrAuth",
	4: "ErrorCodeErrLoad",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for ErrorCode
func (e ErrorCode) ValidEnum(v int32) bool {
	_, ok := errorCodeMap[v]
	return ok
}

// String returns the name of `e`
func (e ErrorCode) String() string {
	name, _ := errorCodeMap[int32(e)]
	return name
}

// Error is an XDR Struct defines as:
//
//   struct Error
//    {
//        ErrorCode code;
//        string msg<100>;
//    };
//
type Error struct {
	Code ErrorCode
	Msg  string `xdrmaxsize:"100"`
}

// AuthCert is an XDR Struct defines as:
//
//   struct AuthCert
//    {
//        Curve25519Public pubkey;
//        uint64 expiration;
//        Signature sig;
//    };
//
type AuthCert struct {
	Pubkey     Curve25519Public
	Expiration Uint64
	Sig        Signature
}

// Hello is an XDR Struct defines as:
//
//   struct Hello
//    {
//        uint32 ledgerVersion;
//        uint32 overlayVersion;
//        uint32 overlayMinVersion;
//        Hash networkID;
//        string versionStr<100>;
//        int listeningPort;
//        NodeID peerID;
//        AuthCert cert;
//        uint256 nonce;
//    };
//
type Hello struct {
	LedgerVersion     Uint32
	OverlayVersion    Uint32
	OverlayMinVersion Uint32
	NetworkId         Hash
	VersionStr        string `xdrmaxsize:"100"`
	ListeningPort     int32
	PeerId            NodeId
	Cert              AuthCert
	Nonce             Uint256
}

// Auth is an XDR Struct defines as:
//
//   struct Auth
//    {
//        // Empty message, just to confirm
//        // establishment of MAC keys.
//        int unused;
//    };
//
type Auth struct {
	Unused int32
}

// IpAddrType is an XDR Enum defines as:
//
//   enum IPAddrType
//    {
//        IPv4 = 0,
//        IPv6 = 1
//    };
//
type IpAddrType int32

const (
	IpAddrTypeIPv4 IpAddrType = 0
	IpAddrTypeIPv6 IpAddrType = 1
)

var ipAddrTypeMap = map[int32]string{
	0: "IpAddrTypeIPv4",
	1: "IpAddrTypeIPv6",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for IpAddrType
func (e IpAddrType) ValidEnum(v int32) bool {
	_, ok := ipAddrTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e IpAddrType) String() string {
	name, _ := ipAddrTypeMap[int32(e)]
	return name
}

// PeerAddressIp is an XDR NestedUnion defines as:
//
//   union switch (IPAddrType type)
//        {
//        case IPv4:
//            opaque ipv4[4];
//        case IPv6:
//            opaque ipv6[16];
//        }
//
type PeerAddressIp struct {
	Type IpAddrType
	Ipv4 *[4]byte  `xdrmaxsize:"4"`
	Ipv6 *[16]byte `xdrmaxsize:"16"`
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u PeerAddressIp) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of PeerAddressIp
func (u PeerAddressIp) ArmForSwitch(sw int32) (string, bool) {
	switch IpAddrType(sw) {
	case IpAddrTypeIPv4:
		return "Ipv4", true
	case IpAddrTypeIPv6:
		return "Ipv6", true
	}
	return "-", false
}

// NewPeerAddressIp creates a new  PeerAddressIp.
func NewPeerAddressIp(aType IpAddrType, value interface{}) (result PeerAddressIp, err error) {
	result.Type = aType
	switch IpAddrType(aType) {
	case IpAddrTypeIPv4:
		tv, ok := value.([4]byte)
		if !ok {
			err = fmt.Errorf("invalid value, must be [4]byte")
			return
		}
		result.Ipv4 = &tv
	case IpAddrTypeIPv6:
		tv, ok := value.([16]byte)
		if !ok {
			err = fmt.Errorf("invalid value, must be [16]byte")
			return
		}
		result.Ipv6 = &tv
	}
	return
}

// MustIpv4 retrieves the Ipv4 value from the union,
// panicing if the value is not set.
func (u PeerAddressIp) MustIpv4() [4]byte {
	val, ok := u.GetIpv4()

	if !ok {
		panic("arm Ipv4 is not set")
	}

	return val
}

// GetIpv4 retrieves the Ipv4 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u PeerAddressIp) GetIpv4() (result [4]byte, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Ipv4" {
		result = *u.Ipv4
		ok = true
	}

	return
}

// MustIpv6 retrieves the Ipv6 value from the union,
// panicing if the value is not set.
func (u PeerAddressIp) MustIpv6() [16]byte {
	val, ok := u.GetIpv6()

	if !ok {
		panic("arm Ipv6 is not set")
	}

	return val
}

// GetIpv6 retrieves the Ipv6 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u PeerAddressIp) GetIpv6() (result [16]byte, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Ipv6" {
		result = *u.Ipv6
		ok = true
	}

	return
}

// PeerAddress is an XDR Struct defines as:
//
//   struct PeerAddress
//    {
//        union switch (IPAddrType type)
//        {
//        case IPv4:
//            opaque ipv4[4];
//        case IPv6:
//            opaque ipv6[16];
//        }
//        ip;
//        uint32 port;
//        uint32 numFailures;
//    };
//
type PeerAddress struct {
	Ip          PeerAddressIp
	Port        Uint32
	NumFailures Uint32
}

// MessageType is an XDR Enum defines as:
//
//   enum MessageType
//    {
//        ERROR_MSG = 0,
//        AUTH = 2,
//        DONT_HAVE = 3,
//
//        GET_PEERS = 4, // gets a list of peers this guy knows about
//        PEERS = 5,
//
//        GET_TX_SET = 6, // gets a particular txset by hash
//        TX_SET = 7,
//
//        TRANSACTION = 8, // pass on a tx you have heard about
//
//        // SCP
//        GET_SCP_QUORUMSET = 9,
//        SCP_QUORUMSET = 10,
//        SCP_MESSAGE = 11,
//        GET_SCP_STATE = 12,
//
//        // new messages
//        HELLO = 13
//    };
//
type MessageType int32

const (
	MessageTypeErrorMsg        MessageType = 0
	MessageTypeAuth            MessageType = 2
	MessageTypeDontHave        MessageType = 3
	MessageTypeGetPeers        MessageType = 4
	MessageTypePeers           MessageType = 5
	MessageTypeGetTxSet        MessageType = 6
	MessageTypeTxSet           MessageType = 7
	MessageTypeTransaction     MessageType = 8
	MessageTypeGetScpQuorumset MessageType = 9
	MessageTypeScpQuorumset    MessageType = 10
	MessageTypeScpMessage      MessageType = 11
	MessageTypeGetScpState     MessageType = 12
	MessageTypeHello           MessageType = 13
)

var messageTypeMap = map[int32]string{
	0:  "MessageTypeErrorMsg",
	2:  "MessageTypeAuth",
	3:  "MessageTypeDontHave",
	4:  "MessageTypeGetPeers",
	5:  "MessageTypePeers",
	6:  "MessageTypeGetTxSet",
	7:  "MessageTypeTxSet",
	8:  "MessageTypeTransaction",
	9:  "MessageTypeGetScpQuorumset",
	10: "MessageTypeScpQuorumset",
	11: "MessageTypeScpMessage",
	12: "MessageTypeGetScpState",
	13: "MessageTypeHello",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for MessageType
func (e MessageType) ValidEnum(v int32) bool {
	_, ok := messageTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e MessageType) String() string {
	name, _ := messageTypeMap[int32(e)]
	return name
}

// DontHave is an XDR Struct defines as:
//
//   struct DontHave
//    {
//        MessageType type;
//        uint256 reqHash;
//    };
//
type DontHave struct {
	Type    MessageType
	ReqHash Uint256
}

// StellarMessage is an XDR Union defines as:
//
//   union StellarMessage switch (MessageType type)
//    {
//    case ERROR_MSG:
//        Error error;
//    case HELLO:
//        Hello hello;
//    case AUTH:
//        Auth auth;
//    case DONT_HAVE:
//        DontHave dontHave;
//    case GET_PEERS:
//        void;
//    case PEERS:
//        PeerAddress peers<>;
//
//    case GET_TX_SET:
//        uint256 txSetHash;
//    case TX_SET:
//        TransactionSet txSet;
//
//    case TRANSACTION:
//        TransactionEnvelope transaction;
//
//    // SCP
//    case GET_SCP_QUORUMSET:
//        uint256 qSetHash;
//    case SCP_QUORUMSET:
//        SCPQuorumSet qSet;
//    case SCP_MESSAGE:
//        SCPEnvelope envelope;
//    case GET_SCP_STATE:
//        uint32 getSCPLedgerSeq; // ledger seq requested ; if 0, requests the latest
//    };
//
type StellarMessage struct {
	Type            MessageType
	Error           *Error
	Hello           *Hello
	Auth            *Auth
	DontHave        *DontHave
	Peers           *[]PeerAddress
	TxSetHash       *Uint256
	TxSet           *TransactionSet
	Transaction     *TransactionEnvelope
	QSetHash        *Uint256
	QSet            *ScpQuorumSet
	Envelope        *ScpEnvelope
	GetScpLedgerSeq *Uint32
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u StellarMessage) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of StellarMessage
func (u StellarMessage) ArmForSwitch(sw int32) (string, bool) {
	switch MessageType(sw) {
	case MessageTypeErrorMsg:
		return "Error", true
	case MessageTypeHello:
		return "Hello", true
	case MessageTypeAuth:
		return "Auth", true
	case MessageTypeDontHave:
		return "DontHave", true
	case MessageTypeGetPeers:
		return "", true
	case MessageTypePeers:
		return "Peers", true
	case MessageTypeGetTxSet:
		return "TxSetHash", true
	case MessageTypeTxSet:
		return "TxSet", true
	case MessageTypeTransaction:
		return "Transaction", true
	case MessageTypeGetScpQuorumset:
		return "QSetHash", true
	case MessageTypeScpQuorumset:
		return "QSet", true
	case MessageTypeScpMessage:
		return "Envelope", true
	case MessageTypeGetScpState:
		return "GetScpLedgerSeq", true
	}
	return "-", false
}

// NewStellarMessage creates a new  StellarMessage.
func NewStellarMessage(aType MessageType, value interface{}) (result StellarMessage, err error) {
	result.Type = aType
	switch MessageType(aType) {
	case MessageTypeErrorMsg:
		tv, ok := value.(Error)
		if !ok {
			err = fmt.Errorf("invalid value, must be Error")
			return
		}
		result.Error = &tv
	case MessageTypeHello:
		tv, ok := value.(Hello)
		if !ok {
			err = fmt.Errorf("invalid value, must be Hello")
			return
		}
		result.Hello = &tv
	case MessageTypeAuth:
		tv, ok := value.(Auth)
		if !ok {
			err = fmt.Errorf("invalid value, must be Auth")
			return
		}
		result.Auth = &tv
	case MessageTypeDontHave:
		tv, ok := value.(DontHave)
		if !ok {
			err = fmt.Errorf("invalid value, must be DontHave")
			return
		}
		result.DontHave = &tv
	case MessageTypeGetPeers:
		// void
	case MessageTypePeers:
		tv, ok := value.([]PeerAddress)
		if !ok {
			err = fmt.Errorf("invalid value, must be []PeerAddress")
			return
		}
		result.Peers = &tv
	case MessageTypeGetTxSet:
		tv, ok := value.(Uint256)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint256")
			return
		}
		result.TxSetHash = &tv
	case MessageTypeTxSet:
		tv, ok := value.(TransactionSet)
		if !ok {
			err = fmt.Errorf("invalid value, must be TransactionSet")
			return
		}
		result.TxSet = &tv
	case MessageTypeTransaction:
		tv, ok := value.(TransactionEnvelope)
		if !ok {
			err = fmt.Errorf("invalid value, must be TransactionEnvelope")
			return
		}
		result.Transaction = &tv
	case MessageTypeGetScpQuorumset:
		tv, ok := value.(Uint256)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint256")
			return
		}
		result.QSetHash = &tv
	case MessageTypeScpQuorumset:
		tv, ok := value.(ScpQuorumSet)
		if !ok {
			err = fmt.Errorf("invalid value, must be ScpQuorumSet")
			return
		}
		result.QSet = &tv
	case MessageTypeScpMessage:
		tv, ok := value.(ScpEnvelope)
		if !ok {
			err = fmt.Errorf("invalid value, must be ScpEnvelope")
			return
		}
		result.Envelope = &tv
	case MessageTypeGetScpState:
		tv, ok := value.(Uint32)
		if !ok {
			err = fmt.Errorf("invalid value, must be Uint32")
			return
		}
		result.GetScpLedgerSeq = &tv
	}
	return
}

// MustError retrieves the Error value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustError() Error {
	val, ok := u.GetError()

	if !ok {
		panic("arm Error is not set")
	}

	return val
}

// GetError retrieves the Error value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetError() (result Error, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Error" {
		result = *u.Error
		ok = true
	}

	return
}

// MustHello retrieves the Hello value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustHello() Hello {
	val, ok := u.GetHello()

	if !ok {
		panic("arm Hello is not set")
	}

	return val
}

// GetHello retrieves the Hello value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetHello() (result Hello, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Hello" {
		result = *u.Hello
		ok = true
	}

	return
}

// MustAuth retrieves the Auth value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustAuth() Auth {
	val, ok := u.GetAuth()

	if !ok {
		panic("arm Auth is not set")
	}

	return val
}

// GetAuth retrieves the Auth value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetAuth() (result Auth, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Auth" {
		result = *u.Auth
		ok = true
	}

	return
}

// MustDontHave retrieves the DontHave value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustDontHave() DontHave {
	val, ok := u.GetDontHave()

	if !ok {
		panic("arm DontHave is not set")
	}

	return val
}

// GetDontHave retrieves the DontHave value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetDontHave() (result DontHave, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "DontHave" {
		result = *u.DontHave
		ok = true
	}

	return
}

// MustPeers retrieves the Peers value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustPeers() []PeerAddress {
	val, ok := u.GetPeers()

	if !ok {
		panic("arm Peers is not set")
	}

	return val
}

// GetPeers retrieves the Peers value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetPeers() (result []PeerAddress, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Peers" {
		result = *u.Peers
		ok = true
	}

	return
}

// MustTxSetHash retrieves the TxSetHash value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustTxSetHash() Uint256 {
	val, ok := u.GetTxSetHash()

	if !ok {
		panic("arm TxSetHash is not set")
	}

	return val
}

// GetTxSetHash retrieves the TxSetHash value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetTxSetHash() (result Uint256, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "TxSetHash" {
		result = *u.TxSetHash
		ok = true
	}

	return
}

// MustTxSet retrieves the TxSet value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustTxSet() TransactionSet {
	val, ok := u.GetTxSet()

	if !ok {
		panic("arm TxSet is not set")
	}

	return val
}

// GetTxSet retrieves the TxSet value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetTxSet() (result TransactionSet, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "TxSet" {
		result = *u.TxSet
		ok = true
	}

	return
}

// MustTransaction retrieves the Transaction value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustTransaction() TransactionEnvelope {
	val, ok := u.GetTransaction()

	if !ok {
		panic("arm Transaction is not set")
	}

	return val
}

// GetTransaction retrieves the Transaction value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetTransaction() (result TransactionEnvelope, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Transaction" {
		result = *u.Transaction
		ok = true
	}

	return
}

// MustQSetHash retrieves the QSetHash value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustQSetHash() Uint256 {
	val, ok := u.GetQSetHash()

	if !ok {
		panic("arm QSetHash is not set")
	}

	return val
}

// GetQSetHash retrieves the QSetHash value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetQSetHash() (result Uint256, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "QSetHash" {
		result = *u.QSetHash
		ok = true
	}

	return
}

// MustQSet retrieves the QSet value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustQSet() ScpQuorumSet {
	val, ok := u.GetQSet()

	if !ok {
		panic("arm QSet is not set")
	}

	return val
}

// GetQSet retrieves the QSet value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetQSet() (result ScpQuorumSet, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "QSet" {
		result = *u.QSet
		ok = true
	}

	return
}

// MustEnvelope retrieves the Envelope value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustEnvelope() ScpEnvelope {
	val, ok := u.GetEnvelope()

	if !ok {
		panic("arm Envelope is not set")
	}

	return val
}

// GetEnvelope retrieves the Envelope value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetEnvelope() (result ScpEnvelope, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Envelope" {
		result = *u.Envelope
		ok = true
	}

	return
}

// MustGetScpLedgerSeq retrieves the GetScpLedgerSeq value from the union,
// panicing if the value is not set.
func (u StellarMessage) MustGetScpLedgerSeq() Uint32 {
	val, ok := u.GetGetScpLedgerSeq()

	if !ok {
		panic("arm GetScpLedgerSeq is not set")
	}

	return val
}

// GetGetScpLedgerSeq retrieves the GetScpLedgerSeq value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u StellarMessage) GetGetScpLedgerSeq() (result Uint32, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "GetScpLedgerSeq" {
		result = *u.GetScpLedgerSeq
		ok = true
	}

	return
}

// AuthenticatedMessageV0 is an XDR NestedStruct defines as:
//
//   struct
//    {
//       uint64 sequence;
//       StellarMessage message;
//       HmacSha256Mac mac;
//        }
//
type AuthenticatedMessageV0 struct {
	Sequence Uint64
	Message  StellarMessage
	Mac      HmacSha256Mac
}

// AuthenticatedMessage is an XDR Union defines as:
//
//   union AuthenticatedMessage switch (uint32 v)
//    {
//    case 0:
//        struct
//    {
//       uint64 sequence;
//       StellarMessage message;
//       HmacSha256Mac mac;
//        } v0;
//    };
//
type AuthenticatedMessage struct {
	V  Uint32
	V0 *AuthenticatedMessageV0
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u AuthenticatedMessage) SwitchFieldName() string {
	return "V"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of AuthenticatedMessage
func (u AuthenticatedMessage) ArmForSwitch(sw int32) (string, bool) {
	switch Uint32(sw) {
	case 0:
		return "V0", true
	}
	return "-", false
}

// NewAuthenticatedMessage creates a new  AuthenticatedMessage.
func NewAuthenticatedMessage(v Uint32, value interface{}) (result AuthenticatedMessage, err error) {
	result.V = v
	switch Uint32(v) {
	case 0:
		tv, ok := value.(AuthenticatedMessageV0)
		if !ok {
			err = fmt.Errorf("invalid value, must be AuthenticatedMessageV0")
			return
		}
		result.V0 = &tv
	}
	return
}

// MustV0 retrieves the V0 value from the union,
// panicing if the value is not set.
func (u AuthenticatedMessage) MustV0() AuthenticatedMessageV0 {
	val, ok := u.GetV0()

	if !ok {
		panic("arm V0 is not set")
	}

	return val
}

// GetV0 retrieves the V0 value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u AuthenticatedMessage) GetV0() (result AuthenticatedMessageV0, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.V))

	if armName == "V0" {
		result = *u.V0
		ok = true
	}

	return
}

// Value is an XDR Typedef defines as:
//
//   typedef opaque Value<>;
//
type Value []byte

// ScpBallot is an XDR Struct defines as:
//
//   struct SCPBallot
//    {
//        uint32 counter; // n
//        Value value;    // x
//    };
//
type ScpBallot struct {
	Counter Uint32
	Value   Value
}

// ScpStatementType is an XDR Enum defines as:
//
//   enum SCPStatementType
//    {
//        SCP_ST_PREPARE = 0,
//        SCP_ST_CONFIRM = 1,
//        SCP_ST_EXTERNALIZE = 2,
//        SCP_ST_NOMINATE = 3
//    };
//
type ScpStatementType int32

const (
	ScpStatementTypeScpStPrepare     ScpStatementType = 0
	ScpStatementTypeScpStConfirm     ScpStatementType = 1
	ScpStatementTypeScpStExternalize ScpStatementType = 2
	ScpStatementTypeScpStNominate    ScpStatementType = 3
)

var scpStatementTypeMap = map[int32]string{
	0: "ScpStatementTypeScpStPrepare",
	1: "ScpStatementTypeScpStConfirm",
	2: "ScpStatementTypeScpStExternalize",
	3: "ScpStatementTypeScpStNominate",
}

// ValidEnum validates a proposed value for this enum.  Implements
// the Enum interface for ScpStatementType
func (e ScpStatementType) ValidEnum(v int32) bool {
	_, ok := scpStatementTypeMap[v]
	return ok
}

// String returns the name of `e`
func (e ScpStatementType) String() string {
	name, _ := scpStatementTypeMap[int32(e)]
	return name
}

// ScpNomination is an XDR Struct defines as:
//
//   struct SCPNomination
//    {
//        Hash quorumSetHash; // D
//        Value votes<>;      // X
//        Value accepted<>;   // Y
//    };
//
type ScpNomination struct {
	QuorumSetHash Hash
	Votes         []Value
	Accepted      []Value
}

// ScpStatementPrepare is an XDR NestedStruct defines as:
//
//   struct
//            {
//                Hash quorumSetHash;       // D
//                SCPBallot ballot;         // b
//                SCPBallot* prepared;      // p
//                SCPBallot* preparedPrime; // p'
//                uint32 nC;                // c.n
//                uint32 nH;                // h.n
//            }
//
type ScpStatementPrepare struct {
	QuorumSetHash Hash
	Ballot        ScpBallot
	Prepared      *ScpBallot
	PreparedPrime *ScpBallot
	NC            Uint32
	NH            Uint32
}

// ScpStatementConfirm is an XDR NestedStruct defines as:
//
//   struct
//            {
//                SCPBallot ballot;   // b
//                uint32 nPrepared;   // p.n
//                uint32 nCommit;     // c.n
//                uint32 nH;          // h.n
//                Hash quorumSetHash; // D
//            }
//
type ScpStatementConfirm struct {
	Ballot        ScpBallot
	NPrepared     Uint32
	NCommit       Uint32
	NH            Uint32
	QuorumSetHash Hash
}

// ScpStatementExternalize is an XDR NestedStruct defines as:
//
//   struct
//            {
//                SCPBallot commit;         // c
//                uint32 nH;                // h.n
//                Hash commitQuorumSetHash; // D used before EXTERNALIZE
//            }
//
type ScpStatementExternalize struct {
	Commit              ScpBallot
	NH                  Uint32
	CommitQuorumSetHash Hash
}

// ScpStatementPledges is an XDR NestedUnion defines as:
//
//   union switch (SCPStatementType type)
//        {
//        case SCP_ST_PREPARE:
//            struct
//            {
//                Hash quorumSetHash;       // D
//                SCPBallot ballot;         // b
//                SCPBallot* prepared;      // p
//                SCPBallot* preparedPrime; // p'
//                uint32 nC;                // c.n
//                uint32 nH;                // h.n
//            } prepare;
//        case SCP_ST_CONFIRM:
//            struct
//            {
//                SCPBallot ballot;   // b
//                uint32 nPrepared;   // p.n
//                uint32 nCommit;     // c.n
//                uint32 nH;          // h.n
//                Hash quorumSetHash; // D
//            } confirm;
//        case SCP_ST_EXTERNALIZE:
//            struct
//            {
//                SCPBallot commit;         // c
//                uint32 nH;                // h.n
//                Hash commitQuorumSetHash; // D used before EXTERNALIZE
//            } externalize;
//        case SCP_ST_NOMINATE:
//            SCPNomination nominate;
//        }
//
type ScpStatementPledges struct {
	Type        ScpStatementType
	Prepare     *ScpStatementPrepare
	Confirm     *ScpStatementConfirm
	Externalize *ScpStatementExternalize
	Nominate    *ScpNomination
}

// SwitchFieldName returns the field name in which this union's
// discriminant is stored
func (u ScpStatementPledges) SwitchFieldName() string {
	return "Type"
}

// ArmForSwitch returns which field name should be used for storing
// the value for an instance of ScpStatementPledges
func (u ScpStatementPledges) ArmForSwitch(sw int32) (string, bool) {
	switch ScpStatementType(sw) {
	case ScpStatementTypeScpStPrepare:
		return "Prepare", true
	case ScpStatementTypeScpStConfirm:
		return "Confirm", true
	case ScpStatementTypeScpStExternalize:
		return "Externalize", true
	case ScpStatementTypeScpStNominate:
		return "Nominate", true
	}
	return "-", false
}

// NewScpStatementPledges creates a new  ScpStatementPledges.
func NewScpStatementPledges(aType ScpStatementType, value interface{}) (result ScpStatementPledges, err error) {
	result.Type = aType
	switch ScpStatementType(aType) {
	case ScpStatementTypeScpStPrepare:
		tv, ok := value.(ScpStatementPrepare)
		if !ok {
			err = fmt.Errorf("invalid value, must be ScpStatementPrepare")
			return
		}
		result.Prepare = &tv
	case ScpStatementTypeScpStConfirm:
		tv, ok := value.(ScpStatementConfirm)
		if !ok {
			err = fmt.Errorf("invalid value, must be ScpStatementConfirm")
			return
		}
		result.Confirm = &tv
	case ScpStatementTypeScpStExternalize:
		tv, ok := value.(ScpStatementExternalize)
		if !ok {
			err = fmt.Errorf("invalid value, must be ScpStatementExternalize")
			return
		}
		result.Externalize = &tv
	case ScpStatementTypeScpStNominate:
		tv, ok := value.(ScpNomination)
		if !ok {
			err = fmt.Errorf("invalid value, must be ScpNomination")
			return
		}
		result.Nominate = &tv
	}
	return
}

// MustPrepare retrieves the Prepare value from the union,
// panicing if the value is not set.
func (u ScpStatementPledges) MustPrepare() ScpStatementPrepare {
	val, ok := u.GetPrepare()

	if !ok {
		panic("arm Prepare is not set")
	}

	return val
}

// GetPrepare retrieves the Prepare value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u ScpStatementPledges) GetPrepare() (result ScpStatementPrepare, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Prepare" {
		result = *u.Prepare
		ok = true
	}

	return
}

// MustConfirm retrieves the Confirm value from the union,
// panicing if the value is not set.
func (u ScpStatementPledges) MustConfirm() ScpStatementConfirm {
	val, ok := u.GetConfirm()

	if !ok {
		panic("arm Confirm is not set")
	}

	return val
}

// GetConfirm retrieves the Confirm value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u ScpStatementPledges) GetConfirm() (result ScpStatementConfirm, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Confirm" {
		result = *u.Confirm
		ok = true
	}

	return
}

// MustExternalize retrieves the Externalize value from the union,
// panicing if the value is not set.
func (u ScpStatementPledges) MustExternalize() ScpStatementExternalize {
	val, ok := u.GetExternalize()

	if !ok {
		panic("arm Externalize is not set")
	}

	return val
}

// GetExternalize retrieves the Externalize value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u ScpStatementPledges) GetExternalize() (result ScpStatementExternalize, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Externalize" {
		result = *u.Externalize
		ok = true
	}

	return
}

// MustNominate retrieves the Nominate value from the union,
// panicing if the value is not set.
func (u ScpStatementPledges) MustNominate() ScpNomination {
	val, ok := u.GetNominate()

	if !ok {
		panic("arm Nominate is not set")
	}

	return val
}

// GetNominate retrieves the Nominate value from the union,
// returning ok if the union's switch indicated the value is valid.
func (u ScpStatementPledges) GetNominate() (result ScpNomination, ok bool) {
	armName, _ := u.ArmForSwitch(int32(u.Type))

	if armName == "Nominate" {
		result = *u.Nominate
		ok = true
	}

	return
}

// ScpStatement is an XDR Struct defines as:
//
//   struct SCPStatement
//    {
//        NodeID nodeID;    // v
//        uint64 slotIndex; // i
//
//        union switch (SCPStatementType type)
//        {
//        case SCP_ST_PREPARE:
//            struct
//            {
//                Hash quorumSetHash;       // D
//                SCPBallot ballot;         // b
//                SCPBallot* prepared;      // p
//                SCPBallot* preparedPrime; // p'
//                uint32 nC;                // c.n
//                uint32 nH;                // h.n
//            } prepare;
//        case SCP_ST_CONFIRM:
//            struct
//            {
//                SCPBallot ballot;   // b
//                uint32 nPrepared;   // p.n
//                uint32 nCommit;     // c.n
//                uint32 nH;          // h.n
//                Hash quorumSetHash; // D
//            } confirm;
//        case SCP_ST_EXTERNALIZE:
//            struct
//            {
//                SCPBallot commit;         // c
//                uint32 nH;                // h.n
//                Hash commitQuorumSetHash; // D used before EXTERNALIZE
//            } externalize;
//        case SCP_ST_NOMINATE:
//            SCPNomination nominate;
//        }
//        pledges;
//    };
//
type ScpStatement struct {
	NodeId    NodeId
	SlotIndex Uint64
	Pledges   ScpStatementPledges
}

// ScpEnvelope is an XDR Struct defines as:
//
//   struct SCPEnvelope
//    {
//        SCPStatement statement;
//        Signature signature;
//    };
//
type ScpEnvelope struct {
	Statement ScpStatement
	Signature Signature
}

// ScpQuorumSet is an XDR Struct defines as:
//
//   struct SCPQuorumSet
//    {
//        uint32 threshold;
//        PublicKey validators<>;
//        SCPQuorumSet innerSets<>;
//    };
//
type ScpQuorumSet struct {
	Threshold  Uint32
	Validators []PublicKey
	InnerSets  []ScpQuorumSet
}

var fmtTest = fmt.Sprint("this is a dummy usage of fmt")
