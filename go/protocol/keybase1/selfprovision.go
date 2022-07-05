// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/selfprovision.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type SelfProvisionArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	DeviceName string `codec:"deviceName" json:"deviceName"`
}

type SelfprovisionInterface interface {
	// Performs self provision. If the current device is clone, this function
	// will provision it as a new device.
	SelfProvision(context.Context, SelfProvisionArg) error
}

func SelfprovisionProtocol(i SelfprovisionInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.selfprovision",
		Methods: map[string]rpc.ServeHandlerDescription{
			"selfProvision": {
				MakeArg: func() interface{} {
					var ret [1]SelfProvisionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SelfProvisionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SelfProvisionArg)(nil), args)
						return
					}
					err = i.SelfProvision(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type SelfprovisionClient struct {
	Cli rpc.GenericClient
}

// Performs self provision. If the current device is clone, this function
// will provision it as a new device.
func (c SelfprovisionClient) SelfProvision(ctx context.Context, __arg SelfProvisionArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.selfprovision.selfProvision", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
