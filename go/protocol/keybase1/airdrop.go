// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/airdrop.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type AirdropDetails struct {
	Uid  UID       `codec:"uid" json:"uid"`
	Kid  BinaryKID `codec:"kid" json:"kid"`
	Vid  VID       `codec:"vid" json:"vid"`
	Vers string    `codec:"vers" json:"vers"`
	Time Time      `codec:"time" json:"time"`
}

func (o AirdropDetails) DeepCopy() AirdropDetails {
	return AirdropDetails{
		Uid:  o.Uid.DeepCopy(),
		Kid:  o.Kid.DeepCopy(),
		Vid:  o.Vid.DeepCopy(),
		Vers: o.Vers,
		Time: o.Time.DeepCopy(),
	}
}

type Reg1Arg struct {
	Uid UID       `codec:"uid" json:"uid"`
	Kid BinaryKID `codec:"kid" json:"kid"`
}

type Reg2Arg struct {
	Ctext []byte `codec:"ctext" json:"ctext"`
}

type AirdropInterface interface {
	Reg1(context.Context, Reg1Arg) (BinaryKID, error)
	Reg2(context.Context, []byte) error
}

func AirdropProtocol(i AirdropInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.airdrop",
		Methods: map[string]rpc.ServeHandlerDescription{
			"reg1": {
				MakeArg: func() interface{} {
					var ret [1]Reg1Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Reg1Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]Reg1Arg)(nil), args)
						return
					}
					ret, err = i.Reg1(ctx, typedArgs[0])
					return
				},
			},
			"reg2": {
				MakeArg: func() interface{} {
					var ret [1]Reg2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Reg2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]Reg2Arg)(nil), args)
						return
					}
					err = i.Reg2(ctx, typedArgs[0].Ctext)
					return
				},
			},
		},
	}
}

type AirdropClient struct {
	Cli rpc.GenericClient
}

func (c AirdropClient) Reg1(ctx context.Context, __arg Reg1Arg) (res BinaryKID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.airdrop.reg1", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c AirdropClient) Reg2(ctx context.Context, ctext []byte) (err error) {
	__arg := Reg2Arg{Ctext: ctext}
	err = c.Cli.Call(ctx, "keybase.1.airdrop.reg2", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
