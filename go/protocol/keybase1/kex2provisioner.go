// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kex2provisioner.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type KexStartArg struct {
}

type Kex2ProvisionerInterface interface {
	KexStart(context.Context) error
}

func Kex2ProvisionerProtocol(i Kex2ProvisionerInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.Kex2Provisioner",
		Methods: map[string]rpc.ServeHandlerDescription{
			"kexStart": {
				MakeArg: func() interface{} {
					var ret [1]KexStartArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.KexStart(ctx)
					return
				},
			},
		},
	}
}

type Kex2ProvisionerClient struct {
	Cli rpc.GenericClient
}

func (c Kex2ProvisionerClient) KexStart(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.Kex2Provisioner.kexStart", []interface{}{KexStartArg{}}, 0*time.Millisecond)
	return
}
