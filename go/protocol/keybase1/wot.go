// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
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

type WotProofUI struct {
	Type             string       `codec:"type" json:"type"`
	Value            string       `codec:"value" json:"value"`
	SiteIcon         []SizedImage `codec:"siteIcon" json:"siteIcon"`
	SiteIconDarkmode []SizedImage `codec:"siteIconDarkmode" json:"siteIconDarkmode"`
}

func (o WotProofUI) DeepCopy() WotProofUI {
	return WotProofUI{
		Type:  o.Type,
		Value: o.Value,
		SiteIcon: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIcon),
		SiteIconDarkmode: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconDarkmode),
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
	WotReactionType_REJECT WotReactionType = 0
	WotReactionType_ACCEPT WotReactionType = 1
)

func (o WotReactionType) DeepCopy() WotReactionType { return o }

var WotReactionTypeMap = map[string]WotReactionType{
	"REJECT": 0,
	"ACCEPT": 1,
}

var WotReactionTypeRevMap = map[WotReactionType]string{
	0: "REJECT",
	1: "ACCEPT",
}

func (e WotReactionType) String() string {
	if v, ok := WotReactionTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type WotVouch struct {
	Status          WotStatusType `codec:"status" json:"status"`
	VouchProof      SigID         `codec:"vouchProof" json:"vouchProof"`
	Vouchee         UserVersion   `codec:"vouchee" json:"vouchee"`
	VoucheeUsername string        `codec:"voucheeUsername" json:"voucheeUsername"`
	Voucher         UserVersion   `codec:"voucher" json:"voucher"`
	VoucherUsername string        `codec:"voucherUsername" json:"voucherUsername"`
	VouchText       string        `codec:"vouchText" json:"vouchText"`
	VouchedAt       Time          `codec:"vouchedAt" json:"vouchedAt"`
	Confidence      Confidence    `codec:"confidence" json:"confidence"`
	Proofs          []WotProofUI  `codec:"proofs" json:"proofs"`
}

func (o WotVouch) DeepCopy() WotVouch {
	return WotVouch{
		Status:          o.Status.DeepCopy(),
		VouchProof:      o.VouchProof.DeepCopy(),
		Vouchee:         o.Vouchee.DeepCopy(),
		VoucheeUsername: o.VoucheeUsername,
		Voucher:         o.Voucher.DeepCopy(),
		VoucherUsername: o.VoucherUsername,
		VouchText:       o.VouchText,
		VouchedAt:       o.VouchedAt.DeepCopy(),
		Confidence:      o.Confidence.DeepCopy(),
		Proofs: (func(x []WotProofUI) []WotProofUI {
			if x == nil {
				return nil
			}
			ret := make([]WotProofUI, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Proofs),
	}
}

type WotVouchArg struct {
	SessionID  int            `codec:"sessionID" json:"sessionID"`
	Username   string         `codec:"username" json:"username"`
	GuiID      Identify3GUIID `codec:"guiID" json:"guiID"`
	VouchText  string         `codec:"vouchText" json:"vouchText"`
	Confidence Confidence     `codec:"confidence" json:"confidence"`
}

type WotVouchCLIArg struct {
	SessionID  int        `codec:"sessionID" json:"sessionID"`
	Assertion  string     `codec:"assertion" json:"assertion"`
	VouchText  string     `codec:"vouchText" json:"vouchText"`
	Confidence Confidence `codec:"confidence" json:"confidence"`
}

type WotReactArg struct {
	SessionID       int             `codec:"sessionID" json:"sessionID"`
	Voucher         string          `codec:"voucher" json:"voucher"`
	SigID           SigID           `codec:"sigID" json:"sigID"`
	Reaction        WotReactionType `codec:"reaction" json:"reaction"`
	AllowEmptySigID bool            `codec:"allowEmptySigID" json:"allowEmptySigID"`
}

type DismissWotNotificationsArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Voucher   string `codec:"voucher" json:"voucher"`
	Vouchee   string `codec:"vouchee" json:"vouchee"`
}

type WotFetchVouchesArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Vouchee   string `codec:"vouchee" json:"vouchee"`
	Voucher   string `codec:"voucher" json:"voucher"`
}

type WotInterface interface {
	WotVouch(context.Context, WotVouchArg) error
	WotVouchCLI(context.Context, WotVouchCLIArg) error
	WotReact(context.Context, WotReactArg) error
	DismissWotNotifications(context.Context, DismissWotNotificationsArg) error
	WotFetchVouches(context.Context, WotFetchVouchesArg) ([]WotVouch, error)
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
			"wotFetchVouches": {
				MakeArg: func() interface{} {
					var ret [1]WotFetchVouchesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotFetchVouchesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotFetchVouchesArg)(nil), args)
						return
					}
					ret, err = i.WotFetchVouches(ctx, typedArgs[0])
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

func (c WotClient) DismissWotNotifications(ctx context.Context, __arg DismissWotNotificationsArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.dismissWotNotifications", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c WotClient) WotFetchVouches(ctx context.Context, __arg WotFetchVouchesArg) (res []WotVouch, err error) {
	err = c.Cli.Call(ctx, "keybase.1.wot.wotFetchVouches", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
