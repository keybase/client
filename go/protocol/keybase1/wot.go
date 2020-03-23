// Auto-generated to Go types and interfaces using avdl-compiler v1.4.8 (https://github.com/keybase/node-avdl-compiler)
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

type WotProof struct {
	ProofType ProofType `codec:"proofType" json:"proof_type"`
	Name      string    `codec:"name" json:"name,omitempty"`
	Username  string    `codec:"username" json:"username,omitempty"`
	Protocol  string    `codec:"protocol" json:"protocol,omitempty"`
	Hostname  string    `codec:"hostname" json:"hostname,omitempty"`
	Domain    string    `codec:"domain" json:"domain,omitempty"`
}

func (o WotProof) DeepCopy() WotProof {
	return WotProof{
		ProofType: o.ProofType.DeepCopy(),
		Name:      o.Name,
		Username:  o.Username,
		Protocol:  o.Protocol,
		Hostname:  o.Hostname,
		Domain:    o.Domain,
	}
}

type Confidence struct {
	UsernameVerifiedVia UsernameVerificationType `codec:"usernameVerifiedVia" json:"username_verified_via,omitempty"`
	Proofs              []WotProof               `codec:"proofs" json:"proofs,omitempty"`
	Other               string                   `codec:"other" json:"other,omitempty"`
}

func (o Confidence) DeepCopy() Confidence {
	return Confidence{
		UsernameVerifiedVia: o.UsernameVerifiedVia.DeepCopy(),
		Proofs: (func(x []WotProof) []WotProof {
			if x == nil {
				return nil
			}
			ret := make([]WotProof, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Proofs),
		Other: o.Other,
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

type WotVouch struct {
	Status     WotStatusType `codec:"status" json:"status"`
	VouchProof SigID         `codec:"vouchProof" json:"vouchProof"`
	Vouchee    UserVersion   `codec:"vouchee" json:"vouchee"`
	Voucher    UserVersion   `codec:"voucher" json:"voucher"`
	VouchTexts []string      `codec:"vouchTexts" json:"vouchTexts"`
	VouchedAt  Time          `codec:"vouchedAt" json:"vouchedAt"`
	Confidence *Confidence   `codec:"confidence,omitempty" json:"confidence,omitempty"`
}

func (o WotVouch) DeepCopy() WotVouch {
	return WotVouch{
		Status:     o.Status.DeepCopy(),
		VouchProof: o.VouchProof.DeepCopy(),
		Vouchee:    o.Vouchee.DeepCopy(),
		Voucher:    o.Voucher.DeepCopy(),
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
		VouchedAt: o.VouchedAt.DeepCopy(),
		Confidence: (func(x *Confidence) *Confidence {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Confidence),
	}
}

type WotVouchArg struct {
	SessionID  int         `codec:"sessionID" json:"sessionID"`
	Vouchee    UserVersion `codec:"vouchee" json:"vouchee"`
	VouchTexts []string    `codec:"vouchTexts" json:"vouchTexts"`
	Confidence Confidence  `codec:"confidence" json:"confidence"`
}

type WotVouchCLIArg struct {
	SessionID  int        `codec:"sessionID" json:"sessionID"`
	Assertion  string     `codec:"assertion" json:"assertion"`
	VouchTexts []string   `codec:"vouchTexts" json:"vouchTexts"`
	Confidence Confidence `codec:"confidence" json:"confidence"`
}

type WotReactArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Voucher   UserVersion     `codec:"voucher" json:"voucher"`
	Proof     SigID           `codec:"proof" json:"proof"`
	Reaction  WotReactionType `codec:"reaction" json:"reaction"`
}

type WotReactCLIArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Voucher   string          `codec:"voucher" json:"voucher"`
	Reaction  WotReactionType `codec:"reaction" json:"reaction"`
}

type DismissWotNotificationsArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Voucher   string `codec:"voucher" json:"voucher"`
	Vouchee   string `codec:"vouchee" json:"vouchee"`
}

type WotListCLIArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Vouchee   string `codec:"vouchee" json:"vouchee"`
	Voucher   string `codec:"voucher" json:"voucher"`
}

type WotInterface interface {
	WotVouch(context.Context, WotVouchArg) error
	WotVouchCLI(context.Context, WotVouchCLIArg) error
	WotReact(context.Context, WotReactArg) error
	WotReactCLI(context.Context, WotReactCLIArg) error
	DismissWotNotifications(context.Context, DismissWotNotificationsArg) error
	WotListCLI(context.Context, WotListCLIArg) ([]WotVouch, error)
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
			"wotReactCLI": {
				MakeArg: func() interface{} {
					var ret [1]WotReactCLIArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotReactCLIArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotReactCLIArg)(nil), args)
						return
					}
					err = i.WotReactCLI(ctx, typedArgs[0])
					return
				},
			},
			"dismissWotNotifications": {
				MakeArg: func() interface{} {
					var ret [1]DismissWotNotificationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DismissWotNotificationsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DismissWotNotificationsArg)(nil), args)
						return
					}
					err = i.DismissWotNotifications(ctx, typedArgs[0])
					return
				},
			},
			"wotListCLI": {
				MakeArg: func() interface{} {
					var ret [1]WotListCLIArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotListCLIArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotListCLIArg)(nil), args)
						return
					}
					ret, err = i.WotListCLI(ctx, typedArgs[0])
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

func (c WotClient) WotReact(ctx context.Context, __arg WotReactArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.wotReact", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c WotClient) WotReactCLI(ctx context.Context, __arg WotReactCLIArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.wotReactCLI", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c WotClient) DismissWotNotifications(ctx context.Context, __arg DismissWotNotificationsArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.dismissWotNotifications", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c WotClient) WotListCLI(ctx context.Context, __arg WotListCLIArg) (res []WotVouch, err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.wotListCLI", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
