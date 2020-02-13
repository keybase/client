// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/wot.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
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
	VouchedBy           []string                 `codec:"vouchedBy" json:"vouched_by,omitempty"`
	Proofs              []SigID                  `codec:"proofs" json:"proofs"`
	UsernameVerifiedVia UsernameVerificationType `codec:"usernameVerifiedVia" json:"username_verified_via,omitempty"`
	Other               string                   `codec:"other" json:"other"`
	KnownOnKeybaseDays  int                      `codec:"knownOnKeybaseDays" json:"known_on_keybase_days,omitempty"`
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

type WotVouchArg struct {
	SessionID  int         `codec:"sessionID" json:"sessionID"`
	Uv         UserVersion `codec:"uv" json:"uv"`
	VouchTexts []string    `codec:"vouchTexts" json:"vouchTexts"`
	Confidence Confidence  `codec:"confidence" json:"confidence"`
}

type WotVouchCLIArg struct {
	SessionID  int        `codec:"sessionID" json:"sessionID"`
	Assertion  string     `codec:"assertion" json:"assertion"`
	VouchTexts []string   `codec:"vouchTexts" json:"vouchTexts"`
	Confidence Confidence `codec:"confidence" json:"confidence"`
}

type WotInterface interface {
	WotVouch(context.Context, WotVouchArg) error
	WotVouchCLI(context.Context, WotVouchCLIArg) error
}

func WotProtocol(i WotInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.wot",
		Methods: map[string]rpc.ServeHandlerDescription{
			"wotVouch": {
				MakeArg: func() interface{} {
					var ret [1]WotVouchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotVouchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotVouchArg)(nil), args)
						return
					}
					err = i.WotVouch(ctx, typedArgs[0])
					return
				},
			},
			"wotVouchCLI": {
				MakeArg: func() interface{} {
					var ret [1]WotVouchCLIArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotVouchCLIArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotVouchCLIArg)(nil), args)
						return
					}
					err = i.WotVouchCLI(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type WotClient struct {
	Cli rpc.GenericClient
}

func (c WotClient) WotVouch(ctx context.Context, __arg WotVouchArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.wotVouch", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c WotClient) WotVouchCLI(ctx context.Context, __arg WotVouchCLIArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.wotVouchCLI", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
