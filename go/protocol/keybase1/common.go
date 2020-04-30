// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/common.avdl

package keybase1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type Time int64

func (o Time) DeepCopy() Time {
	return o
}

type UnixTime int64

func (o UnixTime) DeepCopy() UnixTime {
	return o
}

type DurationSec float64

func (o DurationSec) DeepCopy() DurationSec {
	return o
}

type DurationMsec float64

func (o DurationMsec) DeepCopy() DurationMsec {
	return o
}

type StringKVPair struct {
	Key   string `codec:"key" json:"key"`
	Value string `codec:"value" json:"value"`
}

func (o StringKVPair) DeepCopy() StringKVPair {
	return StringKVPair{
		Key:   o.Key,
		Value: o.Value,
	}
}

type Status struct {
	Code   int            `codec:"code" json:"code"`
	Name   string         `codec:"name" json:"name"`
	Desc   string         `codec:"desc" json:"desc"`
	Fields []StringKVPair `codec:"fields" json:"fields"`
}

func (o Status) DeepCopy() Status {
	return Status{
		Code: o.Code,
		Name: o.Name,
		Desc: o.Desc,
		Fields: (func(x []StringKVPair) []StringKVPair {
			if x == nil {
				return nil
			}
			ret := make([]StringKVPair, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Fields),
	}
}

type UID string

func (o UID) DeepCopy() UID {
	return o
}

type VID string

func (o VID) DeepCopy() VID {
	return o
}

type DeviceID string

func (o DeviceID) DeepCopy() DeviceID {
	return o
}

type SigID string

func (o SigID) DeepCopy() SigID {
	return o
}

type LeaseID string

func (o LeaseID) DeepCopy() LeaseID {
	return o
}

type KID string

func (o KID) DeepCopy() KID {
	return o
}

type PhoneNumber string

func (o PhoneNumber) DeepCopy() PhoneNumber {
	return o
}

type RawPhoneNumber string

func (o RawPhoneNumber) DeepCopy() RawPhoneNumber {
	return o
}

type LinkID string

func (o LinkID) DeepCopy() LinkID {
	return o
}

type BinaryLinkID []byte

func (o BinaryLinkID) DeepCopy() BinaryLinkID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type BinaryKID []byte

func (o BinaryKID) DeepCopy() BinaryKID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type TLFID string

func (o TLFID) DeepCopy() TLFID {
	return o
}

type TeamID string

func (o TeamID) DeepCopy() TeamID {
	return o
}

type UserOrTeamID string

func (o UserOrTeamID) DeepCopy() UserOrTeamID {
	return o
}

type GitRepoName string

func (o GitRepoName) DeepCopy() GitRepoName {
	return o
}

type HashMeta []byte

func (o HashMeta) DeepCopy() HashMeta {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type UserVersion struct {
	Uid         UID   `codec:"uid" json:"uid"`
	EldestSeqno Seqno `codec:"eldestSeqno" json:"eldestSeqno"`
}

func (o UserVersion) DeepCopy() UserVersion {
	return UserVersion{
		Uid:         o.Uid.DeepCopy(),
		EldestSeqno: o.EldestSeqno.DeepCopy(),
	}
}

type TeamType int

const (
	TeamType_NONE   TeamType = 0
	TeamType_LEGACY TeamType = 1
	TeamType_MODERN TeamType = 2
)

func (o TeamType) DeepCopy() TeamType { return o }

var TeamTypeMap = map[string]TeamType{
	"NONE":   0,
	"LEGACY": 1,
	"MODERN": 2,
}

var TeamTypeRevMap = map[TeamType]string{
	0: "NONE",
	1: "LEGACY",
	2: "MODERN",
}

func (e TeamType) String() string {
	if v, ok := TeamTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type CompatibilityTeamID struct {
	Typ__    TeamType `codec:"typ" json:"typ"`
	Legacy__ *TLFID   `codec:"legacy,omitempty" json:"legacy,omitempty"`
	Modern__ *TeamID  `codec:"modern,omitempty" json:"modern,omitempty"`
}

func (o *CompatibilityTeamID) Typ() (ret TeamType, err error) {
	switch o.Typ__ {
	case TeamType_LEGACY:
		if o.Legacy__ == nil {
			err = errors.New("unexpected nil value for Legacy__")
			return ret, err
		}
	case TeamType_MODERN:
		if o.Modern__ == nil {
			err = errors.New("unexpected nil value for Modern__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o CompatibilityTeamID) Legacy() (res TLFID) {
	if o.Typ__ != TeamType_LEGACY {
		panic("wrong case accessed")
	}
	if o.Legacy__ == nil {
		return
	}
	return *o.Legacy__
}

func (o CompatibilityTeamID) Modern() (res TeamID) {
	if o.Typ__ != TeamType_MODERN {
		panic("wrong case accessed")
	}
	if o.Modern__ == nil {
		return
	}
	return *o.Modern__
}

func NewCompatibilityTeamIDWithLegacy(v TLFID) CompatibilityTeamID {
	return CompatibilityTeamID{
		Typ__:    TeamType_LEGACY,
		Legacy__: &v,
	}
}

func NewCompatibilityTeamIDWithModern(v TeamID) CompatibilityTeamID {
	return CompatibilityTeamID{
		Typ__:    TeamType_MODERN,
		Modern__: &v,
	}
}

func (o CompatibilityTeamID) DeepCopy() CompatibilityTeamID {
	return CompatibilityTeamID{
		Typ__: o.Typ__.DeepCopy(),
		Legacy__: (func(x *TLFID) *TLFID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Legacy__),
		Modern__: (func(x *TeamID) *TeamID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Modern__),
	}
}

type TLFVisibility int

const (
	TLFVisibility_ANY     TLFVisibility = 0
	TLFVisibility_PUBLIC  TLFVisibility = 1
	TLFVisibility_PRIVATE TLFVisibility = 2
)

func (o TLFVisibility) DeepCopy() TLFVisibility { return o }

var TLFVisibilityMap = map[string]TLFVisibility{
	"ANY":     0,
	"PUBLIC":  1,
	"PRIVATE": 2,
}

var TLFVisibilityRevMap = map[TLFVisibility]string{
	0: "ANY",
	1: "PUBLIC",
	2: "PRIVATE",
}

func (e TLFVisibility) String() string {
	if v, ok := TLFVisibilityRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type TeamIDWithVisibility struct {
	TeamID     TeamID        `codec:"teamID" json:"teamID"`
	Visibility TLFVisibility `codec:"visibility" json:"visibility"`
}

func (o TeamIDWithVisibility) DeepCopy() TeamIDWithVisibility {
	return TeamIDWithVisibility{
		TeamID:     o.TeamID.DeepCopy(),
		Visibility: o.Visibility.DeepCopy(),
	}
}

type TeamIDAndName struct {
	Id   TeamID   `codec:"id" json:"id"`
	Name TeamName `codec:"name" json:"name"`
}

func (o TeamIDAndName) DeepCopy() TeamIDAndName {
	return TeamIDAndName{
		Id:   o.Id.DeepCopy(),
		Name: o.Name.DeepCopy(),
	}
}

type Seqno int64

func (o Seqno) DeepCopy() Seqno {
	return o
}

type SeqType int

const (
	SeqType_NONE                SeqType = 0
	SeqType_PUBLIC              SeqType = 1
	SeqType_PRIVATE             SeqType = 2
	SeqType_SEMIPRIVATE         SeqType = 3
	SeqType_USER_PRIVATE_HIDDEN SeqType = 16
	SeqType_TEAM_PRIVATE_HIDDEN SeqType = 17
)

func (o SeqType) DeepCopy() SeqType { return o }

var SeqTypeMap = map[string]SeqType{
	"NONE":                0,
	"PUBLIC":              1,
	"PRIVATE":             2,
	"SEMIPRIVATE":         3,
	"USER_PRIVATE_HIDDEN": 16,
	"TEAM_PRIVATE_HIDDEN": 17,
}

var SeqTypeRevMap = map[SeqType]string{
	0:  "NONE",
	1:  "PUBLIC",
	2:  "PRIVATE",
	3:  "SEMIPRIVATE",
	16: "USER_PRIVATE_HIDDEN",
	17: "TEAM_PRIVATE_HIDDEN",
}

func (e SeqType) String() string {
	if v, ok := SeqTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Bytes32 [32]byte

func (o Bytes32) DeepCopy() Bytes32 {
	var ret Bytes32
	copy(ret[:], o[:])
	return ret
}

type Text struct {
	Data   string `codec:"data" json:"data"`
	Markup bool   `codec:"markup" json:"markup"`
}

func (o Text) DeepCopy() Text {
	return Text{
		Data:   o.Data,
		Markup: o.Markup,
	}
}

type PGPIdentity struct {
	Username string `codec:"username" json:"username"`
	Comment  string `codec:"comment" json:"comment"`
	Email    string `codec:"email" json:"email"`
}

func (o PGPIdentity) DeepCopy() PGPIdentity {
	return PGPIdentity{
		Username: o.Username,
		Comment:  o.Comment,
		Email:    o.Email,
	}
}

type PublicKey struct {
	KID               KID           `codec:"KID" json:"KID"`
	PGPFingerprint    string        `codec:"PGPFingerprint" json:"PGPFingerprint"`
	PGPIdentities     []PGPIdentity `codec:"PGPIdentities" json:"PGPIdentities"`
	IsSibkey          bool          `codec:"isSibkey" json:"isSibkey"`
	IsEldest          bool          `codec:"isEldest" json:"isEldest"`
	ParentID          string        `codec:"parentID" json:"parentID"`
	DeviceID          DeviceID      `codec:"deviceID" json:"deviceID"`
	DeviceDescription string        `codec:"deviceDescription" json:"deviceDescription"`
	DeviceType        DeviceTypeV2  `codec:"deviceType" json:"deviceType"`
	CTime             Time          `codec:"cTime" json:"cTime"`
	ETime             Time          `codec:"eTime" json:"eTime"`
	IsRevoked         bool          `codec:"isRevoked" json:"isRevoked"`
}

func (o PublicKey) DeepCopy() PublicKey {
	return PublicKey{
		KID:            o.KID.DeepCopy(),
		PGPFingerprint: o.PGPFingerprint,
		PGPIdentities: (func(x []PGPIdentity) []PGPIdentity {
			if x == nil {
				return nil
			}
			ret := make([]PGPIdentity, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PGPIdentities),
		IsSibkey:          o.IsSibkey,
		IsEldest:          o.IsEldest,
		ParentID:          o.ParentID,
		DeviceID:          o.DeviceID.DeepCopy(),
		DeviceDescription: o.DeviceDescription,
		DeviceType:        o.DeviceType.DeepCopy(),
		CTime:             o.CTime.DeepCopy(),
		ETime:             o.ETime.DeepCopy(),
		IsRevoked:         o.IsRevoked,
	}
}

type KeybaseTime struct {
	Unix  Time  `codec:"unix" json:"unix"`
	Chain Seqno `codec:"chain" json:"chain"`
}

func (o KeybaseTime) DeepCopy() KeybaseTime {
	return KeybaseTime{
		Unix:  o.Unix.DeepCopy(),
		Chain: o.Chain.DeepCopy(),
	}
}

type RevokedKey struct {
	Key  PublicKey   `codec:"key" json:"key"`
	Time KeybaseTime `codec:"time" json:"time"`
	By   KID         `codec:"by" json:"by"`
}

func (o RevokedKey) DeepCopy() RevokedKey {
	return RevokedKey{
		Key:  o.Key.DeepCopy(),
		Time: o.Time.DeepCopy(),
		By:   o.By.DeepCopy(),
	}
}

type User struct {
	Uid      UID    `codec:"uid" json:"uid"`
	Username string `codec:"username" json:"username"`
}

func (o User) DeepCopy() User {
	return User{
		Uid:      o.Uid.DeepCopy(),
		Username: o.Username,
	}
}

type Device struct {
	Type               DeviceTypeV2 `codec:"type" json:"type"`
	Name               string       `codec:"name" json:"name"`
	DeviceID           DeviceID     `codec:"deviceID" json:"deviceID"`
	DeviceNumberOfType int          `codec:"deviceNumberOfType" json:"deviceNumberOfType"`
	CTime              Time         `codec:"cTime" json:"cTime"`
	MTime              Time         `codec:"mTime" json:"mTime"`
	LastUsedTime       Time         `codec:"lastUsedTime" json:"lastUsedTime"`
	EncryptKey         KID          `codec:"encryptKey" json:"encryptKey"`
	VerifyKey          KID          `codec:"verifyKey" json:"verifyKey"`
	Status             int          `codec:"status" json:"status"`
}

func (o Device) DeepCopy() Device {
	return Device{
		Type:               o.Type.DeepCopy(),
		Name:               o.Name,
		DeviceID:           o.DeviceID.DeepCopy(),
		DeviceNumberOfType: o.DeviceNumberOfType,
		CTime:              o.CTime.DeepCopy(),
		MTime:              o.MTime.DeepCopy(),
		LastUsedTime:       o.LastUsedTime.DeepCopy(),
		EncryptKey:         o.EncryptKey.DeepCopy(),
		VerifyKey:          o.VerifyKey.DeepCopy(),
		Status:             o.Status,
	}
}

type DeviceType int

const (
	DeviceType_DESKTOP DeviceType = 0
	DeviceType_MOBILE  DeviceType = 1
)

func (o DeviceType) DeepCopy() DeviceType { return o }

var DeviceTypeMap = map[string]DeviceType{
	"DESKTOP": 0,
	"MOBILE":  1,
}

var DeviceTypeRevMap = map[DeviceType]string{
	0: "DESKTOP",
	1: "MOBILE",
}

func (e DeviceType) String() string {
	if v, ok := DeviceTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DeviceTypeV2 string

func (o DeviceTypeV2) DeepCopy() DeviceTypeV2 {
	return o
}

type Stream struct {
	Fd int `codec:"fd" json:"fd"`
}

func (o Stream) DeepCopy() Stream {
	return Stream{
		Fd: o.Fd,
	}
}

type LogLevel int

const (
	LogLevel_NONE     LogLevel = 0
	LogLevel_DEBUG    LogLevel = 1
	LogLevel_INFO     LogLevel = 2
	LogLevel_NOTICE   LogLevel = 3
	LogLevel_WARN     LogLevel = 4
	LogLevel_ERROR    LogLevel = 5
	LogLevel_CRITICAL LogLevel = 6
	LogLevel_FATAL    LogLevel = 7
)

func (o LogLevel) DeepCopy() LogLevel { return o }

var LogLevelMap = map[string]LogLevel{
	"NONE":     0,
	"DEBUG":    1,
	"INFO":     2,
	"NOTICE":   3,
	"WARN":     4,
	"ERROR":    5,
	"CRITICAL": 6,
	"FATAL":    7,
}

var LogLevelRevMap = map[LogLevel]string{
	0: "NONE",
	1: "DEBUG",
	2: "INFO",
	3: "NOTICE",
	4: "WARN",
	5: "ERROR",
	6: "CRITICAL",
	7: "FATAL",
}

func (e LogLevel) String() string {
	if v, ok := LogLevelRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ClientType int

const (
	ClientType_NONE       ClientType = 0
	ClientType_CLI        ClientType = 1
	ClientType_GUI_MAIN   ClientType = 2
	ClientType_KBFS       ClientType = 3
	ClientType_GUI_HELPER ClientType = 4
)

func (o ClientType) DeepCopy() ClientType { return o }

var ClientTypeMap = map[string]ClientType{
	"NONE":       0,
	"CLI":        1,
	"GUI_MAIN":   2,
	"KBFS":       3,
	"GUI_HELPER": 4,
}

var ClientTypeRevMap = map[ClientType]string{
	0: "NONE",
	1: "CLI",
	2: "GUI_MAIN",
	3: "KBFS",
	4: "GUI_HELPER",
}

type KBFSPathInfo struct {
	StandardPath           string `codec:"standardPath" json:"standardPath"`
	DeeplinkPath           string `codec:"deeplinkPath" json:"deeplinkPath"`
	PlatformAfterMountPath string `codec:"platformAfterMountPath" json:"platformAfterMountPath"`
}

func (o KBFSPathInfo) DeepCopy() KBFSPathInfo {
	return KBFSPathInfo{
		StandardPath:           o.StandardPath,
		DeeplinkPath:           o.DeeplinkPath,
		PlatformAfterMountPath: o.PlatformAfterMountPath,
	}
}

type UserVersionVector struct {
	Id       int64 `codec:"id" json:"id"`
	SigHints int   `codec:"sigHints" json:"sigHints"`
	SigChain int64 `codec:"sigChain" json:"sigChain"`
	CachedAt Time  `codec:"cachedAt" json:"cachedAt"`
}

func (o UserVersionVector) DeepCopy() UserVersionVector {
	return UserVersionVector{
		Id:       o.Id,
		SigHints: o.SigHints,
		SigChain: o.SigChain,
		CachedAt: o.CachedAt.DeepCopy(),
	}
}

type PerUserKeyGeneration int

func (o PerUserKeyGeneration) DeepCopy() PerUserKeyGeneration {
	return o
}

type PerUserKey struct {
	Gen         int   `codec:"gen" json:"gen"`
	Seqno       Seqno `codec:"seqno" json:"seqno"`
	SigKID      KID   `codec:"sigKID" json:"sigKID"`
	EncKID      KID   `codec:"encKID" json:"encKID"`
	SignedByKID KID   `codec:"signedByKID" json:"signedByKID"`
}

func (o PerUserKey) DeepCopy() PerUserKey {
	return PerUserKey{
		Gen:         o.Gen,
		Seqno:       o.Seqno.DeepCopy(),
		SigKID:      o.SigKID.DeepCopy(),
		EncKID:      o.EncKID.DeepCopy(),
		SignedByKID: o.SignedByKID.DeepCopy(),
	}
}

type UserPlusKeys struct {
	Uid               UID               `codec:"uid" json:"uid"`
	Username          string            `codec:"username" json:"username"`
	EldestSeqno       Seqno             `codec:"eldestSeqno" json:"eldestSeqno"`
	Status            StatusCode        `codec:"status" json:"status"`
	DeviceKeys        []PublicKey       `codec:"deviceKeys" json:"deviceKeys"`
	RevokedDeviceKeys []RevokedKey      `codec:"revokedDeviceKeys" json:"revokedDeviceKeys"`
	PGPKeyCount       int               `codec:"pgpKeyCount" json:"pgpKeyCount"`
	Uvv               UserVersionVector `codec:"uvv" json:"uvv"`
	DeletedDeviceKeys []PublicKey       `codec:"deletedDeviceKeys" json:"deletedDeviceKeys"`
	PerUserKeys       []PerUserKey      `codec:"perUserKeys" json:"perUserKeys"`
	Resets            []ResetSummary    `codec:"resets" json:"resets"`
}

func (o UserPlusKeys) DeepCopy() UserPlusKeys {
	return UserPlusKeys{
		Uid:         o.Uid.DeepCopy(),
		Username:    o.Username,
		EldestSeqno: o.EldestSeqno.DeepCopy(),
		Status:      o.Status.DeepCopy(),
		DeviceKeys: (func(x []PublicKey) []PublicKey {
			if x == nil {
				return nil
			}
			ret := make([]PublicKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.DeviceKeys),
		RevokedDeviceKeys: (func(x []RevokedKey) []RevokedKey {
			if x == nil {
				return nil
			}
			ret := make([]RevokedKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RevokedDeviceKeys),
		PGPKeyCount: o.PGPKeyCount,
		Uvv:         o.Uvv.DeepCopy(),
		DeletedDeviceKeys: (func(x []PublicKey) []PublicKey {
			if x == nil {
				return nil
			}
			ret := make([]PublicKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.DeletedDeviceKeys),
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
		Resets: (func(x []ResetSummary) []ResetSummary {
			if x == nil {
				return nil
			}
			ret := make([]ResetSummary, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Resets),
	}
}

type UserOrTeamLite struct {
	Id   UserOrTeamID `codec:"id" json:"id"`
	Name string       `codec:"name" json:"name"`
}

func (o UserOrTeamLite) DeepCopy() UserOrTeamLite {
	return UserOrTeamLite{
		Id:   o.Id.DeepCopy(),
		Name: o.Name,
	}
}

type UserOrTeamResult int

const (
	UserOrTeamResult_USER UserOrTeamResult = 1
	UserOrTeamResult_TEAM UserOrTeamResult = 2
)

func (o UserOrTeamResult) DeepCopy() UserOrTeamResult { return o }

var UserOrTeamResultMap = map[string]UserOrTeamResult{
	"USER": 1,
	"TEAM": 2,
}

var UserOrTeamResultRevMap = map[UserOrTeamResult]string{
	1: "USER",
	2: "TEAM",
}

func (e UserOrTeamResult) String() string {
	if v, ok := UserOrTeamResultRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type RemoteTrack struct {
	Username string `codec:"username" json:"username"`
	Uid      UID    `codec:"uid" json:"uid"`
	LinkID   LinkID `codec:"linkID" json:"linkID"`
}

func (o RemoteTrack) DeepCopy() RemoteTrack {
	return RemoteTrack{
		Username: o.Username,
		Uid:      o.Uid.DeepCopy(),
		LinkID:   o.LinkID.DeepCopy(),
	}
}

type UserPlusAllKeys struct {
	Base         UserPlusKeys  `codec:"base" json:"base"`
	PGPKeys      []PublicKey   `codec:"pgpKeys" json:"pgpKeys"`
	RemoteTracks []RemoteTrack `codec:"remoteTracks" json:"remoteTracks"`
}

func (o UserPlusAllKeys) DeepCopy() UserPlusAllKeys {
	return UserPlusAllKeys{
		Base: o.Base.DeepCopy(),
		PGPKeys: (func(x []PublicKey) []PublicKey {
			if x == nil {
				return nil
			}
			ret := make([]PublicKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PGPKeys),
		RemoteTracks: (func(x []RemoteTrack) []RemoteTrack {
			if x == nil {
				return nil
			}
			ret := make([]RemoteTrack, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RemoteTracks),
	}
}

type MerkleTreeID int

const (
	MerkleTreeID_MASTER           MerkleTreeID = 0
	MerkleTreeID_KBFS_PUBLIC      MerkleTreeID = 1
	MerkleTreeID_KBFS_PRIVATE     MerkleTreeID = 2
	MerkleTreeID_KBFS_PRIVATETEAM MerkleTreeID = 3
)

func (o MerkleTreeID) DeepCopy() MerkleTreeID { return o }

var MerkleTreeIDMap = map[string]MerkleTreeID{
	"MASTER":           0,
	"KBFS_PUBLIC":      1,
	"KBFS_PRIVATE":     2,
	"KBFS_PRIVATETEAM": 3,
}

var MerkleTreeIDRevMap = map[MerkleTreeID]string{
	0: "MASTER",
	1: "KBFS_PUBLIC",
	2: "KBFS_PRIVATE",
	3: "KBFS_PRIVATETEAM",
}

// SocialAssertionService is a service that can be used to assert proofs for a
// user.
type SocialAssertionService string

func (o SocialAssertionService) DeepCopy() SocialAssertionService {
	return o
}

// SocialAssertion contains a service and username for that service, that
// together form an assertion about a user. It can either be a social
// assertion (like "facebook" or "twitter") or a server trust assertion (like
// "phone" or "email").
//
// If the assertion is for social network, resolving an assertion requires
// that the user posts a Keybase proof on the asserted service as the asserted
// user.
//
// For server trust assertion, we have to trust the server.
type SocialAssertion struct {
	User    string                 `codec:"user" json:"user"`
	Service SocialAssertionService `codec:"service" json:"service"`
}

func (o SocialAssertion) DeepCopy() SocialAssertion {
	return SocialAssertion{
		User:    o.User,
		Service: o.Service.DeepCopy(),
	}
}

type FullName string

func (o FullName) DeepCopy() FullName {
	return o
}

type FullNamePackageVersion int

const (
	FullNamePackageVersion_V0 FullNamePackageVersion = 0
	FullNamePackageVersion_V1 FullNamePackageVersion = 1
	FullNamePackageVersion_V2 FullNamePackageVersion = 2
)

func (o FullNamePackageVersion) DeepCopy() FullNamePackageVersion { return o }

var FullNamePackageVersionMap = map[string]FullNamePackageVersion{
	"V0": 0,
	"V1": 1,
	"V2": 2,
}

var FullNamePackageVersionRevMap = map[FullNamePackageVersion]string{
	0: "V0",
	1: "V1",
	2: "V2",
}

func (e FullNamePackageVersion) String() string {
	if v, ok := FullNamePackageVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FullNamePackage struct {
	Version     FullNamePackageVersion `codec:"version" json:"version"`
	FullName    FullName               `codec:"fullName" json:"fullName"`
	EldestSeqno Seqno                  `codec:"eldestSeqno" json:"eldestSeqno"`
	Status      StatusCode             `codec:"status" json:"status"`
	CachedAt    Time                   `codec:"cachedAt" json:"cachedAt"`
}

func (o FullNamePackage) DeepCopy() FullNamePackage {
	return FullNamePackage{
		Version:     o.Version.DeepCopy(),
		FullName:    o.FullName.DeepCopy(),
		EldestSeqno: o.EldestSeqno.DeepCopy(),
		Status:      o.Status.DeepCopy(),
		CachedAt:    o.CachedAt.DeepCopy(),
	}
}

type ImageCropRect struct {
	X0 int `codec:"x0" json:"x0"`
	Y0 int `codec:"y0" json:"y0"`
	X1 int `codec:"x1" json:"x1"`
	Y1 int `codec:"y1" json:"y1"`
}

func (o ImageCropRect) DeepCopy() ImageCropRect {
	return ImageCropRect{
		X0: o.X0,
		Y0: o.Y0,
		X1: o.X1,
		Y1: o.Y1,
	}
}

type PhoneLookupResult struct {
	Uid      UID      `codec:"uid" json:"uid"`
	Username string   `codec:"username" json:"username"`
	Ctime    UnixTime `codec:"ctime" json:"ctime"`
}

func (o PhoneLookupResult) DeepCopy() PhoneLookupResult {
	return PhoneLookupResult{
		Uid:      o.Uid.DeepCopy(),
		Username: o.Username,
		Ctime:    o.Ctime.DeepCopy(),
	}
}

type IdentityVisibility int

const (
	IdentityVisibility_PRIVATE IdentityVisibility = 0
	IdentityVisibility_PUBLIC  IdentityVisibility = 1
)

func (o IdentityVisibility) DeepCopy() IdentityVisibility { return o }

var IdentityVisibilityMap = map[string]IdentityVisibility{
	"PRIVATE": 0,
	"PUBLIC":  1,
}

var IdentityVisibilityRevMap = map[IdentityVisibility]string{
	0: "PRIVATE",
	1: "PUBLIC",
}

func (e IdentityVisibility) String() string {
	if v, ok := IdentityVisibilityRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SizedImage struct {
	Path  string `codec:"path" json:"path"`
	Width int    `codec:"width" json:"width"`
}

func (o SizedImage) DeepCopy() SizedImage {
	return SizedImage{
		Path:  o.Path,
		Width: o.Width,
	}
}

type OfflineAvailability int

const (
	OfflineAvailability_NONE        OfflineAvailability = 0
	OfflineAvailability_BEST_EFFORT OfflineAvailability = 1
)

func (o OfflineAvailability) DeepCopy() OfflineAvailability { return o }

var OfflineAvailabilityMap = map[string]OfflineAvailability{
	"NONE":        0,
	"BEST_EFFORT": 1,
}

var OfflineAvailabilityRevMap = map[OfflineAvailability]string{
	0: "NONE",
	1: "BEST_EFFORT",
}

func (e OfflineAvailability) String() string {
	if v, ok := OfflineAvailabilityRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UserReacji struct {
	Name             string  `codec:"name" json:"name"`
	CustomAddr       *string `codec:"customAddr,omitempty" json:"customAddr,omitempty"`
	CustomAddrNoAnim *string `codec:"customAddrNoAnim,omitempty" json:"customAddrNoAnim,omitempty"`
}

func (o UserReacji) DeepCopy() UserReacji {
	return UserReacji{
		Name: o.Name,
		CustomAddr: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.CustomAddr),
		CustomAddrNoAnim: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.CustomAddrNoAnim),
	}
}

type ReacjiSkinTone int

const (
	ReacjiSkinTone_NONE      ReacjiSkinTone = 0
	ReacjiSkinTone_SKINTONE1 ReacjiSkinTone = 1
	ReacjiSkinTone_SKINTONE2 ReacjiSkinTone = 2
	ReacjiSkinTone_SKINTONE3 ReacjiSkinTone = 3
	ReacjiSkinTone_SKINTONE4 ReacjiSkinTone = 4
	ReacjiSkinTone_SKINTONE5 ReacjiSkinTone = 5
)

func (o ReacjiSkinTone) DeepCopy() ReacjiSkinTone { return o }

var ReacjiSkinToneMap = map[string]ReacjiSkinTone{
	"NONE":      0,
	"SKINTONE1": 1,
	"SKINTONE2": 2,
	"SKINTONE3": 3,
	"SKINTONE4": 4,
	"SKINTONE5": 5,
}

var ReacjiSkinToneRevMap = map[ReacjiSkinTone]string{
	0: "NONE",
	1: "SKINTONE1",
	2: "SKINTONE2",
	3: "SKINTONE3",
	4: "SKINTONE4",
	5: "SKINTONE5",
}

func (e ReacjiSkinTone) String() string {
	if v, ok := ReacjiSkinToneRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UserReacjis struct {
	TopReacjis []UserReacji   `codec:"topReacjis" json:"topReacjis"`
	SkinTone   ReacjiSkinTone `codec:"skinTone" json:"skinTone"`
}

func (o UserReacjis) DeepCopy() UserReacjis {
	return UserReacjis{
		TopReacjis: (func(x []UserReacji) []UserReacji {
			if x == nil {
				return nil
			}
			ret := make([]UserReacji, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TopReacjis),
		SkinTone: o.SkinTone.DeepCopy(),
	}
}

type WotStatusType int

const (
	WotStatusType_NONE     WotStatusType = 0
	WotStatusType_PROPOSED WotStatusType = 1
	WotStatusType_ACCEPTED WotStatusType = 2
	WotStatusType_REJECTED WotStatusType = 3
	WotStatusType_REVOKED  WotStatusType = 4
)

func (o WotStatusType) DeepCopy() WotStatusType { return o }

var WotStatusTypeMap = map[string]WotStatusType{
	"NONE":     0,
	"PROPOSED": 1,
	"ACCEPTED": 2,
	"REJECTED": 3,
	"REVOKED":  4,
}

var WotStatusTypeRevMap = map[WotStatusType]string{
	0: "NONE",
	1: "PROPOSED",
	2: "ACCEPTED",
	3: "REJECTED",
	4: "REVOKED",
}

func (e WotStatusType) String() string {
	if v, ok := WotStatusTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type CommonInterface interface {
}

func CommonProtocol(i CommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.Common",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type CommonClient struct {
	Cli rpc.GenericClient
}
