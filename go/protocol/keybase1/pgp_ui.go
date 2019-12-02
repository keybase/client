// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/pgp_ui.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type OutputSignatureSuccessArg struct {
	SessionID   int    `codec:"sessionID" json:"sessionID"`
	Fingerprint string `codec:"fingerprint" json:"fingerprint"`
	Username    string `codec:"username" json:"username"`
	SignedAt    Time   `codec:"signedAt" json:"signedAt"`
}

type OutputSignatureSuccessNonKeybaseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	KeyID     string `codec:"keyID" json:"keyID"`
	SignedAt  Time   `codec:"signedAt" json:"signedAt"`
}

type KeyGeneratedArg struct {
	SessionID int     `codec:"sessionID" json:"sessionID"`
	Kid       KID     `codec:"kid" json:"kid"`
	Key       KeyInfo `codec:"key" json:"key"`
}

type ShouldPushPrivateArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Prompt    bool `codec:"prompt" json:"prompt"`
}

type FinishedArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PGPUiInterface interface {
	OutputSignatureSuccess(context.Context, OutputSignatureSuccessArg) error
	OutputSignatureSuccessNonKeybase(context.Context, OutputSignatureSuccessNonKeybaseArg) error
	KeyGenerated(context.Context, KeyGeneratedArg) error
	ShouldPushPrivate(context.Context, ShouldPushPrivateArg) (bool, error)
	Finished(context.Context, int) error
}

func PGPUiProtocol(i PGPUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.pgpUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"outputSignatureSuccess": {
				MakeArg: func() interface{} {
					var ret [1]OutputSignatureSuccessArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]OutputSignatureSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[1]OutputSignatureSuccessArg)(nil), args)
						return
					}
					err = i.OutputSignatureSuccess(ctx, typedArgs[0])
					return
				},
			},
			"outputSignatureSuccessNonKeybase": {
				MakeArg: func() interface{} {
					var ret [1]OutputSignatureSuccessNonKeybaseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]OutputSignatureSuccessNonKeybaseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]OutputSignatureSuccessNonKeybaseArg)(nil), args)
						return
					}
					err = i.OutputSignatureSuccessNonKeybase(ctx, typedArgs[0])
					return
				},
			},
			"keyGenerated": {
				MakeArg: func() interface{} {
					var ret [1]KeyGeneratedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]KeyGeneratedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]KeyGeneratedArg)(nil), args)
						return
					}
					err = i.KeyGenerated(ctx, typedArgs[0])
					return
				},
			},
			"shouldPushPrivate": {
				MakeArg: func() interface{} {
					var ret [1]ShouldPushPrivateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ShouldPushPrivateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ShouldPushPrivateArg)(nil), args)
						return
					}
					ret, err = i.ShouldPushPrivate(ctx, typedArgs[0])
					return
				},
			},
			"finished": {
				MakeArg: func() interface{} {
					var ret [1]FinishedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FinishedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FinishedArg)(nil), args)
						return
					}
					err = i.Finished(ctx, typedArgs[0].SessionID)
					return
				},
			},
		},
	}
}

type PGPUiClient struct {
	Cli rpc.GenericClient
}

func (c PGPUiClient) OutputSignatureSuccess(ctx context.Context, __arg OutputSignatureSuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgpUi.outputSignatureSuccess", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPUiClient) OutputSignatureSuccessNonKeybase(ctx context.Context, __arg OutputSignatureSuccessNonKeybaseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgpUi.outputSignatureSuccessNonKeybase", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPUiClient) KeyGenerated(ctx context.Context, __arg KeyGeneratedArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgpUi.keyGenerated", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPUiClient) ShouldPushPrivate(ctx context.Context, __arg ShouldPushPrivateArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgpUi.shouldPushPrivate", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c PGPUiClient) Finished(ctx context.Context, sessionID int) (err error) {
	__arg := FinishedArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.pgpUi.finished", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
