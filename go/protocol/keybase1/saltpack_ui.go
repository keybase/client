// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/saltpack_ui.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
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
	Fullname   string             `codec:"fullname" json:"fullname"`
	SenderType SaltpackSenderType `codec:"senderType" json:"senderType"`
}

func (o SaltpackSender) DeepCopy() SaltpackSender {
	return SaltpackSender{
		Uid:        o.Uid.DeepCopy(),
		Username:   o.Username,
		Fullname:   o.Fullname,
		SenderType: o.SenderType.DeepCopy(),
	}
}

type SaltpackPromptForDecryptArg struct {
	SessionID      int            `codec:"sessionID" json:"sessionID"`
	SigningKID     KID            `codec:"signingKID" json:"signingKID"`
	Sender         SaltpackSender `codec:"sender" json:"sender"`
	UsedDelegateUI bool           `codec:"usedDelegateUI" json:"usedDelegateUI"`
	Signed         bool           `codec:"signed" json:"signed"`
}

type SaltpackVerifySuccessArg struct {
	SessionID  int            `codec:"sessionID" json:"sessionID"`
	SigningKID KID            `codec:"signingKID" json:"signingKID"`
	Sender     SaltpackSender `codec:"sender" json:"sender"`
}

type SaltpackVerifyBadSenderArg struct {
	SessionID  int            `codec:"sessionID" json:"sessionID"`
	SigningKID KID            `codec:"signingKID" json:"signingKID"`
	Sender     SaltpackSender `codec:"sender" json:"sender"`
}

type SaltpackUiInterface interface {
	SaltpackPromptForDecrypt(context.Context, SaltpackPromptForDecryptArg) error
	SaltpackVerifySuccess(context.Context, SaltpackVerifySuccessArg) error
	SaltpackVerifyBadSender(context.Context, SaltpackVerifyBadSenderArg) error
}

func SaltpackUiProtocol(i SaltpackUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.saltpackUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"saltpackPromptForDecrypt": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackPromptForDecryptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackPromptForDecryptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackPromptForDecryptArg)(nil), args)
						return
					}
					err = i.SaltpackPromptForDecrypt(ctx, typedArgs[0])
					return
				},
			},
			"saltpackVerifySuccess": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackVerifySuccessArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackVerifySuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackVerifySuccessArg)(nil), args)
						return
					}
					err = i.SaltpackVerifySuccess(ctx, typedArgs[0])
					return
				},
			},
			"saltpackVerifyBadSender": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackVerifyBadSenderArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackVerifyBadSenderArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackVerifyBadSenderArg)(nil), args)
						return
					}
					err = i.SaltpackVerifyBadSender(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type SaltpackUiClient struct {
	Cli rpc.GenericClient
}

func (c SaltpackUiClient) SaltpackPromptForDecrypt(ctx context.Context, __arg SaltpackPromptForDecryptArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpackUi.saltpackPromptForDecrypt", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c SaltpackUiClient) SaltpackVerifySuccess(ctx context.Context, __arg SaltpackVerifySuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpackUi.saltpackVerifySuccess", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c SaltpackUiClient) SaltpackVerifyBadSender(ctx context.Context, __arg SaltpackVerifyBadSenderArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpackUi.saltpackVerifyBadSender", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
