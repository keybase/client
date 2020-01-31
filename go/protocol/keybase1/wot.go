// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/wot.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type UsernameVerificationType int

const (
	UsernameVerificationType_NONE       UsernameVerificationType = 0
	UsernameVerificationType_AUDIO      UsernameVerificationType = 1
	UsernameVerificationType_VIDEO      UsernameVerificationType = 2
	UsernameVerificationType_EMAIL      UsernameVerificationType = 3
	UsernameVerificationType_OTHER_CHAT UsernameVerificationType = 4
	UsernameVerificationType_IN_PERSON  UsernameVerificationType = 5
)

func (o UsernameVerificationType) DeepCopy() UsernameVerificationType { return o }

var UsernameVerificationTypeMap = map[string]UsernameVerificationType{
	"NONE":       0,
	"AUDIO":      1,
	"VIDEO":      2,
	"EMAIL":      3,
	"OTHER_CHAT": 4,
	"IN_PERSON":  5,
}

var UsernameVerificationTypeRevMap = map[UsernameVerificationType]string{
	0: "NONE",
	1: "AUDIO",
	2: "VIDEO",
	3: "EMAIL",
	4: "OTHER_CHAT",
	5: "IN_PERSON",
}

func (e UsernameVerificationType) String() string {
	if v, ok := UsernameVerificationTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Confidence struct {
	VouchedBy           []string                 `codec:"vouchedBy" json:"vouchedBy"`
	Proofs              []SigID                  `codec:"proofs" json:"proofs"`
	UsernameVerifiedVia UsernameVerificationType `codec:"usernameVerifiedVia" json:"usernameVerifiedVia"`
	Other               string                   `codec:"other" json:"other"`
	KnownOnKeybaseDays  int                      `codec:"knownOnKeybaseDays" json:"knownOnKeybaseDays"`
}

func (o Confidence) DeepCopy() Confidence {
	return Confidence{
		VouchedBy: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.VouchedBy),
		Proofs: (func(x []SigID) []SigID {
			if x == nil {
				return nil
			}
			ret := make([]SigID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Proofs),
		UsernameVerifiedVia: o.UsernameVerifiedVia.DeepCopy(),
		Other:               o.Other,
		KnownOnKeybaseDays:  o.KnownOnKeybaseDays,
	}
}

type WotInterface interface {
}

func WotProtocol(i WotInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.wot",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type WotClient struct {
	Cli rpc.GenericClient
}
