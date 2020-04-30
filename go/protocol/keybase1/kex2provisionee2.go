// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kex2provisionee2.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type Hello2Res struct {
	EncryptionKey KID      `codec:"encryptionKey" json:"encryptionKey"`
	SigPayload    HelloRes `codec:"sigPayload" json:"sigPayload"`
	DeviceEkKID   KID      `codec:"deviceEkKID" json:"deviceEkKID"`
}

func (o Hello2Res) DeepCopy() Hello2Res {
	return Hello2Res{
		EncryptionKey: o.EncryptionKey.DeepCopy(),
		SigPayload:    o.SigPayload.DeepCopy(),
		DeviceEkKID:   o.DeviceEkKID.DeepCopy(),
	}
}

type PerUserKeyBox struct {
	Generation  PerUserKeyGeneration `codec:"generation" json:"generation"`
	Box         string               `codec:"box" json:"box"`
	ReceiverKID KID                  `codec:"receiverKID" json:"receiver_kid"`
}

func (o PerUserKeyBox) DeepCopy() PerUserKeyBox {
	return PerUserKeyBox{
		Generation:  o.Generation.DeepCopy(),
		Box:         o.Box,
		ReceiverKID: o.ReceiverKID.DeepCopy(),
	}
}

type Hello2Arg struct {
	Uid     UID          `codec:"uid" json:"uid"`
	Token   SessionToken `codec:"token" json:"token"`
	Csrf    CsrfToken    `codec:"csrf" json:"csrf"`
	SigBody string       `codec:"sigBody" json:"sigBody"`
}

type DidCounterSign2Arg struct {
	Sig          []byte         `codec:"sig" json:"sig"`
	PpsEncrypted string         `codec:"ppsEncrypted" json:"ppsEncrypted"`
	PukBox       *PerUserKeyBox `codec:"pukBox,omitempty" json:"pukBox,omitempty"`
	UserEkBox    *UserEkBoxed   `codec:"userEkBox,omitempty" json:"userEkBox,omitempty"`
}

type Kex2Provisionee2Interface interface {
	Hello2(context.Context, Hello2Arg) (Hello2Res, error)
	DidCounterSign2(context.Context, DidCounterSign2Arg) error
}

func Kex2Provisionee2Protocol(i Kex2Provisionee2Interface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.Kex2Provisionee2",
		Methods: map[string]rpc.ServeHandlerDescription{
			"hello2": {
				MakeArg: func() interface{} {
					var ret [1]Hello2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Hello2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]Hello2Arg)(nil), args)
						return
					}
					ret, err = i.Hello2(ctx, typedArgs[0])
					return
				},
			},
			"didCounterSign2": {
				MakeArg: func() interface{} {
					var ret [1]DidCounterSign2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DidCounterSign2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]DidCounterSign2Arg)(nil), args)
						return
					}
					err = i.DidCounterSign2(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type Kex2Provisionee2Client struct {
	Cli rpc.GenericClient
}

func (c Kex2Provisionee2Client) Hello2(ctx context.Context, __arg Hello2Arg) (res Hello2Res, err error) {
	err = c.Cli.Call(ctx, "keybase.1.Kex2Provisionee2.hello2", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c Kex2Provisionee2Client) DidCounterSign2(ctx context.Context, __arg DidCounterSign2Arg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.Kex2Provisionee2.didCounterSign2", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
