// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/ephemeral.avdl

package keybase1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type EkGeneration int64

func (o EkGeneration) DeepCopy() EkGeneration {
	return o
}

type DeviceEkMetadata struct {
	Kid         KID          `codec:"kid" json:"device_ephemeral_dh_public"`
	HashMeta    HashMeta     `codec:"hashMeta" json:"hash_meta"`
	Generation  EkGeneration `codec:"generation" json:"generation"`
	Ctime       Time         `codec:"ctime" json:"ctime"`
	DeviceCtime Time         `codec:"deviceCtime" json:"deviceCtime"`
}

func (o DeviceEkMetadata) DeepCopy() DeviceEkMetadata {
	return DeviceEkMetadata{
		Kid:         o.Kid.DeepCopy(),
		HashMeta:    o.HashMeta.DeepCopy(),
		Generation:  o.Generation.DeepCopy(),
		Ctime:       o.Ctime.DeepCopy(),
		DeviceCtime: o.DeviceCtime.DeepCopy(),
	}
}

type DeviceEkStatement struct {
	CurrentDeviceEkMetadata DeviceEkMetadata `codec:"currentDeviceEkMetadata" json:"current_device_ek_metadata"`
}

func (o DeviceEkStatement) DeepCopy() DeviceEkStatement {
	return DeviceEkStatement{
		CurrentDeviceEkMetadata: o.CurrentDeviceEkMetadata.DeepCopy(),
	}
}

type DeviceEk struct {
	Seed     Bytes32          `codec:"seed" json:"seed"`
	Metadata DeviceEkMetadata `codec:"metadata" json:"metadata"`
}

func (o DeviceEk) DeepCopy() DeviceEk {
	return DeviceEk{
		Seed:     o.Seed.DeepCopy(),
		Metadata: o.Metadata.DeepCopy(),
	}
}

type UserEkStatement struct {
	CurrentUserEkMetadata UserEkMetadata `codec:"currentUserEkMetadata" json:"current_user_ek_metadata"`
}

func (o UserEkStatement) DeepCopy() UserEkStatement {
	return UserEkStatement{
		CurrentUserEkMetadata: o.CurrentUserEkMetadata.DeepCopy(),
	}
}

type UserEkMetadata struct {
	Kid        KID          `codec:"kid" json:"user_ephemeral_dh_public"`
	HashMeta   HashMeta     `codec:"hashMeta" json:"hash_meta"`
	Generation EkGeneration `codec:"generation" json:"generation"`
	Ctime      Time         `codec:"ctime" json:"ctime"`
}

func (o UserEkMetadata) DeepCopy() UserEkMetadata {
	return UserEkMetadata{
		Kid:        o.Kid.DeepCopy(),
		HashMeta:   o.HashMeta.DeepCopy(),
		Generation: o.Generation.DeepCopy(),
		Ctime:      o.Ctime.DeepCopy(),
	}
}

type UserEkBoxed struct {
	Box                string         `codec:"box" json:"box"`
	DeviceEkGeneration EkGeneration   `codec:"deviceEkGeneration" json:"device_ek_generation"`
	Metadata           UserEkMetadata `codec:"metadata" json:"metadata"`
}

func (o UserEkBoxed) DeepCopy() UserEkBoxed {
	return UserEkBoxed{
		Box:                o.Box,
		DeviceEkGeneration: o.DeviceEkGeneration.DeepCopy(),
		Metadata:           o.Metadata.DeepCopy(),
	}
}

type UserEkBoxMetadata struct {
	Box                 string       `codec:"box" json:"box"`
	RecipientGeneration EkGeneration `codec:"recipientGeneration" json:"recipient_generation"`
	RecipientDeviceID   DeviceID     `codec:"recipientDeviceID" json:"recipient_device_id"`
}

func (o UserEkBoxMetadata) DeepCopy() UserEkBoxMetadata {
	return UserEkBoxMetadata{
		Box:                 o.Box,
		RecipientGeneration: o.RecipientGeneration.DeepCopy(),
		RecipientDeviceID:   o.RecipientDeviceID.DeepCopy(),
	}
}

type UserEk struct {
	Seed     Bytes32        `codec:"seed" json:"seed"`
	Metadata UserEkMetadata `codec:"metadata" json:"metadata"`
}

func (o UserEk) DeepCopy() UserEk {
	return UserEk{
		Seed:     o.Seed.DeepCopy(),
		Metadata: o.Metadata.DeepCopy(),
	}
}

type UserEkReboxArg struct {
	UserEkBoxMetadata    UserEkBoxMetadata `codec:"userEkBoxMetadata" json:"userEkBoxMetadata"`
	DeviceID             DeviceID          `codec:"deviceID" json:"deviceID"`
	DeviceEkStatementSig string            `codec:"deviceEkStatementSig" json:"deviceEkStatementSig"`
}

func (o UserEkReboxArg) DeepCopy() UserEkReboxArg {
	return UserEkReboxArg{
		UserEkBoxMetadata:    o.UserEkBoxMetadata.DeepCopy(),
		DeviceID:             o.DeviceID.DeepCopy(),
		DeviceEkStatementSig: o.DeviceEkStatementSig,
	}
}

