// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_pgp.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PGPKeyInSecretStoreFileArg struct {
}

type NotifyPGPInterface interface {
	PGPKeyInSecretStoreFile(context.Context) error
}

func NotifyPGPProtocol(i NotifyPGPInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyPGP",
		Methods: map[string]rpc.ServeHandlerDescription{
			"pgpKeyInSecretStoreFile": {
				MakeArg: func() interface{} {
					var ret [1]PGPKeyInSecretStoreFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.PGPKeyInSecretStoreFile(ctx)
					return
				},
			},
		},
	}
}

type NotifyPGPClient struct {
	Cli rpc.GenericClient
}

func (c NotifyPGPClient) PGPKeyInSecretStoreFile(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyPGP.pgpKeyInSecretStoreFile", []interface{}{PGPKeyInSecretStoreFileArg{}}, 0*time.Millisecond)
	return
}
