// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/cryptocurrency.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RegisterAddressRes struct {
	Type   string `codec:"type" json:"type"`
	Family string `codec:"family" json:"family"`
}

func (o RegisterAddressRes) DeepCopy() RegisterAddressRes {
	return RegisterAddressRes{
		Type:   o.Type,
		Family: o.Family,
	}
}

type RegisterAddressArg struct {
	SessionID    int         `codec:"sessionID" json:"sessionID"`
	Address      string      `codec:"address" json:"address"`
	Force        bool        `codec:"force" json:"force"`
	WantedFamily string      `codec:"wantedFamily" json:"wantedFamily"`
	SigVersion   *SigVersion `codec:"sigVersion,omitempty" json:"sigVersion,omitempty"`
}

type CryptocurrencyInterface interface {
	RegisterAddress(context.Context, RegisterAddressArg) (RegisterAddressRes, error)
}

func CryptocurrencyProtocol(i CryptocurrencyInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.cryptocurrency",
		Methods: map[string]rpc.ServeHandlerDescription{
			"registerAddress": {
				MakeArg: func() interface{} {
					var ret [1]RegisterAddressArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RegisterAddressArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RegisterAddressArg)(nil), args)
						return
					}
					ret, err = i.RegisterAddress(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type CryptocurrencyClient struct {
	Cli rpc.GenericClient
}

func (c CryptocurrencyClient) RegisterAddress(ctx context.Context, __arg RegisterAddressArg) (res RegisterAddressRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.cryptocurrency.registerAddress", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
