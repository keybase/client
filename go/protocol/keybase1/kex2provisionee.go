// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kex2provisionee.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PassphraseStream struct {
	PassphraseStream []byte `codec:"passphraseStream" json:"passphraseStream"`
	Generation       int    `codec:"generation" json:"generation"`
}

func (o PassphraseStream) DeepCopy() PassphraseStream {
	return PassphraseStream{
		PassphraseStream: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.PassphraseStream),
		Generation: o.Generation,
	}
}

type SessionToken string

func (o SessionToken) DeepCopy() SessionToken {
	return o
}

type CsrfToken string

func (o CsrfToken) DeepCopy() CsrfToken {
	return o
}

type HelloRes string

func (o HelloRes) DeepCopy() HelloRes {
	return o
}

type HelloArg struct {
	Uid     UID              `codec:"uid" json:"uid"`
	Token   SessionToken     `codec:"token" json:"token"`
	Csrf    CsrfToken        `codec:"csrf" json:"csrf"`
	Pps     PassphraseStream `codec:"pps" json:"pps"`
	SigBody string           `codec:"sigBody" json:"sigBody"`
}

type DidCounterSignArg struct {
	Sig []byte `codec:"sig" json:"sig"`
}

type Kex2ProvisioneeInterface interface {
	Hello(context.Context, HelloArg) (HelloRes, error)
	DidCounterSign(context.Context, []byte) error
}

func Kex2ProvisioneeProtocol(i Kex2ProvisioneeInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.Kex2Provisionee",
		Methods: map[string]rpc.ServeHandlerDescription{
			"hello": {
				MakeArg: func() interface{} {
					var ret [1]HelloArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HelloArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HelloArg)(nil), args)
						return
					}
					ret, err = i.Hello(ctx, typedArgs[0])
					return
				},
			},
			"didCounterSign": {
				MakeArg: func() interface{} {
					var ret [1]DidCounterSignArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DidCounterSignArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DidCounterSignArg)(nil), args)
						return
					}
					err = i.DidCounterSign(ctx, typedArgs[0].Sig)
					return
				},
			},
		},
	}
}

type Kex2ProvisioneeClient struct {
	Cli rpc.GenericClient
}

func (c Kex2ProvisioneeClient) Hello(ctx context.Context, __arg HelloArg) (res HelloRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.Kex2Provisionee.hello", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c Kex2ProvisioneeClient) DidCounterSign(ctx context.Context, sig []byte) (err error) {
	__arg := DidCounterSignArg{Sig: sig}
	err = c.Cli.Call(ctx, "keybase.1.Kex2Provisionee.didCounterSign", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