type TeamEkMetadata struct {
	Kid        KID          `codec:"kid" json:"team_ephemeral_dh_public"`
	HashMeta   HashMeta     `codec:"hashMeta" json:"hash_meta"`
	Generation EkGeneration `codec:"generation" json:"generation"`
	Ctime      Time         `codec:"ctime" json:"ctime"`
}

func (o TeamEkMetadata) DeepCopy() TeamEkMetadata {
	return TeamEkMetadata{
		Kid:        o.Kid.DeepCopy(),
		HashMeta:   o.HashMeta.DeepCopy(),
		Generation: o.Generation.DeepCopy(),
		Ctime:      o.Ctime.DeepCopy(),
	}
}

type TeamEkStatement struct {
	CurrentTeamEkMetadata TeamEkMetadata `codec:"currentTeamEkMetadata" json:"current_team_ek_metadata"`
}

func (o TeamEkStatement) DeepCopy() TeamEkStatement {
	return TeamEkStatement{
		CurrentTeamEkMetadata: o.CurrentTeamEkMetadata.DeepCopy(),
	}
}

type TeamEkBoxed struct {
	Box              string         `codec:"box" json:"box"`
	UserEkGeneration EkGeneration   `codec:"userEkGeneration" json:"user_ek_generation"`
	Metadata         TeamEkMetadata `codec:"metadata" json:"metadata"`
}

func (o TeamEkBoxed) DeepCopy() TeamEkBoxed {
	return TeamEkBoxed{
		Box:              o.Box,
		UserEkGeneration: o.UserEkGeneration.DeepCopy(),
		Metadata:         o.Metadata.DeepCopy(),
	}
}

type TeamEkBoxMetadata struct {
	Box                 string       `codec:"box" json:"box"`
	RecipientGeneration EkGeneration `codec:"recipientGeneration" json:"recipient_generation"`
	RecipientUID        UID          `codec:"recipientUID" json:"recipient_uid"`
}

func (o TeamEkBoxMetadata) DeepCopy() TeamEkBoxMetadata {
	return TeamEkBoxMetadata{
		Box:                 o.Box,
		RecipientGeneration: o.RecipientGeneration.DeepCopy(),
		RecipientUID:        o.RecipientUID.DeepCopy(),
	}
}

type TeamEk struct {
	Seed     Bytes32        `codec:"seed" json:"seed"`
	Metadata TeamEkMetadata `codec:"metadata" json:"metadata"`
}

func (o TeamEk) DeepCopy() TeamEk {
	return TeamEk{
		Seed:     o.Seed.DeepCopy(),
		Metadata: o.Metadata.DeepCopy(),
	}
}

type TeambotEkMetadata struct {
	Kid              KID          `codec:"kid" json:"teambot_dh_public"`
	Generation       EkGeneration `codec:"generation" json:"generation"`
	Uid              UID          `codec:"uid" json:"uid"`
	UserEkGeneration EkGeneration `codec:"userEkGeneration" json:"user_ek_generation"`
	HashMeta         HashMeta     `codec:"hashMeta" json:"hash_meta"`
	Ctime            Time         `codec:"ctime" json:"ctime"`
}

func (o TeambotEkMetadata) DeepCopy() TeambotEkMetadata {
	return TeambotEkMetadata{
		Kid:              o.Kid.DeepCopy(),
		Generation:       o.Generation.DeepCopy(),
		Uid:              o.Uid.DeepCopy(),
		UserEkGeneration: o.UserEkGeneration.DeepCopy(),
		HashMeta:         o.HashMeta.DeepCopy(),
		Ctime:            o.Ctime.DeepCopy(),
	}
}

type TeambotEkBoxed struct {
	Box      string            `codec:"box" json:"box"`
	Metadata TeambotEkMetadata `codec:"metadata" json:"metadata"`
}

func (o TeambotEkBoxed) DeepCopy() TeambotEkBoxed {
	return TeambotEkBoxed{
		Box:      o.Box,
		Metadata: o.Metadata.DeepCopy(),
	}
}

type TeambotEk struct {
	Seed     Bytes32           `codec:"seed" json:"seed"`
	Metadata TeambotEkMetadata `codec:"metadata" json:"metadata"`
}

func (o TeambotEk) DeepCopy() TeambotEk {
	return TeambotEk{
		Seed:     o.Seed.DeepCopy(),
		Metadata: o.Metadata.DeepCopy(),
	}
}

type TeamEphemeralKeyType int

const (
	TeamEphemeralKeyType_TEAM    TeamEphemeralKeyType = 0
	TeamEphemeralKeyType_TEAMBOT TeamEphemeralKeyType = 1
)

func (o TeamEphemeralKeyType) DeepCopy() TeamEphemeralKeyType { return o }

var TeamEphemeralKeyTypeMap = map[string]TeamEphemeralKeyType{
	"TEAM":    0,
	"TEAMBOT": 1,
}

var TeamEphemeralKeyTypeRevMap = map[TeamEphemeralKeyType]string{
	0: "TEAM",
	1: "TEAMBOT",
}

