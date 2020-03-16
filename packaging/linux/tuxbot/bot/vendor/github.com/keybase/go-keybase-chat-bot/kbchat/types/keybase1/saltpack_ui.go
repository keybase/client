// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/saltpack_ui.avdl

package keybase1

import (
	"fmt"
)

type SaltpackSenderType int

const (
	SaltpackSenderType_NOT_TRACKED    SaltpackSenderType = 0
	SaltpackSenderType_UNKNOWN        SaltpackSenderType = 1
	SaltpackSenderType_ANONYMOUS      SaltpackSenderType = 2
	SaltpackSenderType_TRACKING_BROKE SaltpackSenderType = 3
	SaltpackSenderType_TRACKING_OK    SaltpackSenderType = 4
	SaltpackSenderType_SELF           SaltpackSenderType = 5
	SaltpackSenderType_REVOKED        SaltpackSenderType = 6
	SaltpackSenderType_EXPIRED        SaltpackSenderType = 7
)

func (o SaltpackSenderType) DeepCopy() SaltpackSenderType { return o }

var SaltpackSenderTypeMap = map[string]SaltpackSenderType{
	"NOT_TRACKED":    0,
	"UNKNOWN":        1,
	"ANONYMOUS":      2,
	"TRACKING_BROKE": 3,
	"TRACKING_OK":    4,
	"SELF":           5,
	"REVOKED":        6,
	"EXPIRED":        7,
}

var SaltpackSenderTypeRevMap = map[SaltpackSenderType]string{
	0: "NOT_TRACKED",
	1: "UNKNOWN",
	2: "ANONYMOUS",
	3: "TRACKING_BROKE",
	4: "TRACKING_OK",
	5: "SELF",
	6: "REVOKED",
	7: "EXPIRED",
}

func (e SaltpackSenderType) String() string {
	if v, ok := SaltpackSenderTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SaltpackSender struct {
	Uid        UID                `codec:"uid" json:"uid"`
	Username   string             `codec:"username" json:"username"`
	SenderType SaltpackSenderType `codec:"senderType" json:"senderType"`
}

func (o SaltpackSender) DeepCopy() SaltpackSender {
	return SaltpackSender{
		Uid:        o.Uid.DeepCopy(),
		Username:   o.Username,
		SenderType: o.SenderType.DeepCopy(),
	}
}
