// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/wot.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type UsernameVerificationType string

func (o UsernameVerificationType) DeepCopy() UsernameVerificationType {
	return o
}

type Confidence struct {
	VouchedBy           []UID                    `codec:"vouchedBy" json:"vouched_by,omitempty"`
	Proofs              []SigID                  `codec:"proofs" json:"proofs"`
	UsernameVerifiedVia UsernameVerificationType `codec:"usernameVerifiedVia" json:"username_verified_via,omitempty"`
	Other               string                   `codec:"other" json:"other"`
	KnownOnKeybaseDays  int                      `codec:"knownOnKeybaseDays" json:"known_on_keybase_days,omitempty"`
}

func (o Confidence) DeepCopy() Confidence {
	return Confidence{
		VouchedBy: (func(x []UID) []UID {
			if x == nil {
				return nil
			}
			ret := make([]UID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
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

type PendingVouch struct {
	Voucher    UserVersion `codec:"voucher" json:"voucher"`
	Proof      SigID       `codec:"proof" json:"proof"`
	VouchTexts []string    `codec:"vouchTexts" json:"vouchTexts"`
	Confidence *Confidence `codec:"confidence,omitempty" json:"confidence,omitempty"`
}

func (o PendingVouch) DeepCopy() PendingVouch {
	return PendingVouch{
		Voucher: o.Voucher.DeepCopy(),
		Proof:   o.Proof.DeepCopy(),
		VouchTexts: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.VouchTexts),
		Confidence: (func(x *Confidence) *Confidence {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Confidence),
	}
}

type WotReactionType int

const (
	WotReactionType_ACCEPT WotReactionType = 0
	WotReactionType_REJECT WotReactionType = 1
)

func (o WotReactionType) DeepCopy() WotReactionType { return o }

var WotReactionTypeMap = map[string]WotReactionType{
	"ACCEPT": 0,
	"REJECT": 1,
}

var WotReactionTypeRevMap = map[WotReactionType]string{
	0: "ACCEPT",
	1: "REJECT",
}

func (e WotReactionType) String() string {
	if v, ok := WotReactionTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
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

type WotPendingArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type WotReactArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Uv        UserVersion     `codec:"uv" json:"uv"`
	Proof     SigID           `codec:"proof" json:"proof"`
	Reaction  WotReactionType `codec:"reaction" json:"reaction"`
}

type WotInterface interface {
	WotVouch(context.Context, WotVouchArg) error
	WotVouchCLI(context.Context, WotVouchCLIArg) error
	WotPending(context.Context, int) ([]PendingVouch, error)
	WotReact(context.Context, WotReactArg) error
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
			"wotPending": {
				MakeArg: func() interface{} {
					var ret [1]WotPendingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotPendingArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotPendingArg)(nil), args)
						return
					}
					ret, err = i.WotPending(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"wotReact": {
				MakeArg: func() interface{} {
					var ret [1]WotReactArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotReactArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotReactArg)(nil), args)
						return
					}
					err = i.WotReact(ctx, typedArgs[0])
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

func (c WotClient) WotPending(ctx context.Context, sessionID int) (res []PendingVouch, err error) {
	__arg := WotPendingArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.wot.wotPending", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c WotClient) WotReact(ctx context.Context, __arg WotReactArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.wotReact", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
