// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/quota.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type VerifySessionRes struct {
	Uid       UID    `codec:"uid" json:"uid"`
	Sid       string `codec:"sid" json:"sid"`
	Generated int    `codec:"generated" json:"generated"`
	Lifetime  int    `codec:"lifetime" json:"lifetime"`
}

func (o VerifySessionRes) DeepCopy() VerifySessionRes {
	return VerifySessionRes{
		Uid:       o.Uid.DeepCopy(),
		Sid:       o.Sid,
		Generated: o.Generated,
		Lifetime:  o.Lifetime,
	}
}

type VerifySessionArg struct {
	Session string `codec:"session" json:"session"`
}

type QuotaInterface interface {
	VerifySession(context.Context, string) (VerifySessionRes, error)
}

func QuotaProtocol(i QuotaInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.quota",
		Methods: map[string]rpc.ServeHandlerDescription{
			"verifySession": {
				MakeArg: func() interface{} {
					var ret [1]VerifySessionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]VerifySessionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]VerifySessionArg)(nil), args)
						return
					}
					ret, err = i.VerifySession(ctx, typedArgs[0].Session)
					return
				},
			},
		},
	}
}

type QuotaClient struct {
	Cli rpc.GenericClient
}

func (c QuotaClient) VerifySession(ctx context.Context, session string) (res VerifySessionRes, err error) {
	__arg := VerifySessionArg{Session: session}
	err = c.Cli.Call(ctx, "keybase.1.quota.verifySession", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