func (e TeamEphemeralKeyType) String() string {
	if v, ok := TeamEphemeralKeyTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type TeamEphemeralKey struct {
	KeyType__ TeamEphemeralKeyType `codec:"keyType" json:"keyType"`
	Team__    *TeamEk              `codec:"team,omitempty" json:"team,omitempty"`
	Teambot__ *TeambotEk           `codec:"teambot,omitempty" json:"teambot,omitempty"`
}

func (o *TeamEphemeralKey) KeyType() (ret TeamEphemeralKeyType, err error) {
	switch o.KeyType__ {
	case TeamEphemeralKeyType_TEAM:
		if o.Team__ == nil {
			err = errors.New("unexpected nil value for Team__")
			return ret, err
		}
	case TeamEphemeralKeyType_TEAMBOT:
		if o.Teambot__ == nil {
			err = errors.New("unexpected nil value for Teambot__")
			return ret, err
		}
	}
	return o.KeyType__, nil
}

func (o TeamEphemeralKey) Team() (res TeamEk) {
	if o.KeyType__ != TeamEphemeralKeyType_TEAM {
		panic("wrong case accessed")
	}
	if o.Team__ == nil {
		return
	}
	return *o.Team__
}

func (o TeamEphemeralKey) Teambot() (res TeambotEk) {
	if o.KeyType__ != TeamEphemeralKeyType_TEAMBOT {
		panic("wrong case accessed")
	}
	if o.Teambot__ == nil {
		return
	}
	return *o.Teambot__
}

func NewTeamEphemeralKeyWithTeam(v TeamEk) TeamEphemeralKey {
	return TeamEphemeralKey{
		KeyType__: TeamEphemeralKeyType_TEAM,
		Team__:    &v,
	}
}

func NewTeamEphemeralKeyWithTeambot(v TeambotEk) TeamEphemeralKey {
	return TeamEphemeralKey{
		KeyType__: TeamEphemeralKeyType_TEAMBOT,
		Teambot__: &v,
	}
}

func (o TeamEphemeralKey) DeepCopy() TeamEphemeralKey {
	return TeamEphemeralKey{
		KeyType__: o.KeyType__.DeepCopy(),
		Team__: (func(x *TeamEk) *TeamEk {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Team__),
		Teambot__: (func(x *TeambotEk) *TeambotEk {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Teambot__),
	}
}

type TeamEphemeralKeyBoxed struct {
	KeyType__ TeamEphemeralKeyType `codec:"keyType" json:"keyType"`
	Team__    *TeamEkBoxed         `codec:"team,omitempty" json:"team,omitempty"`
	Teambot__ *TeambotEkBoxed      `codec:"teambot,omitempty" json:"teambot,omitempty"`
}

func (o *TeamEphemeralKeyBoxed) KeyType() (ret TeamEphemeralKeyType, err error) {
	switch o.KeyType__ {
	case TeamEphemeralKeyType_TEAM:
		if o.Team__ == nil {
			err = errors.New("unexpected nil value for Team__")
			return ret, err
		}
	case TeamEphemeralKeyType_TEAMBOT:
		if o.Teambot__ == nil {
			err = errors.New("unexpected nil value for Teambot__")
			return ret, err
		}
	}
	return o.KeyType__, nil
}

func (o TeamEphemeralKeyBoxed) Team() (res TeamEkBoxed) {
	if o.KeyType__ != TeamEphemeralKeyType_TEAM {
		panic("wrong case accessed")
	}
	if o.Team__ == nil {
		return
	}
	return *o.Team__
}

func (o TeamEphemeralKeyBoxed) Teambot() (res TeambotEkBoxed) {
	if o.KeyType__ != TeamEphemeralKeyType_TEAMBOT {
		panic("wrong case accessed")
	}
	if o.Teambot__ == nil {
		return
	}
	return *o.Teambot__
}

func NewTeamEphemeralKeyBoxedWithTeam(v TeamEkBoxed) TeamEphemeralKeyBoxed {
	return TeamEphemeralKeyBoxed{
		KeyType__: TeamEphemeralKeyType_TEAM,
		Team__:    &v,
	}
}

func NewTeamEphemeralKeyBoxedWithTeambot(v TeambotEkBoxed) TeamEphemeralKeyBoxed {
	return TeamEphemeralKeyBoxed{
		KeyType__: TeamEphemeralKeyType_TEAMBOT,
		Teambot__: &v,
	}
}

func (o TeamEphemeralKeyBoxed) DeepCopy() TeamEphemeralKeyBoxed {
	return TeamEphemeralKeyBoxed{
		KeyType__: o.KeyType__.DeepCopy(),
		Team__: (func(x *TeamEkBoxed) *TeamEkBoxed {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Team__),
		Teambot__: (func(x *TeambotEkBoxed) *TeambotEkBoxed {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Teambot__),
	}
}

type EphemeralInterface interface {
}

func EphemeralProtocol(i EphemeralInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.ephemeral",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type EphemeralClient struct {
	Cli rpc.GenericClient
}
