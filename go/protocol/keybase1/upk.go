// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/upk.avdl

package keybase1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type KeyType int

const (
	KeyType_NONE KeyType = 0
	KeyType_NACL KeyType = 1
	KeyType_PGP  KeyType = 2
)

func (o KeyType) DeepCopy() KeyType { return o }

var KeyTypeMap = map[string]KeyType{
	"NONE": 0,
	"NACL": 1,
	"PGP":  2,
}

var KeyTypeRevMap = map[KeyType]string{
	0: "NONE",
	1: "NACL",
	2: "PGP",
}

func (e KeyType) String() string {
	if v, ok := KeyTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UPK2MinorVersion int

const (
	UPK2MinorVersion_V0 UPK2MinorVersion = 0
	UPK2MinorVersion_V1 UPK2MinorVersion = 1
	UPK2MinorVersion_V2 UPK2MinorVersion = 2
	UPK2MinorVersion_V3 UPK2MinorVersion = 3
	UPK2MinorVersion_V4 UPK2MinorVersion = 4
	UPK2MinorVersion_V5 UPK2MinorVersion = 5
	UPK2MinorVersion_V6 UPK2MinorVersion = 6
)

func (o UPK2MinorVersion) DeepCopy() UPK2MinorVersion { return o }

var UPK2MinorVersionMap = map[string]UPK2MinorVersion{
	"V0": 0,
	"V1": 1,
	"V2": 2,
	"V3": 3,
	"V4": 4,
	"V5": 5,
	"V6": 6,
}

var UPK2MinorVersionRevMap = map[UPK2MinorVersion]string{
	0: "V0",
	1: "V1",
	2: "V2",
	3: "V3",
	4: "V4",
	5: "V5",
	6: "V6",
}

func (e UPK2MinorVersion) String() string {
	if v, ok := UPK2MinorVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MerkleRootV2 struct {
	Seqno    Seqno    `codec:"seqno" json:"seqno"`
	HashMeta HashMeta `codec:"hashMeta" json:"hashMeta"`
}

func (o MerkleRootV2) DeepCopy() MerkleRootV2 {
	return MerkleRootV2{
		Seqno:    o.Seqno.DeepCopy(),
		HashMeta: o.HashMeta.DeepCopy(),
	}
}

type SigChainLocation struct {
	Seqno   Seqno   `codec:"seqno" json:"seqno"`
	SeqType SeqType `codec:"seqType" json:"seqType"`
}

func (o SigChainLocation) DeepCopy() SigChainLocation {
	return SigChainLocation{
		Seqno:   o.Seqno.DeepCopy(),
		SeqType: o.SeqType.DeepCopy(),
	}
}

type MerkleTreeLocation struct {
	Leaf UserOrTeamID     `codec:"leaf" json:"leaf"`
	Loc  SigChainLocation `codec:"loc" json:"loc"`
}

func (o MerkleTreeLocation) DeepCopy() MerkleTreeLocation {
	return MerkleTreeLocation{
		Leaf: o.Leaf.DeepCopy(),
		Loc:  o.Loc.DeepCopy(),
	}
}

type SignatureMetadata struct {
	SigningKID              KID              `codec:"signingKID" json:"signingKID"`
	PrevMerkleRootSigned    MerkleRootV2     `codec:"prevMerkleRootSigned" json:"prevMerkleRootSigned"`
	FirstAppearedUnverified Seqno            `codec:"firstAppearedUnverified" json:"firstAppearedUnverified"`
	Time                    Time             `codec:"time" json:"time"`
	SigChainLocation        SigChainLocation `codec:"sigChainLocation" json:"sigChainLocation"`
}

func (o SignatureMetadata) DeepCopy() SignatureMetadata {
	return SignatureMetadata{
		SigningKID:              o.SigningKID.DeepCopy(),
		PrevMerkleRootSigned:    o.PrevMerkleRootSigned.DeepCopy(),
		FirstAppearedUnverified: o.FirstAppearedUnverified.DeepCopy(),
		Time:                    o.Time.DeepCopy(),
		SigChainLocation:        o.SigChainLocation.DeepCopy(),
	}
}

type PublicKeyV2Base struct {
	Kid          KID                `codec:"kid" json:"kid"`
	IsSibkey     bool               `codec:"isSibkey" json:"isSibkey"`
	IsEldest     bool               `codec:"isEldest" json:"isEldest"`
	CTime        Time               `codec:"cTime" json:"cTime"`
	ETime        Time               `codec:"eTime" json:"eTime"`
	Provisioning SignatureMetadata  `codec:"provisioning" json:"provisioning"`
	Revocation   *SignatureMetadata `codec:"revocation,omitempty" json:"revocation,omitempty"`
}

func (o PublicKeyV2Base) DeepCopy() PublicKeyV2Base {
	return PublicKeyV2Base{
		Kid:          o.Kid.DeepCopy(),
		IsSibkey:     o.IsSibkey,
		IsEldest:     o.IsEldest,
		CTime:        o.CTime.DeepCopy(),
		ETime:        o.ETime.DeepCopy(),
		Provisioning: o.Provisioning.DeepCopy(),
		Revocation: (func(x *SignatureMetadata) *SignatureMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Revocation),
	}
}

type PublicKeyV2NaCl struct {
	Base              PublicKeyV2Base `codec:"base" json:"base"`
	Parent            *KID            `codec:"parent,omitempty" json:"parent,omitempty"`
	DeviceID          DeviceID        `codec:"deviceID" json:"deviceID"`
	DeviceDescription string          `codec:"deviceDescription" json:"deviceDescription"`
	DeviceType        DeviceTypeV2    `codec:"deviceType" json:"deviceType"`
}

func (o PublicKeyV2NaCl) DeepCopy() PublicKeyV2NaCl {
	return PublicKeyV2NaCl{
		Base: o.Base.DeepCopy(),
		Parent: (func(x *KID) *KID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Parent),
		DeviceID:          o.DeviceID.DeepCopy(),
		DeviceDescription: o.DeviceDescription,
		DeviceType:        o.DeviceType.DeepCopy(),
	}
}

type PGPFingerprint [20]byte

func (o PGPFingerprint) DeepCopy() PGPFingerprint {
	var ret PGPFingerprint
	copy(ret[:], o[:])
	return ret
}

type PublicKeyV2PGPSummary struct {
	Base        PublicKeyV2Base `codec:"base" json:"base"`
	Fingerprint PGPFingerprint  `codec:"fingerprint" json:"fingerprint"`
	Identities  []PGPIdentity   `codec:"identities" json:"identities"`
}

func (o PublicKeyV2PGPSummary) DeepCopy() PublicKeyV2PGPSummary {
	return PublicKeyV2PGPSummary{
		Base:        o.Base.DeepCopy(),
		Fingerprint: o.Fingerprint.DeepCopy(),
		Identities: (func(x []PGPIdentity) []PGPIdentity {
			if x == nil {
				return nil
			}
			ret := make([]PGPIdentity, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Identities),
	}
}

type PublicKeyV2 struct {
	KeyType__ KeyType                `codec:"keyType" json:"keyType"`
	Nacl__    *PublicKeyV2NaCl       `codec:"nacl,omitempty" json:"nacl,omitempty"`
	PGP__     *PublicKeyV2PGPSummary `codec:"pgp,omitempty" json:"pgp,omitempty"`
}

func (o *PublicKeyV2) KeyType() (ret KeyType, err error) {
	switch o.KeyType__ {
	case KeyType_NACL:
		if o.Nacl__ == nil {
			err = errors.New("unexpected nil value for Nacl__")
			return ret, err
		}
	case KeyType_PGP:
		if o.PGP__ == nil {
			err = errors.New("unexpected nil value for PGP__")
			return ret, err
		}
	}
	return o.KeyType__, nil
}

func (o PublicKeyV2) Nacl() (res PublicKeyV2NaCl) {
	if o.KeyType__ != KeyType_NACL {
		panic("wrong case accessed")
	}
	if o.Nacl__ == nil {
		return
	}
	return *o.Nacl__
}

func (o PublicKeyV2) Pgp() (res PublicKeyV2PGPSummary) {
	if o.KeyType__ != KeyType_PGP {
		panic("wrong case accessed")
	}
	if o.PGP__ == nil {
		return
	}
	return *o.PGP__
}

func NewPublicKeyV2WithNacl(v PublicKeyV2NaCl) PublicKeyV2 {
	return PublicKeyV2{
		KeyType__: KeyType_NACL,
		Nacl__:    &v,
	}
}

func NewPublicKeyV2WithPgp(v PublicKeyV2PGPSummary) PublicKeyV2 {
	return PublicKeyV2{
		KeyType__: KeyType_PGP,
		PGP__:     &v,
	}
}

func NewPublicKeyV2Default(keyType KeyType) PublicKeyV2 {
	return PublicKeyV2{
		KeyType__: keyType,
	}
}

func (o PublicKeyV2) DeepCopy() PublicKeyV2 {
	return PublicKeyV2{
		KeyType__: o.KeyType__.DeepCopy(),
		Nacl__: (func(x *PublicKeyV2NaCl) *PublicKeyV2NaCl {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Nacl__),
		PGP__: (func(x *PublicKeyV2PGPSummary) *PublicKeyV2PGPSummary {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PGP__),
	}
}

type UserPlusKeysV2 struct {
	Uid              UID                           `codec:"uid" json:"uid"`
	Username         string                        `codec:"username" json:"username"`
	EldestSeqno      Seqno                         `codec:"eldestSeqno" json:"eldestSeqno"`
	Status           StatusCode                    `codec:"status" json:"status"`
	PerUserKeys      []PerUserKey                  `codec:"perUserKeys" json:"perUserKeys"`
	DeviceKeys       map[KID]PublicKeyV2NaCl       `codec:"deviceKeys" json:"deviceKeys"`
	PGPKeys          map[KID]PublicKeyV2PGPSummary `codec:"pgpKeys" json:"pgpKeys"`
	StellarAccountID *string                       `codec:"stellarAccountID,omitempty" json:"stellarAccountID,omitempty"`
	RemoteTracks     map[UID]RemoteTrack           `codec:"remoteTracks" json:"remoteTracks"`
	Reset            *ResetSummary                 `codec:"reset,omitempty" json:"reset,omitempty"`
	Unstubbed        bool                          `codec:"unstubbed" json:"unstubbed"`
}

func (o UserPlusKeysV2) DeepCopy() UserPlusKeysV2 {
	return UserPlusKeysV2{
		Uid:         o.Uid.DeepCopy(),
		Username:    o.Username,
		EldestSeqno: o.EldestSeqno.DeepCopy(),
		Status:      o.Status.DeepCopy(),
		PerUserKeys: (func(x []PerUserKey) []PerUserKey {
			if x == nil {
				return nil
			}
			ret := make([]PerUserKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PerUserKeys),
		DeviceKeys: (func(x map[KID]PublicKeyV2NaCl) map[KID]PublicKeyV2NaCl {
			if x == nil {
				return nil
			}
			ret := make(map[KID]PublicKeyV2NaCl, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.DeviceKeys),
		PGPKeys: (func(x map[KID]PublicKeyV2PGPSummary) map[KID]PublicKeyV2PGPSummary {
			if x == nil {
				return nil
			}
			ret := make(map[KID]PublicKeyV2PGPSummary, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.PGPKeys),
		StellarAccountID: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.StellarAccountID),
		RemoteTracks: (func(x map[UID]RemoteTrack) map[UID]RemoteTrack {
			if x == nil {
				return nil
			}
			ret := make(map[UID]RemoteTrack, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.RemoteTracks),
		Reset: (func(x *ResetSummary) *ResetSummary {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Reset),
		Unstubbed: o.Unstubbed,
	}
}

type UserPlusKeysV2AllIncarnations struct {
	Current          UserPlusKeysV2    `codec:"current" json:"current"`
	PastIncarnations []UserPlusKeysV2  `codec:"pastIncarnations" json:"pastIncarnations"`
	Uvv              UserVersionVector `codec:"uvv" json:"uvv"`
	SeqnoLinkIDs     map[Seqno]LinkID  `codec:"seqnoLinkIDs" json:"seqnoLinkIDs"`
	MinorVersion     UPK2MinorVersion  `codec:"minorVersion" json:"minorVersion"`
	Stale            bool              `codec:"stale" json:"stale"`
}

func (o UserPlusKeysV2AllIncarnations) DeepCopy() UserPlusKeysV2AllIncarnations {
	return UserPlusKeysV2AllIncarnations{
		Current: o.Current.DeepCopy(),
		PastIncarnations: (func(x []UserPlusKeysV2) []UserPlusKeysV2 {
			if x == nil {
				return nil
			}
			ret := make([]UserPlusKeysV2, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PastIncarnations),
		Uvv: o.Uvv.DeepCopy(),
		SeqnoLinkIDs: (func(x map[Seqno]LinkID) map[Seqno]LinkID {
			if x == nil {
				return nil
			}
			ret := make(map[Seqno]LinkID, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.SeqnoLinkIDs),
		MinorVersion: o.MinorVersion.DeepCopy(),
		Stale:        o.Stale,
	}
}

type UPAKVersion int

const (
	UPAKVersion_V1 UPAKVersion = 1
	UPAKVersion_V2 UPAKVersion = 2
)

func (o UPAKVersion) DeepCopy() UPAKVersion { return o }

var UPAKVersionMap = map[string]UPAKVersion{
	"V1": 1,
	"V2": 2,
}

var UPAKVersionRevMap = map[UPAKVersion]string{
	1: "V1",
	2: "V2",
}

func (e UPAKVersion) String() string {
	if v, ok := UPAKVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

// * What we're storing for each user. At first it was UPAKs, as defined
// * in common.avdl. But going forward, we're going to use UserPlusKeysV2AllIncarnations.
type UPAKVersioned struct {
	V__  UPAKVersion                    `codec:"v" json:"v"`
	V1__ *UserPlusAllKeys               `codec:"v1,omitempty" json:"v1,omitempty"`
	V2__ *UserPlusKeysV2AllIncarnations `codec:"v2,omitempty" json:"v2,omitempty"`
}

func (o *UPAKVersioned) V() (ret UPAKVersion, err error) {
	switch o.V__ {
	case UPAKVersion_V1:
		if o.V1__ == nil {
			err = errors.New("unexpected nil value for V1__")
			return ret, err
		}
	case UPAKVersion_V2:
		if o.V2__ == nil {
			err = errors.New("unexpected nil value for V2__")
			return ret, err
		}
	}
	return o.V__, nil
}

func (o UPAKVersioned) V1() (res UserPlusAllKeys) {
	if o.V__ != UPAKVersion_V1 {
		panic("wrong case accessed")
	}
	if o.V1__ == nil {
		return
	}
	return *o.V1__
}

func (o UPAKVersioned) V2() (res UserPlusKeysV2AllIncarnations) {
	if o.V__ != UPAKVersion_V2 {
		panic("wrong case accessed")
	}
	if o.V2__ == nil {
		return
	}
	return *o.V2__
}

func NewUPAKVersionedWithV1(v UserPlusAllKeys) UPAKVersioned {
	return UPAKVersioned{
		V__:  UPAKVersion_V1,
		V1__: &v,
	}
}

func NewUPAKVersionedWithV2(v UserPlusKeysV2AllIncarnations) UPAKVersioned {
	return UPAKVersioned{
		V__:  UPAKVersion_V2,
		V2__: &v,
	}
}

func (o UPAKVersioned) DeepCopy() UPAKVersioned {
	return UPAKVersioned{
		V__: o.V__.DeepCopy(),
		V1__: (func(x *UserPlusAllKeys) *UserPlusAllKeys {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V1__),
		V2__: (func(x *UserPlusKeysV2AllIncarnations) *UserPlusKeysV2AllIncarnations {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V2__),
	}
}

type UPKLiteMinorVersion int

const (
	UPKLiteMinorVersion_V0 UPKLiteMinorVersion = 0
)

func (o UPKLiteMinorVersion) DeepCopy() UPKLiteMinorVersion { return o }

var UPKLiteMinorVersionMap = map[string]UPKLiteMinorVersion{
	"V0": 0,
}

var UPKLiteMinorVersionRevMap = map[UPKLiteMinorVersion]string{
	0: "V0",
}

func (e UPKLiteMinorVersion) String() string {
	if v, ok := UPKLiteMinorVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UPKLiteV1 struct {
	Uid         UID                     `codec:"uid" json:"uid"`
	Username    string                  `codec:"username" json:"username"`
	EldestSeqno Seqno                   `codec:"eldestSeqno" json:"eldestSeqno"`
	Status      StatusCode              `codec:"status" json:"status"`
	DeviceKeys  map[KID]PublicKeyV2NaCl `codec:"deviceKeys" json:"deviceKeys"`
	Reset       *ResetSummary           `codec:"reset,omitempty" json:"reset,omitempty"`
}

func (o UPKLiteV1) DeepCopy() UPKLiteV1 {
	return UPKLiteV1{
		Uid:         o.Uid.DeepCopy(),
		Username:    o.Username,
		EldestSeqno: o.EldestSeqno.DeepCopy(),
		Status:      o.Status.DeepCopy(),
		DeviceKeys: (func(x map[KID]PublicKeyV2NaCl) map[KID]PublicKeyV2NaCl {
			if x == nil {
				return nil
			}
			ret := make(map[KID]PublicKeyV2NaCl, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.DeviceKeys),
		Reset: (func(x *ResetSummary) *ResetSummary {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Reset),
	}
}

type UPKLiteV1AllIncarnations struct {
	Current          UPKLiteV1           `codec:"current" json:"current"`
	PastIncarnations []UPKLiteV1         `codec:"pastIncarnations" json:"pastIncarnations"`
	SeqnoLinkIDs     map[Seqno]LinkID    `codec:"seqnoLinkIDs" json:"seqnoLinkIDs"`
	MinorVersion     UPKLiteMinorVersion `codec:"minorVersion" json:"minorVersion"`
}

func (o UPKLiteV1AllIncarnations) DeepCopy() UPKLiteV1AllIncarnations {
	return UPKLiteV1AllIncarnations{
		Current: o.Current.DeepCopy(),
		PastIncarnations: (func(x []UPKLiteV1) []UPKLiteV1 {
			if x == nil {
				return nil
			}
			ret := make([]UPKLiteV1, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PastIncarnations),
		SeqnoLinkIDs: (func(x map[Seqno]LinkID) map[Seqno]LinkID {
			if x == nil {
				return nil
			}
			ret := make(map[Seqno]LinkID, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.SeqnoLinkIDs),
		MinorVersion: o.MinorVersion.DeepCopy(),
	}
}

type UPKInterface interface {
}

func UPKProtocol(i UPKInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.UPK",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type UPKClient struct {
	Cli rpc.GenericClient
}
